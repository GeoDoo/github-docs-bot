import { describe, it, expect } from 'vitest';
import { resolveParentSha } from '../../src/services/committer.js';

const BOT_MARKER = '[github-docs-bot]';

describe('resolveParentSha', () => {
  it('returns latest SHA when strategy is not amend', () => {
    const latest = {
      sha: 'abc123',
      parentSha: 'parent0',
      message: `docs: update ${BOT_MARKER}`,
    };
    expect(resolveParentSha(latest, 'append')).toBe('abc123');
  });

  it('returns parent SHA when amending a bot commit', () => {
    const latest = {
      sha: 'abc123',
      parentSha: 'parent0',
      message: `docs: auto-update documentation ${BOT_MARKER}`,
    };
    expect(resolveParentSha(latest, 'amend')).toBe('parent0');
  });

  it('returns latest SHA when latest is not a bot commit', () => {
    const latest = {
      sha: 'abc123',
      parentSha: 'parent0',
      message: 'feat: add user login',
    };
    expect(resolveParentSha(latest, 'amend')).toBe('abc123');
  });

  it('returns latest SHA when parentSha is empty (initial commit)', () => {
    const latest = {
      sha: 'abc123',
      parentSha: '',
      message: `docs: update ${BOT_MARKER}`,
    };
    expect(resolveParentSha(latest, 'amend')).toBe('abc123');
  });
});
