import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import type { RepoRef } from '../../src/types/index.js';

function makeRef(configYaml: string | null): RepoRef {
  return {
    owner: 'test',
    repo: 'test',
    octokit: {
      repos: {
        getContent: async () => {
          if (!configYaml) throw { status: 404 };
          return {
            data: {
              content: Buffer.from(configYaml).toString('base64'),
            },
          };
        },
      },
    },
  } as unknown as RepoRef;
}

describe('loadConfig deep merge', () => {
  it('preserves false overrides', async () => {
    const yaml = 'triggers:\n  skip_draft: false\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.triggers.skip_draft).toBe(false);
  });

  it('preserves empty string overrides', async () => {
    const yaml = 'ai:\n  custom_instructions: ""\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.ai.custom_instructions).toBe('');
  });

  it('preserves zero overrides', async () => {
    const yaml = 'bootstrap:\n  max_files_per_pr: 0\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.bootstrap.max_files_per_pr).toBe(0);
  });

  it('returns defaults when config is missing', async () => {
    const config = await loadConfig(makeRef(null), 'main');
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('merges nested config without clobbering siblings', async () => {
    const yaml = 'documentation:\n  inline:\n    scope: all\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.documentation.inline.scope).toBe('all');
    expect(config.documentation.inline.enabled).toBe(true);
    expect(config.documentation.inline.style).toBe('auto');
  });
});
