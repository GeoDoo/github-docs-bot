import type { DocGap, BotConfig } from '../types/index.js';
import type { LanguageParser } from './index.js';

const FUNCTION_PATTERN =
  /^( *)((?:async )?def (\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?)\s*:/gm;

const CLASS_PATTERN = /^( *)(class (\w+)(?:\([^)]*\))?)\s*:/gm;

function hasDocstring(
  content: string,
  matchIndex: number,
  matchLength: number,
): boolean {
  const after = content.substring(matchIndex + matchLength);
  return /^\s*\n\s*(?:"""|''')/.test(after);
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

function extractPythonBlock(content: string, startIndex: number): string {
  const lines = content.substring(startIndex).split('\n');
  const result: string[] = [lines[0]];

  if (lines.length <= 1) return result[0];

  const baseIndentMatch = lines[1]?.match(/^(\s+)/);
  if (!baseIndentMatch) return result.join('\n');

  const baseIndent = baseIndentMatch[1].length;

  for (let i = 1; i < lines.length && i < 50; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      result.push(line);
      continue;
    }
    const indentMatch = line.match(/^(\s*)/);
    if (indentMatch && indentMatch[1].length >= baseIndent) {
      result.push(line);
    } else {
      break;
    }
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

export const pythonParser: LanguageParser = {
  language: 'python',
  extensions: ['py'],

  parse(content: string, filePath: string, config: BotConfig): DocGap[] {
    const gaps: DocGap[] = [];
    const isExportedOnly =
      config.documentation.inline.scope === 'exported_only';
    const skipPredicates = buildSkipPredicates(config.ignore.patterns);

    const patterns: Array<{ regex: RegExp; kind: DocGap['kind'] }> = [
      { regex: FUNCTION_PATTERN, kind: 'function' },
      { regex: CLASS_PATTERN, kind: 'class' },
    ];

    for (const { regex, kind } of patterns) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        const indent = match[1];
        const name = match[3];

        // In Python, "exported" means top-level and not starting with _
        if (isExportedOnly) {
          if (indent.length > 0) continue;
          if (name.startsWith('_')) continue;
        }

        if (skipPredicates.some((p) => p.test(name))) continue;

        if (!hasDocstring(content, match.index, match[0].length)) {
          const startLine = getLineNumber(content, match.index);
          const code = extractPythonBlock(content, match.index);
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
