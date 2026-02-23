import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

describe('Default Config', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_CONFIG.triggers.skip_draft).toBe(true);
    expect(DEFAULT_CONFIG.documentation.inline.enabled).toBe(true);
    expect(DEFAULT_CONFIG.documentation.inline.scope).toBe('exported_only');
    expect(DEFAULT_CONFIG.ai.provider).toBe('anthropic');
    expect(DEFAULT_CONFIG.check.conclusion_on_missing).toBe('neutral');
    expect(DEFAULT_CONFIG.commit.strategy).toBe('amend');
  });

  it('ignores test files by default', () => {
    expect(DEFAULT_CONFIG.ignore.paths).toContain('**/*.test.ts');
    expect(DEFAULT_CONFIG.ignore.paths).toContain('**/*.spec.ts');
    expect(DEFAULT_CONFIG.ignore.paths).toContain('**/__tests__/**');
  });

  it('ignores private functions by default', () => {
    expect(DEFAULT_CONFIG.ignore.patterns).toContain('_*');
  });

  it('has bootstrap enabled by default', () => {
    expect(DEFAULT_CONFIG.bootstrap.enabled).toBe(true);
    expect(DEFAULT_CONFIG.bootstrap.max_files_per_pr).toBe(50);
    expect(DEFAULT_CONFIG.bootstrap.branch).toBe('docs/initial-documentation');
  });
});
