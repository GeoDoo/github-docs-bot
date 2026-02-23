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

describe('Config validation', () => {
  it('accepts valid overrides', async () => {
    const yaml = 'ai:\n  provider: openai\n  model: gpt-4\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.ai.provider).toBe('openai');
    expect(config.ai.model).toBe('gpt-4');
  });

  it('rejects invalid provider and falls back to defaults', async () => {
    const yaml = 'ai:\n  provider: gemini\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.ai.provider).toBe('anthropic');
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('rejects invalid strategy and falls back to defaults', async () => {
    const yaml = 'commit:\n  strategy: squash\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.commit.strategy).toBe('amend');
  });

  it('rejects negative max_files_per_pr and falls back to defaults', async () => {
    const yaml = 'bootstrap:\n  max_files_per_pr: -5\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.bootstrap.max_files_per_pr).toBe(50);
  });

  it('rejects non-string model and falls back to defaults', async () => {
    const yaml = 'ai:\n  model: 123\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.ai.model).toBe(DEFAULT_CONFIG.ai.model);
  });

  it('accepts valid style values', async () => {
    const yaml = 'documentation:\n  inline:\n    style: javadoc\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.documentation.inline.style).toBe('javadoc');
  });

  it('rejects invalid style values', async () => {
    const yaml = 'documentation:\n  inline:\n    style: doxygen\n';
    const config = await loadConfig(makeRef(yaml), 'main');
    expect(config.documentation.inline.style).toBe('auto');
  });
});
