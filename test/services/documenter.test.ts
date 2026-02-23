import { describe, it, expect } from 'vitest';
import { applyInsertions, type DocInsertion } from '../../src/services/documenter.js';

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
        doc: '/**\n * Says hello.\n */',
      },
    ];

    const updates = applyInsertions(insertions, fileContents);

    expect(updates).toHaveLength(1);
    expect(updates[0].updatedContent).toContain('/**');
    expect(updates[0].updatedContent).toContain('Says hello.');

    const lines = updates[0].updatedContent.split('\n');
    expect(lines[0]).toContain('/**');
    expect(
      lines.findIndex((l) => l.includes('export function hello')),
    ).toBe(3);
  });

  it('handles multiple insertions in the same file without index drift', () => {
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
        doc: '/** Doc A */',
      },
      {
        file: 'test.ts',
        line: 2,
        name: 'b',
        kind: 'function',
        doc: '/** Doc B */',
      },
    ];

    const updates = applyInsertions(insertions, fileContents);

    expect(updates).toHaveLength(1);
    const content = updates[0].updatedContent;
    expect(content).toContain('Doc A');
    expect(content).toContain('Doc B');

    const idxA = content.indexOf('Doc A');
    const idxFnA = content.indexOf('export function a');
    const idxB = content.indexOf('Doc B');
    const idxFnB = content.indexOf('export function b');

    expect(idxA).toBeLessThan(idxFnA);
    expect(idxB).toBeLessThan(idxFnB);
  });

  it('preserves indentation from the target line', () => {
    const original = [
      'class Foo {',
      '    public bar(): void {}',
      '}',
    ].join('\n');

    const fileContents = new Map([['test.java', original]]);

    const insertions: DocInsertion[] = [
      {
        file: 'test.java',
        line: 2,
        name: 'bar',
        kind: 'method',
        doc: '/**\n * Does bar.\n */',
      },
    ];

    const updates = applyInsertions(insertions, fileContents);
    const lines = updates[0].updatedContent.split('\n');

    expect(lines[1]).toBe('    /**');
    expect(lines[2]).toBe('     * Does bar.');
    expect(lines[3]).toBe('     */');
  });

  it('handles insertions across multiple files', () => {
    const fileContents = new Map([
      ['a.ts', 'export function a(): void {}'],
      ['b.py', 'def b():\n    pass'],
    ]);

    const insertions: DocInsertion[] = [
      { file: 'a.ts', line: 1, name: 'a', kind: 'function', doc: '/** A */' },
      { file: 'b.py', line: 1, name: 'b', kind: 'function', doc: '"""B."""' },
    ];

    const updates = applyInsertions(insertions, fileContents);

    expect(updates).toHaveLength(2);
    expect(updates.find((u) => u.path === 'a.ts')!.updatedContent).toContain('/** A */');
    expect(updates.find((u) => u.path === 'b.py')!.updatedContent).toContain('"""B."""');
  });

  it('returns empty when no insertions are provided', () => {
    const fileContents = new Map([['test.ts', 'const x = 1;']]);
    const updates = applyInsertions([], fileContents);
    expect(updates).toHaveLength(0);
  });
});
