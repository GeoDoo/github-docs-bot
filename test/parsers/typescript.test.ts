import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { typescriptParser } from '../../src/parsers/typescript.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import type { BotConfig } from '../../src/types/index.js';

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures', 'sample-code');

const loadFixture = (name: string) =>
  fs.readFileSync(path.join(FIXTURES, name), 'utf-8');

describe('TypeScript Parser', () => {
  it('detects all undocumented exported elements', () => {
    const content = loadFixture('undocumented.ts');
    const gaps = typescriptParser.parse(content, 'undocumented.ts', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).toContain('calculateTotal');
    expect(names).toContain('fetchUserProfile');
    expect(names).toContain('ShoppingCart');
    expect(names).toContain('UserProfile');
    expect(names).toContain('CartItem');
  });

  it('skips private/internal functions when scope is exported_only', () => {
    const content = loadFixture('undocumented.ts');
    const gaps = typescriptParser.parse(content, 'undocumented.ts', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).not.toContain('_internalHelper');
  });

  it('skips already documented elements', () => {
    const content = loadFixture('documented.ts');
    const gaps = typescriptParser.parse(content, 'documented.ts', DEFAULT_CONFIG);

    expect(gaps).toHaveLength(0);
  });

  it('detects only undocumented elements in a mixed file', () => {
    const content = loadFixture('mixed.ts');
    const gaps = typescriptParser.parse(content, 'mixed.ts', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).toContain('undocumented');
    expect(names).toContain('UndocumentedConfig');
    expect(names).not.toContain('documented');
    expect(names).not.toContain('AppConfig');
  });

  it('populates correct metadata for each gap', () => {
    const content = loadFixture('undocumented.ts');
    const gaps = typescriptParser.parse(content, 'undocumented.ts', DEFAULT_CONFIG);

    const calcGap = gaps.find((g) => g.name === 'calculateTotal');
    expect(calcGap).toBeDefined();
    expect(calcGap!.kind).toBe('function');
    expect(calcGap!.file).toBe('undocumented.ts');
    expect(calcGap!.startLine).toBe(1);
    expect(calcGap!.code).toContain('calculateTotal');
  });

  it('respects custom ignore patterns', () => {
    const content = loadFixture('undocumented.ts');
    const config: BotConfig = {
      ...DEFAULT_CONFIG,
      ignore: {
        ...DEFAULT_CONFIG.ignore,
        patterns: ['_*', 'fetch*'],
      },
    };

    const gaps = typescriptParser.parse(content, 'test.ts', config);
    const names = gaps.map((g) => g.name);

    expect(names).not.toContain('fetchUserProfile');
    expect(names).not.toContain('_internalHelper');
    expect(names).toContain('calculateTotal');
  });

  it('includes non-exported elements when scope is "all"', () => {
    const content = loadFixture('undocumented.ts');
    const config: BotConfig = {
      ...DEFAULT_CONFIG,
      documentation: {
        ...DEFAULT_CONFIG.documentation,
        inline: {
          ...DEFAULT_CONFIG.documentation.inline,
          scope: 'all',
        },
      },
      ignore: { paths: [], patterns: [] },
    };

    const gaps = typescriptParser.parse(content, 'test.ts', config);
    const names = gaps.map((g) => g.name);
    expect(names).toContain('_internalHelper');
  });
});
