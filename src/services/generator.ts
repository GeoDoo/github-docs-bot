import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { BotConfig, DocGap, GeneratedDoc, FileUpdate } from '../types/index.js';

// ---------------------------------------------------------------------------
// LLM abstraction
// ---------------------------------------------------------------------------

interface LLMClient {
  generate(prompt: string): Promise<string>;
}

function createAnthropicClient(config: BotConfig): LLMClient {
  const client = new Anthropic();

  return {
    async generate(prompt: string): Promise<string> {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const block = response.content[0];
      return block.type === 'text' ? block.text : '';
    },
  };
}

function createOpenAIClient(config: BotConfig): LLMClient {
  const client = new OpenAI();

  return {
    async generate(prompt: string): Promise<string> {
      const response = await client.chat.completions.create({
        model: config.ai.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.choices[0]?.message?.content ?? '';
    },
  };
}

function createClient(config: BotConfig): LLMClient {
  switch (config.ai.provider) {
    case 'anthropic':
      return createAnthropicClient(config);
    case 'openai':
      return createOpenAIClient(config);
    default:
      throw new Error(`Unknown AI provider: ${config.ai.provider}`);
  }
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const STYLE_GUIDES: Record<string, string> = {
  jsdoc: `Use JSDoc format:
/**
 * Brief description.
 * @param paramName - Description
 * @returns Description
 */`,
  google: `Use Google-style JSDoc:
/**
 * Brief description.
 *
 * @param {type} paramName Description
 * @return {type} Description
 */`,
  numpy: `Use NumPy docstring format:
"""Brief description.

Parameters
----------
param_name : type
    Description

Returns
-------
type
    Description
"""`,
  rustdoc: `Use rustdoc format:
/// Brief description.
///
/// # Arguments
///
/// * \`param_name\` - Description
///
/// # Returns
///
/// Description`,
};

function buildPrompt(
  gaps: DocGap[],
  fileContent: string,
  config: BotConfig,
): string {
  const style = STYLE_GUIDES[config.documentation.inline.style] ?? STYLE_GUIDES.jsdoc;
  const customInstructions = config.ai.custom_instructions
    ? `\nAdditional instructions from the repository maintainer:\n${config.ai.custom_instructions}\n`
    : '';

  const gapDescriptions = gaps
    .map(
      (g) =>
        `- ${g.kind} \`${g.name}\` at line ${g.startLine}:\n\`\`\`\n${g.code}\n\`\`\``,
    )
    .join('\n\n');

  return `You are a precise documentation generator. Generate documentation comments for the following undocumented code elements.

Documentation style:
${style}
${customInstructions}
Here is the full file for context:
\`\`\`
${fileContent}
\`\`\`

Generate documentation for these undocumented elements:

${gapDescriptions}

RULES:
- Return ONLY a JSON array of objects with "name" and "doc" fields.
- "name" must match the element name exactly.
- "doc" must be the complete documentation comment including delimiters (/** */ for JS/TS, """ """ for Python).
- Match the tone and style of any existing documentation in the file.
- Be concise but thorough.
- Do NOT wrap the JSON in markdown code fences.

Example response:
[{"name": "myFunction", "doc": "/**\\n * Brief description.\\n * @param x - The input value\\n * @returns The computed result\\n */"}]`;
}

// ---------------------------------------------------------------------------
// Generation pipeline
// ---------------------------------------------------------------------------

const MAX_GAPS_PER_LLM_CALL = 12;

export async function generateDocs(
  gaps: DocGap[],
  fileContents: Map<string, string>,
  config: BotConfig,
): Promise<GeneratedDoc[]> {
  const client = createClient(config);
  const results: GeneratedDoc[] = [];

  const gapsByFile = new Map<string, DocGap[]>();
  for (const gap of gaps) {
    const existing = gapsByFile.get(gap.file) ?? [];
    existing.push(gap);
    gapsByFile.set(gap.file, existing);
  }

  for (const [file, fileGaps] of gapsByFile) {
    const content = fileContents.get(file);
    if (!content) continue;

    for (let i = 0; i < fileGaps.length; i += MAX_GAPS_PER_LLM_CALL) {
      const batch = fileGaps.slice(i, i + MAX_GAPS_PER_LLM_CALL);
      const prompt = buildPrompt(batch, content, config);

      try {
        const response = await client.generate(prompt);
        const parsed = parseResponse(response);

        for (const item of parsed) {
          const gap = batch.find((g) => g.name === item.name);
          if (gap) {
            results.push({ gap, documentation: item.doc });
          }
        }
      } catch (error) {
        console.error(`Failed to generate docs for ${file}:`, error);
      }
    }
  }

  return results;
}

function parseResponse(raw: string): Array<{ name: string; doc: string }> {
  let cleaned = raw.trim();

  // Strip markdown code fences if the LLM wrapped them anyway
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// Apply generated docs to file content
// ---------------------------------------------------------------------------

export function applyDocs(
  generatedDocs: GeneratedDoc[],
  fileContents: Map<string, string>,
): FileUpdate[] {
  const updatesByFile = new Map<string, GeneratedDoc[]>();

  for (const doc of generatedDocs) {
    const existing = updatesByFile.get(doc.gap.file) ?? [];
    existing.push(doc);
    updatesByFile.set(doc.gap.file, existing);
  }

  const updates: FileUpdate[] = [];

  for (const [file, docs] of updatesByFile) {
    const originalContent = fileContents.get(file);
    if (!originalContent) continue;

    const lines = originalContent.split('\n');

    // Sort by line number descending so insertions don't shift subsequent indices
    const sorted = [...docs].sort(
      (a, b) => b.gap.startLine - a.gap.startLine,
    );

    for (const doc of sorted) {
      const insertIndex = doc.gap.startLine - 1;
      const indentMatch = lines[insertIndex]?.match(/^(\s*)/);
      const indent = indentMatch?.[1] ?? '';

      const docLines = doc.documentation
        .split('\n')
        .map((line) => (line.trim() === '' ? indent + ' *' : indent + line))
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
