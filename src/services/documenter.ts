import { minimatch } from 'minimatch';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { BotConfig, FileUpdate, RepoRef, Logger } from '../types/index.js';
import { getFileContent, getPRFiles, getRepoTree } from './github.js';
import { isCodeFile } from './extensions.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DocInsertion {
  file: string;
  line: number;
  name: string;
  kind: string;
  visibility: 'public' | 'internal';
  signature: string;
  description: string;
  doc: string;
}

export interface DocumentationResult {
  insertions: DocInsertion[];
  fileUpdates: FileUpdate[];
  filesAnalyzed: number;
}

// ---------------------------------------------------------------------------
// LLM client
// ---------------------------------------------------------------------------

interface LLMClient {
  generate(prompt: string): Promise<string>;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`LLM call timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function withRetry(
  fn: () => Promise<string>,
  maxRetries: number,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const status = (error as { status?: number }).status;
      if (status === 429 || status === 529 || status === 503) {
        const delay = Math.min(1000 * 2 ** attempt, 30_000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function createClient(config: BotConfig): LLMClient {
  if (config.ai.provider === 'anthropic') {
    const client = new Anthropic();
    return {
      async generate(prompt: string) {
        return withRetry(async () => {
          const res = await withTimeout(
            client.messages.create({
              model: config.ai.model,
              max_tokens: 4096,
              messages: [{ role: 'user', content: prompt }],
            }),
            LLM_TIMEOUT_MS,
          );
          const block = res.content[0];
          return block?.type === 'text' ? block.text : '';
        }, LLM_MAX_RETRIES);
      },
    };
  }

  const client = new OpenAI();
  return {
    async generate(prompt: string) {
      return withRetry(async () => {
        const res = await withTimeout(
          client.chat.completions.create({
            model: config.ai.model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
          }),
          LLM_TIMEOUT_MS,
        );
        return res.choices[0]?.message?.content ?? '';
      }, LLM_MAX_RETRIES);
    },
  };
}

// ---------------------------------------------------------------------------
// Entry points: PR-scoped and full-repo
// ---------------------------------------------------------------------------

const CONCURRENCY = 5;
const MAX_FILE_SIZE = 100_000;
const LLM_TIMEOUT_MS = 60_000;
const LLM_MAX_RETRIES = 3;

export async function documentPR(
  ref: RepoRef,
  prNumber: number,
  headRef: string,
  config: BotConfig,
  log: Logger,
): Promise<DocumentationResult> {
  const files = await getPRFiles(ref, prNumber);

  const codePaths = files
    .filter((f) => f.status !== 'removed')
    .filter((f) => !isIgnored(f.filename, config))
    .filter((f) => isCodeFile(f.filename))
    .map((f) => f.filename);

  log.info(
    `Analyzing ${codePaths.length} code files out of ${files.length} changed`,
  );

  return documentFiles(ref, codePaths, headRef, config, log);
}

export async function documentRepo(
  ref: RepoRef,
  treeSha: string,
  config: BotConfig,
  log: Logger,
): Promise<DocumentationResult> {
  const { entries, truncated } = await getRepoTree(ref, treeSha);

  if (truncated) {
    log.warn(
      { truncated },
      'Repo tree was truncated — very large repos may have incomplete coverage',
    );
  }

  const codePaths = entries
    .map((e) => e.path)
    .filter((p) => !isIgnored(p, config))
    .filter((p) => isCodeFile(p))
    .slice(0, config.bootstrap.max_files_per_pr);

  log.info(
    `Bootstrap: analyzing ${codePaths.length} code files out of ${entries.length} total`,
  );

  return documentFiles(ref, codePaths, treeSha, config, log);
}

// ---------------------------------------------------------------------------
// Core pipeline: fetch → LLM → apply → reference docs
// ---------------------------------------------------------------------------

async function documentFiles(
  ref: RepoRef,
  filePaths: string[],
  gitRef: string,
  config: BotConfig,
  log: Logger,
): Promise<DocumentationResult> {
  const llm = createClient(config);
  const allInsertions: DocInsertion[] = [];
  const fileContents = new Map<string, string>();

  for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
    const batch = filePaths.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (filePath) => {
        const content = await getFileContent(ref, filePath, gitRef);
        if (!content) return;

        if (content.length > MAX_FILE_SIZE) {
          log.info(`Skipping ${filePath} (${content.length} chars exceeds ${MAX_FILE_SIZE} limit)`);
          return;
        }

        if (isBinaryContent(content)) {
          log.info(`Skipping ${filePath} (appears to be binary)`);
          return;
        }

        fileContents.set(filePath, content);

        try {
          const insertions = await analyzeAndDocument(
            llm,
            filePath,
            content,
            config,
          );
          allInsertions.push(...insertions);
        } catch (error) {
          log.warn(
            { error },
            `LLM analysis failed for ${filePath}, skipping`,
          );
        }
      }),
    );
  }

  const fileUpdates: FileUpdate[] = [];

  if (config.documentation.inline.enabled) {
    fileUpdates.push(...applyInsertions(allInsertions, fileContents));
  }

  if (config.documentation.reference.enabled && allInsertions.length > 0) {
    fileUpdates.push(...generateReferenceDocs(allInsertions, config));
  }

  log.info(
    `Generated ${allInsertions.length} doc entries across ${fileContents.size} files (${fileUpdates.length} files changed)`,
  );

  return {
    insertions: allInsertions,
    fileUpdates,
    filesAnalyzed: fileContents.size,
  };
}

// ---------------------------------------------------------------------------
// Single-file LLM call: detect gaps + generate docs in one shot
// ---------------------------------------------------------------------------

function buildPrompt(
  filePath: string,
  content: string,
  config: BotConfig,
): string {
  const scope =
    config.documentation.inline.scope === 'all'
      ? 'Analyze ALL functions, classes, methods, interfaces, types, and enums — including private ones.'
      : 'Analyze ALL elements regardless of visibility, but classify each as "public" or "internal".';

  const style =
    config.documentation.inline.style === 'auto'
      ? 'Use the idiomatic documentation style for this language (e.g., JSDoc for JS/TS, docstrings for Python, Javadoc for Java, doc comments for Rust/Go, XML docs for C#, etc.).'
      : `Use ${config.documentation.inline.style} style.`;

  const customInstructions = config.ai.custom_instructions
    ? `\nAdditional instructions from the repository owner:\n${config.ai.custom_instructions}\n`
    : '';

  return `You are a documentation generator. Analyze this code file and identify all undocumented elements.

${scope}
Style: ${style}
${customInstructions}
File: ${filePath}
\`\`\`
${content}
\`\`\`

For each undocumented element, return a JSON array of objects with:
- "line": the 1-indexed line number to insert the documentation comment BEFORE
- "name": the name of the element
- "kind": one of "function", "class", "method", "interface", "type", "variable", "enum"
- "visibility": "public" if the element is exported/public-facing, "internal" if it is private/internal/unexported
- "signature": the full signature as it appears in the code (e.g., "export function calculateTotal(items: number[], tax: number): number")
- "description": a plain-text one-sentence description of what this element does
- "doc": the complete documentation comment including delimiters

If the file is fully documented or has no documentable APIs, return: []

RULES:
- Only add documentation where none exists. Do NOT replace or modify existing docs.
- Match the tone and style of any existing documentation in the file.
- Be concise but thorough — describe purpose, parameters, and return values.
- Classify visibility accurately: exported/public = "public", private/internal/unexported = "internal".
- Do NOT wrap the response in markdown code fences.
- Return ONLY valid JSON, nothing else.`;
}

async function analyzeAndDocument(
  llm: LLMClient,
  filePath: string,
  content: string,
  config: BotConfig,
): Promise<DocInsertion[]> {
  const prompt = buildPrompt(filePath, content, config);
  const response = await llm.generate(prompt);
  const parsed = parseResponse(response);

  return parsed.map((item) => ({
    file: filePath,
    line: item.line,
    name: item.name,
    kind: item.kind,
    visibility: item.visibility === 'internal' ? 'internal' : 'public',
    signature: item.signature,
    description: item.description,
    doc: item.doc,
  }));
}

interface RawInsertion {
  line: number;
  name: string;
  kind: string;
  visibility: string;
  signature: string;
  description: string;
  doc: string;
}

function parseResponse(raw: string): RawInsertion[] {
  let cleaned = raw.trim();
  if (!cleaned) return [];

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.filter(
    (item): item is RawInsertion =>
      item != null &&
      typeof item === 'object' &&
      typeof item.line === 'number' &&
      item.line > 0 &&
      typeof item.name === 'string' &&
      typeof item.doc === 'string',
  );
}

// ---------------------------------------------------------------------------
// Apply inline doc insertions to file content
// ---------------------------------------------------------------------------

export function applyInsertions(
  insertions: DocInsertion[],
  fileContents: Map<string, string>,
): FileUpdate[] {
  const byFile = new Map<string, DocInsertion[]>();
  for (const ins of insertions) {
    const existing = byFile.get(ins.file) ?? [];
    existing.push(ins);
    byFile.set(ins.file, existing);
  }

  const updates: FileUpdate[] = [];

  for (const [file, fileInsertions] of byFile) {
    const originalContent = fileContents.get(file);
    if (!originalContent) continue;

    const lines = originalContent.split('\n');

    const sorted = [...fileInsertions]
      .filter((ins) => ins.line >= 1 && ins.line <= lines.length + 1)
      .sort((a, b) => b.line - a.line);

    for (const ins of sorted) {
      const insertIndex = Math.min(ins.line - 1, lines.length);
      const indentMatch = lines[insertIndex]?.match(/^(\s*)/);
      const indent = indentMatch?.[1] ?? '';

      const docLines = ins.doc
        .split('\n')
        .map((l) => (l.trim() === '' ? '' : indent + l))
        .join('\n');

      lines.splice(insertIndex, 0, docLines);
    }

    const updatedContent = lines.join('\n');
    if (updatedContent !== originalContent) {
      updates.push({ path: file, originalContent, updatedContent });
    }
  }

  return updates;
}

// ---------------------------------------------------------------------------
// Generate reference docs: API.md (public) + INTERNALS.md (internal)
// ---------------------------------------------------------------------------

export function generateReferenceDocs(
  insertions: DocInsertion[],
  config: BotConfig,
): FileUpdate[] {
  const dir = config.documentation.reference.output_dir;

  const publicItems = insertions.filter((i) => i.visibility === 'public');
  const internalItems = insertions.filter((i) => i.visibility === 'internal');

  const updates: FileUpdate[] = [];

  if (publicItems.length > 0) {
    updates.push({
      path: `${dir}/API.md`,
      originalContent: '',
      updatedContent: renderMarkdown(
        'Public API Reference',
        'PUBLIC',
        'These are the public-facing APIs of this project. They form the external contract and should be considered stable.',
        publicItems,
      ),
    });
  }

  if (internalItems.length > 0) {
    updates.push({
      path: `${dir}/INTERNALS.md`,
      originalContent: '',
      updatedContent: renderMarkdown(
        'Internal Reference',
        'INTERNAL',
        'These are internal implementation details. They are not part of the public API and may change without notice.',
        internalItems,
      ),
    });
  }

  return updates;
}

function renderMarkdown(
  title: string,
  badge: string,
  preamble: string,
  items: DocInsertion[],
): string {
  const lines: string[] = [
    `# ${title}`,
    '',
    `> **${badge}** — ${preamble}`,
    '',
    '---',
    '',
  ];

  // Group by source file
  const byFile = new Map<string, DocInsertion[]>();
  for (const item of items) {
    const existing = byFile.get(item.file) ?? [];
    existing.push(item);
    byFile.set(item.file, existing);
  }

  for (const [file, fileItems] of byFile) {
    lines.push(`## \`${file}\``, '');

    // Sort by line number within each file
    const sorted = [...fileItems].sort((a, b) => a.line - b.line);

    for (const item of sorted) {
      lines.push(`### ${item.name}`, '');
      lines.push(`- **Kind:** ${item.kind}`);
      lines.push(`- **Visibility:** ${item.visibility}`);
      lines.push('');

      if (item.signature) {
        lines.push('```', item.signature, '```', '');
      }

      if (item.description) {
        lines.push(item.description, '');
      }

      lines.push('---', '');
    }
  }

  lines.push(
    '',
    '*Auto-generated by [github-docs-bot](https://github.com/GeoDoo/github-docs-bot). Do not edit manually.*',
    '',
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isIgnored(filePath: string, config: BotConfig): boolean {
  return config.ignore.paths.some((pattern) => minimatch(filePath, pattern));
}

function isBinaryContent(content: string): boolean {
  const sample = content.slice(0, 8000);
  const nullCount = (sample.match(/\0/g) ?? []).length;
  return nullCount > 0;
}

export const _testExports = { parseResponse, isBinaryContent };
