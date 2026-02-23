import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pythonParser } from '../../src/parsers/python.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import type { BotConfig } from '../../src/types/index.js';

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures', 'sample-code');

const loadFixture = (name: string) =>
  fs.readFileSync(path.join(FIXTURES, name), 'utf-8');

describe('Python Parser', () => {
  it('detects undocumented top-level functions and classes', () => {
    const content = loadFixture('undocumented.py');
    const gaps = pythonParser.parse(content, 'undocumented.py', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).toContain('ShoppingCart');
    expect(names).toContain('calculate_total');
    expect(names).toContain('fetch_user_profile');
  });

  it('skips private functions when scope is exported_only', () => {
    const content = loadFixture('undocumented.py');
    const gaps = pythonParser.parse(content, 'undocumented.py', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).not.toContain('_internal_helper');
  });

  it('skips indented methods when scope is exported_only', () => {
    const content = loadFixture('undocumented.py');
    const gaps = pythonParser.parse(content, 'undocumented.py', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).not.toContain('__init__');
    expect(names).not.toContain('add_item');
    expect(names).not.toContain('get_total');
  });

  it('skips documented functions and classes', () => {
    const content = loadFixture('documented.py');
    const gaps = pythonParser.parse(content, 'documented.py', DEFAULT_CONFIG);

    expect(gaps).toHaveLength(0);
  });

  it('populates correct metadata', () => {
    const content = loadFixture('undocumented.py');
    const gaps = pythonParser.parse(content, 'undocumented.py', DEFAULT_CONFIG);

    const calcGap = gaps.find((g) => g.name === 'calculate_total');
    expect(calcGap).toBeDefined();
    expect(calcGap!.kind).toBe('function');
    expect(calcGap!.file).toBe('undocumented.py');
    expect(calcGap!.code).toContain('calculate_total');
  });

  it('includes private functions when scope is "all" and patterns allow it', () => {
    const content = loadFixture('undocumented.py');
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

    const gaps = pythonParser.parse(content, 'test.py', config);
    const names = gaps.map((g) => g.name);
    expect(names).toContain('_internal_helper');
  });
});
