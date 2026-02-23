import type { DocGap, BotConfig } from '../types/index.js';
import type { LanguageParser } from './index.js';

interface PatternDef {
  regex: RegExp;
  kind: DocGap['kind'];
}

// Matches public/protected classes, interfaces, enums, and records
const PUBLIC_TYPE_PATTERNS: PatternDef[] = [
  {
    regex:
      /^[ \t]*(public\s+(?:abstract\s+|final\s+)?class\s+(\w+)(?:\s*<[^>]*>)?(?:\s+extends\s+\w+(?:<[^>]*>)?)?(?:\s+implements\s+[^{]+)?)\s*\{/gm,
    kind: 'class',
  },
  {
    regex:
      /^[ \t]*(public\s+interface\s+(\w+)(?:\s*<[^>]*>)?(?:\s+extends\s+[^{]+)?)\s*\{/gm,
    kind: 'interface',
  },
  {
    regex:
      /^[ \t]*(public\s+enum\s+(\w+)(?:\s+implements\s+[^{]+)?)\s*\{/gm,
    kind: 'class',
  },
  {
    regex:
      /^[ \t]*(public\s+record\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s+implements\s+[^{]+)?)\s*\{/gm,
    kind: 'class',
  },
];

// Matches public/protected methods and interface method declarations
const PUBLIC_METHOD_PATTERNS: PatternDef[] = [
  {
    regex:
      /^[ \t]*((?:public|protected)\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:abstract\s+)?(?:<[^>]*>\s+)?(?:\w+(?:<[^>]*>)?(?:\[\])*)\s+(\w+)\s*\([^)]*\)(?:\s+throws\s+[^{;]+)?)\s*[{;]/gm,
    kind: 'method',
  },
  // Interface methods: no access modifier, return type + name + params + semicolon
  {
    regex:
      /^[ \t]+((?:\w+(?:<[^>]*>)?(?:\[\])*)\s+(\w+)\s*\([^)]*\)(?:\s+throws\s+[^{;]+)?)\s*;/gm,
    kind: 'method',
  },
];

// Broader patterns for scope: "all"
const ALL_TYPE_PATTERNS: PatternDef[] = [
  {
    regex:
      /^[ \t]*((?:public\s+|protected\s+|private\s+)?(?:abstract\s+|final\s+)?class\s+(\w+)(?:\s*<[^>]*>)?(?:\s+extends\s+\w+(?:<[^>]*>)?)?(?:\s+implements\s+[^{]+)?)\s*\{/gm,
    kind: 'class',
  },
  {
    regex:
      /^[ \t]*((?:public\s+|protected\s+|private\s+)?interface\s+(\w+)(?:\s*<[^>]*>)?(?:\s+extends\s+[^{]+)?)\s*\{/gm,
    kind: 'interface',
  },
  {
    regex:
      /^[ \t]*((?:public\s+|protected\s+|private\s+)?enum\s+(\w+)(?:\s+implements\s+[^{]+)?)\s*\{/gm,
    kind: 'class',
  },
];

const ALL_METHOD_PATTERNS: PatternDef[] = [
  {
    regex:
      /^[ \t]*((?:public\s+|protected\s+|private\s+)?(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:abstract\s+)?(?:<[^>]*>\s+)?(?:\w+(?:<[^>]*>)?(?:\[\])*)\s+(\w+)\s*\([^)]*\)(?:\s+throws\s+[^{;]+)?)\s*[{;]/gm,
    kind: 'method',
  },
];

function hasJavadoc(content: string, matchIndex: number): boolean {
  const before = content.substring(0, matchIndex);
  // Trim trailing annotations like @Override, @Deprecated, etc.
  const trimmed = before.replace(/(?:\s*@\w+(?:\([^)]*\))?\s*)+$/, '').trimEnd();
  return /\/\*\*[\s\S]*?\*\/\s*$/.test(trimmed);
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

export const javaParser: LanguageParser = {
  language: 'java',
  extensions: ['java'],

  parse(content: string, filePath: string, config: BotConfig): DocGap[] {
    const gaps: DocGap[] = [];
    const exportedOnly = config.documentation.inline.scope === 'exported_only';

    const typePatterns = exportedOnly
      ? PUBLIC_TYPE_PATTERNS
      : [...PUBLIC_TYPE_PATTERNS, ...ALL_TYPE_PATTERNS];
    const methodPatterns = exportedOnly
      ? PUBLIC_METHOD_PATTERNS
      : [...PUBLIC_METHOD_PATTERNS, ...ALL_METHOD_PATTERNS];

    const allPatterns = [...typePatterns, ...methodPatterns];
    const skipPredicates = buildSkipPredicates(config.ignore.patterns);
    const seen = new Set<string>();

    for (const { regex, kind } of allPatterns) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        const name = match[2];
        const key = `${name}:${match.index}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (skipPredicates.some((p) => p.test(name))) continue;

        if (!hasJavadoc(content, match.index)) {
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
