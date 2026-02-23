import type { DocGap, BotConfig } from '../types/index.js';

export interface LanguageParser {
  language: string;
  extensions: string[];
  parse(content: string, filePath: string, config: BotConfig): DocGap[];
}

const parsersByExtension = new Map<string, LanguageParser>();

export function registerParser(parser: LanguageParser): void {
  for (const ext of parser.extensions) {
    parsersByExtension.set(ext, parser);
  }
}

export function getParserForFile(filename: string): LanguageParser | null {
  const ext = filename.split('.').pop() ?? '';
  return parsersByExtension.get(ext) ?? null;
}
