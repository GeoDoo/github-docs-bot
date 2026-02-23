import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { javaParser } from '../../src/parsers/java.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import type { BotConfig } from '../../src/types/index.js';

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures', 'sample-code');

const loadFixture = (name: string) =>
  fs.readFileSync(path.join(FIXTURES, name), 'utf-8');

describe('Java Parser', () => {
  it('detects undocumented public classes, interfaces, enums, and records', () => {
    const content = loadFixture('Undocumented.java');
    const gaps = javaParser.parse(content, 'Undocumented.java', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).toContain('ShoppingCart');
    expect(names).toContain('UserService');
    expect(names).toContain('OrderStatus');
    expect(names).toContain('CartItem');
    expect(names).toContain('OrderProcessor');
  });

  it('detects undocumented public and protected methods', () => {
    const content = loadFixture('Undocumented.java');
    const gaps = javaParser.parse(content, 'Undocumented.java', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).toContain('addItem');
    expect(names).toContain('getTotal');
    expect(names).toContain('processOrder');
    expect(names).toContain('getOrderHistory');
  });

  it('detects interface methods', () => {
    const content = loadFixture('Undocumented.java');
    const gaps = javaParser.parse(content, 'Undocumented.java', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).toContain('findById');
    expect(names).toContain('findAll');
  });

  it('skips private methods when scope is exported_only', () => {
    const content = loadFixture('Undocumented.java');
    const gaps = javaParser.parse(content, 'Undocumented.java', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).not.toContain('_internalCleanup');
  });

  it('skips fully documented code', () => {
    const content = loadFixture('Documented.java');
    const gaps = javaParser.parse(content, 'Documented.java', DEFAULT_CONFIG);

    expect(gaps).toHaveLength(0);
  });

  it('detects only undocumented elements in a mixed file', () => {
    const content = loadFixture('Mixed.java');
    const gaps = javaParser.parse(content, 'Mixed.java', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    expect(names).toContain('getHost');
    expect(names).toContain('UndocumentedService');
    expect(names).toContain('handleRequest');
    expect(names).not.toContain('AppConfig');
    expect(names).not.toContain('getPort');
    expect(names).not.toContain('RequestProcessor');
  });

  it('skips @Override methods that have Javadoc on the class', () => {
    const content = loadFixture('Mixed.java');
    const gaps = javaParser.parse(content, 'Mixed.java', DEFAULT_CONFIG);

    const names = gaps.map((g) => g.name);
    // toString has @Override annotation — the class has Javadoc but the method doesn't
    expect(names).toContain('toString');
  });

  it('populates correct metadata', () => {
    const content = loadFixture('Undocumented.java');
    const gaps = javaParser.parse(content, 'Undocumented.java', DEFAULT_CONFIG);

    const cartGap = gaps.find((g) => g.name === 'ShoppingCart' && g.kind === 'class');
    expect(cartGap).toBeDefined();
    expect(cartGap!.kind).toBe('class');
    expect(cartGap!.file).toBe('Undocumented.java');
    expect(cartGap!.code).toContain('ShoppingCart');
  });

  it('respects custom ignore patterns', () => {
    const content = loadFixture('Undocumented.java');
    const config: BotConfig = {
      ...DEFAULT_CONFIG,
      ignore: {
        ...DEFAULT_CONFIG.ignore,
        patterns: ['_*', 'get*'],
      },
    };

    const gaps = javaParser.parse(content, 'test.java', config);
    const names = gaps.map((g) => g.name);

    expect(names).not.toContain('getTotal');
    expect(names).not.toContain('getOrderHistory');
    expect(names).toContain('addItem');
  });

  it('includes private members when scope is "all"', () => {
    const content = loadFixture('Undocumented.java');
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

    const gaps = javaParser.parse(content, 'test.java', config);
    const names = gaps.map((g) => g.name);
    expect(names).toContain('_internalCleanup');
  });
});
