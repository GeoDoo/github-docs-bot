import yaml from 'js-yaml';
import type { Context } from 'probot';
import type { BotConfig } from '../types/index.js';
import { DEFAULT_CONFIG } from './defaults.js';

const CONFIG_PATH = '.github/docs-bot.yml';

export async function loadConfig(
  context: Context<'pull_request'>,
): Promise<BotConfig> {
  const { owner, repo } = context.repo();

  try {
    const response = await context.octokit.repos.getContent({
      owner,
      repo,
      path: CONFIG_PATH,
      ref: context.payload.pull_request.base.ref,
    });

    if ('content' in response.data) {
      const content = Buffer.from(
        response.data.content,
        'base64',
      ).toString('utf-8');
      const userConfig = yaml.load(content) as Record<string, unknown>;
      return deepMerge(structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>, userConfig) as unknown as BotConfig;
    }
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    if (status !== 404) {
      context.log.warn({ error }, 'Failed to load docs-bot.yml, using defaults');
    }
  }

  return structuredClone(DEFAULT_CONFIG);
}

function deepMerge(
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...defaults };

  for (const key of Object.keys(overrides)) {
    const val = overrides[key];
    if (val === undefined || val === null) continue;

    const defaultVal = defaults[key];
    if (
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof defaultVal === 'object' &&
      defaultVal !== null &&
      !Array.isArray(defaultVal)
    ) {
      result[key] = deepMerge(
        defaultVal as Record<string, unknown>,
        val as Record<string, unknown>,
      );
    } else {
      result[key] = val;
    }
  }

  return result;
}
