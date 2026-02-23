import { describe, it, expect } from 'vitest';
import {
  applyInsertions,
  generateReferenceDocs,
  type DocInsertion,
} from '../../src/services/documenter.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

describe('applyInsertions', () => {
  it('inserts documentation before the target line', () => {
    const original = [
      'export function hello(): void {',
      '  console.log("hello");',
      '}',
    ].join('\n');

    const fileContents = new Map([['test.ts', original]]);

    const insertions: DocInsertion[] = [
      {
        file: 'test.ts',
        line: 1,
        name: 'hello',
        kind: 'function',
        visibility: 'public',
        signature: 'export function hello(): void',
        description: 'Says hello.',
        doc: '/**\n * Says hello.\n */',
      },
    ];

    const updates = applyInsertions(insertions, fileContents);

    expect(updates).toHaveLength(1);
    expect(updates[0].updatedContent).toContain('Says hello.');
    const lines = updates[0].updatedContent.split('\n');
    expect(lines[0]).toContain('/**');
    expect(
      lines.findIndex((l) => l.includes('export function hello')),
    ).toBe(3);
  });

  it('handles multiple insertions without index drift', () => {
    const original = [
      'export function a(): void {}',
      'export function b(): void {}',
    ].join('\n');

    const fileContents = new Map([['test.ts', original]]);

    const insertions: DocInsertion[] = [
      {
        file: 'test.ts',
        line: 1,
        name: 'a',
        kind: 'function',
        visibility: 'public',
        signature: 'export function a(): void',
        description: 'Function A.',
        doc: '/** Doc A */',
      },
      {
        file: 'test.ts',
        line: 2,
        name: 'b',
        kind: 'function',
        visibility: 'internal',
        signature: 'export function b(): void',
        description: 'Function B.',
        doc: '/** Doc B */',
      },
    ];

    const updates = applyInsertions(insertions, fileContents);
    const content = updates[0].updatedContent;

    expect(content.indexOf('Doc A')).toBeLessThan(
      content.indexOf('export function a'),
    );
    expect(content.indexOf('Doc B')).toBeLessThan(
      content.indexOf('export function b'),
    );
  });

  it('returns empty when no insertions', () => {
    const fileContents = new Map([['test.ts', 'const x = 1;']]);
    expect(applyInsertions([], fileContents)).toHaveLength(0);
  });
});

describe('generateReferenceDocs', () => {
  const makeInsertion = (
    overrides: Partial<DocInsertion>,
  ): DocInsertion => ({
    file: 'src/index.ts',
    line: 1,
    name: 'test',
    kind: 'function',
    visibility: 'public',
    signature: 'function test(): void',
    description: 'A test function.',
    doc: '/** test */',
    ...overrides,
  });

  it('generates API.md for public items', () => {
    const insertions: DocInsertion[] = [
      makeInsertion({ name: 'createUser', visibility: 'public' }),
    ];

    const updates = generateReferenceDocs(insertions, DEFAULT_CONFIG);
    const apiFile = updates.find((u) => u.path === 'docs/API.md');

    expect(apiFile).toBeDefined();
    expect(apiFile!.updatedContent).toContain('# Public API Reference');
    expect(apiFile!.updatedContent).toContain('### createUser');
    expect(apiFile!.updatedContent).toContain('**PUBLIC**');
  });

  it('generates INTERNALS.md for internal items', () => {
    const insertions: DocInsertion[] = [
      makeInsertion({ name: '_helper', visibility: 'internal' }),
    ];

    const updates = generateReferenceDocs(insertions, DEFAULT_CONFIG);
    const internalsFile = updates.find((u) => u.path === 'docs/INTERNALS.md');

    expect(internalsFile).toBeDefined();
    expect(internalsFile!.updatedContent).toContain('# Internal Reference');
    expect(internalsFile!.updatedContent).toContain('### _helper');
    expect(internalsFile!.updatedContent).toContain('**INTERNAL**');
  });

  it('generates both files when items have mixed visibility', () => {
    const insertions: DocInsertion[] = [
      makeInsertion({ name: 'publicFn', visibility: 'public' }),
      makeInsertion({ name: '_privateFn', visibility: 'internal' }),
    ];

    const updates = generateReferenceDocs(insertions, DEFAULT_CONFIG);

    expect(updates).toHaveLength(2);
    expect(updates.find((u) => u.path === 'docs/API.md')).toBeDefined();
    expect(updates.find((u) => u.path === 'docs/INTERNALS.md')).toBeDefined();
  });

  it('skips API.md when no public items exist', () => {
    const insertions: DocInsertion[] = [
      makeInsertion({ visibility: 'internal' }),
    ];

    const updates = generateReferenceDocs(insertions, DEFAULT_CONFIG);

    expect(updates.find((u) => u.path === 'docs/API.md')).toBeUndefined();
    expect(updates.find((u) => u.path === 'docs/INTERNALS.md')).toBeDefined();
  });

  it('respects custom output_dir', () => {
    const config = {
      ...DEFAULT_CONFIG,
      documentation: {
        ...DEFAULT_CONFIG.documentation,
        reference: { enabled: true, output_dir: 'reference' },
      },
    };

    const insertions: DocInsertion[] = [
      makeInsertion({ visibility: 'public' }),
    ];

    const updates = generateReferenceDocs(insertions, config);

    expect(updates[0].path).toBe('reference/API.md');
  });

  it('groups items by source file', () => {
    const insertions: DocInsertion[] = [
      makeInsertion({ file: 'src/auth.ts', name: 'login', visibility: 'public' }),
      makeInsertion({ file: 'src/auth.ts', name: 'logout', visibility: 'public' }),
      makeInsertion({ file: 'src/users.ts', name: 'getUser', visibility: 'public' }),
    ];

    const updates = generateReferenceDocs(insertions, DEFAULT_CONFIG);
    const apiContent = updates.find((u) => u.path === 'docs/API.md')!.updatedContent;

    expect(apiContent).toContain('## `src/auth.ts`');
    expect(apiContent).toContain('## `src/users.ts`');
    expect(apiContent).toContain('### login');
    expect(apiContent).toContain('### logout');
    expect(apiContent).toContain('### getUser');
  });

  it('includes signature and description in output', () => {
    const insertions: DocInsertion[] = [
      makeInsertion({
        name: 'calculate',
        signature: 'function calculate(x: number): number',
        description: 'Performs a calculation.',
        visibility: 'public',
      }),
    ];

    const updates = generateReferenceDocs(insertions, DEFAULT_CONFIG);
    const content = updates[0].updatedContent;

    expect(content).toContain('function calculate(x: number): number');
    expect(content).toContain('Performs a calculation.');
  });
});
