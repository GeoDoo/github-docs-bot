import { describe, it, expect } from 'vitest';
import { applyDocs } from '../../src/services/generator.js';
import type { GeneratedDoc } from '../../src/types/index.js';

describe('applyDocs', () => {
  it('inserts documentation before the target line', () => {
    const original = [
      'export function hello(): void {',
      '  console.log("hello");',
      '}',
    ].join('\n');

    const fileContents = new Map([['test.ts', original]]);

    const docs: GeneratedDoc[] = [
      {
        gap: {
          file: 'test.ts',
          name: 'hello',
          kind: 'function',
          startLine: 1,
          endLine: 3,
          code: original,
        },
        documentation: '/**\n * Says hello.\n */',
      },
    ];

    const updates = applyDocs(docs, fileContents);

    expect(updates).toHaveLength(1);
    expect(updates[0].updatedContent).toContain('/**');
    expect(updates[0].updatedContent).toContain('Says hello.');
    expect(updates[0].updatedContent).toContain('export function hello');

    const lines = updates[0].updatedContent.split('\n');
    expect(lines[0]).toContain('/**');
    expect(lines.findIndex((l) => l.includes('export function hello'))).toBe(3);
  });

  it('handles multiple gaps in the same file without shifting errors', () => {
    const original = [
      'export function a(): void {}',
      'export function b(): void {}',
    ].join('\n');

    const fileContents = new Map([['test.ts', original]]);

    const docs: GeneratedDoc[] = [
      {
        gap: {
          file: 'test.ts',
          name: 'a',
          kind: 'function',
          startLine: 1,
          endLine: 1,
          code: 'export function a(): void {}',
        },
        documentation: '/** Doc A */',
      },
      {
        gap: {
          file: 'test.ts',
          name: 'b',
          kind: 'function',
          startLine: 2,
          endLine: 2,
          code: 'export function b(): void {}',
        },
        documentation: '/** Doc B */',
      },
    ];

    const updates = applyDocs(docs, fileContents);

    expect(updates).toHaveLength(1);
    const content = updates[0].updatedContent;
    expect(content).toContain('Doc A');
    expect(content).toContain('Doc B');

    // Doc A should come before function a, Doc B before function b
    const idxA = content.indexOf('Doc A');
    const idxFnA = content.indexOf('export function a');
    const idxB = content.indexOf('Doc B');
    const idxFnB = content.indexOf('export function b');

    expect(idxA).toBeLessThan(idxFnA);
    expect(idxB).toBeLessThan(idxFnB);
  });

  it('returns empty when generated docs produce no changes', () => {
    const fileContents = new Map([['test.ts', 'const x = 1;']]);
    const updates = applyDocs([], fileContents);
    expect(updates).toHaveLength(0);
  });
});
