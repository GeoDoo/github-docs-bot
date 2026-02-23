import { describe, it, expect } from 'vitest';
import {
  applyInsertions,
  _testExports,
  type DocInsertion,
} from '../../src/services/documenter.js';

const { parseResponse, isBinaryContent } = _testExports;

describe('parseResponse', () => {
  it('returns empty array for empty string', () => {
    expect(parseResponse('')).toEqual([]);
  });

  it('returns empty array for whitespace-only', () => {
    expect(parseResponse('  \n  ')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseResponse('this is not json')).toEqual([]);
  });

  it('returns empty array when JSON is not an array', () => {
    expect(parseResponse('{"key": "value"}')).toEqual([]);
  });

  it('returns empty array for JSON string', () => {
    expect(parseResponse('"just a string"')).toEqual([]);
  });

  it('parses valid response', () => {
    const input = JSON.stringify([
      {
        line: 5,
        name: 'foo',
        kind: 'function',
        visibility: 'public',
        signature: 'function foo()',
        description: 'Does foo.',
        doc: '/** Does foo. */',
      },
    ]);
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('foo');
  });

  it('strips markdown code fences', () => {
    const input = '```json\n[{"line":1,"name":"x","kind":"function","visibility":"public","signature":"","description":"","doc":"/** x */"}]\n```';
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('x');
  });

  it('filters out items with invalid line numbers', () => {
    const input = JSON.stringify([
      { line: 0, name: 'bad', kind: 'function', doc: '/** */' },
      { line: -1, name: 'negative', kind: 'function', doc: '/** */' },
      { line: 5, name: 'good', kind: 'function', doc: '/** */' },
    ]);
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('good');
  });

  it('filters out items missing required fields', () => {
    const input = JSON.stringify([
      { line: 1, name: 'hasName', doc: '/** */' },
      { line: 1, doc: '/** missing name */' },
      { line: 1, name: 'noDoc' },
      { name: 'noLine', doc: '/** */' },
      null,
      42,
    ]);
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('hasName');
  });
});

describe('isBinaryContent', () => {
  it('returns false for normal text', () => {
    expect(isBinaryContent('function hello() { return 1; }')).toBe(false);
  });

  it('returns true for content with null bytes', () => {
    expect(isBinaryContent('hello\0world')).toBe(true);
  });

  it('returns false for empty content', () => {
    expect(isBinaryContent('')).toBe(false);
  });
});

describe('applyInsertions bounds checking', () => {
  it('skips insertions with out-of-bounds line numbers', () => {
    const original = 'line1\nline2';
    const fileContents = new Map([['test.ts', original]]);

    const insertions: DocInsertion[] = [
      {
        file: 'test.ts',
        line: 999,
        name: 'outOfBounds',
        kind: 'function',
        visibility: 'public',
        signature: '',
        description: '',
        doc: '/** oob */',
      },
    ];

    const updates = applyInsertions(insertions, fileContents);
    expect(updates).toHaveLength(0);
  });

  it('handles insertion at last line + 1 (append)', () => {
    const original = 'line1\nline2';
    const fileContents = new Map([['test.ts', original]]);

    const insertions: DocInsertion[] = [
      {
        file: 'test.ts',
        line: 3,
        name: 'appendEnd',
        kind: 'function',
        visibility: 'public',
        signature: '',
        description: '',
        doc: '/** appended */',
      },
    ];

    const updates = applyInsertions(insertions, fileContents);
    expect(updates).toHaveLength(1);
    expect(updates[0].updatedContent).toContain('/** appended */');
  });
});
