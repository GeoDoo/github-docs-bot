import type { DocGap, BotConfig } from '../types/index.js';
import type { LanguageParser } from './index.js';

interface PatternDef {
  regex: RegExp;
  kind: DocGap['kind'];
}

const EXPORT_PATTERNS: PatternDef[] = [
  {
    regex:
      /^export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/gm,
    kind: 'function',
  },
  {
    regex:
      /^export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*(?::\s*[^=]+)?\s*=>/gm,
    kind: 'function',
  },
  {
    regex:
      /^export\s+(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[^{]+)?\s*\{/gm,
    kind: 'class',
  },
  {
    regex:
      /^export\s+interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*\{/gm,
    kind: 'interface',
  },
  {
    regex: /^export\s+type\s+(\w+)(?:\s*<[^>]*>)?\s*=/gm,
    kind: 'type',
  },
];

const ALL_PATTERNS: PatternDef[] = [
  {
    regex:
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/gm,
    kind: 'function',
  },
  {
    regex:
      /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[^{]+)?\s*\{/gm,
    kind: 'class',
  },
];

function hasDocComment(content: string, matchIndex: number): boolean {
  const before = content.substring(0, matchIndex).trimEnd();
  return /\/\*\*[\s\S]*?\*\/\s*$/.test(before);
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

function extractCodeBlock(content: string, startIndex: number): string {
  const lines = content.substring(startIndex).split('\n');
  let braceCount = 0;
  let started = false;
  const result: string[] = [];

  for (const line of lines) {
    result.push(line);
    for (const ch of line) {
      if (ch === '{') {
        braceCount++;
        started = true;
      }
      if (ch === '}') braceCount--;
    }
    if (started && braceCount <= 0) break;
    if (result.length > 50) break;
  }

  return result.join('\n');
}

function buildSkipPredicates(patterns: string[]): RegExp[] {
  return patterns.map((p) => {
    if (p.endsWith('*')) return new RegExp(`^${p.slice(0, -1)}`);
    if (p.startsWith('*')) return new RegExp(`${p.slice(1)}$`);
    return new RegExp(`^${p}$`);
  });
}

export const typescriptParser: LanguageParser = {
  language: 'typescript',
  extensions: ['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'],

  parse(content: string, filePath: string, config: BotConfig): DocGap[] {
    const gaps: DocGap[] = [];
    const patterns =
      config.documentation.inline.scope === 'exported_only'
        ? EXPORT_PATTERNS
        : [...EXPORT_PATTERNS, ...ALL_PATTERNS];
    const skipPredicates = buildSkipPredicates(config.ignore.patterns);
    const seen = new Set<string>();

    for (const { regex, kind } of patterns) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        const name = match[1];
        const key = `${name}:${match.index}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (skipPredicates.some((p) => p.test(name))) continue;

        if (!hasDocComment(content, match.index)) {
          const startLine = getLineNumber(content, match.index);
          const code = extractCodeBlock(content, match.index);
          const endLine = startLine + code.split('\n').length - 1;

          gaps.push({
            file: filePath,
            name,
            kind,
            startLine,
            endLine,
            code,
          });
        }
      }
    }

    return gaps;
  },
};
