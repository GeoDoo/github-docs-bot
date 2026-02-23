import yaml from 'js-yaml';
import type { RepoRef, BotConfig } from '../types/index.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { getFileContent } from '../services/github.js';

const CONFIG_PATH = '.github/docs-bot.yml';

/**
 * Loads repo-specific config from .github/docs-bot.yml, falling back to
 * defaults for any missing values. Works with any RepoRef (PR handler,
 * installation handler, etc.).
 */
export async function loadConfig(
  ref: RepoRef,
  gitRef: string,
): Promise<BotConfig> {
  try {
    const content = await getFileContent(ref, CONFIG_PATH, gitRef);

    if (content) {
      const userConfig = yaml.load(content) as Record<string, unknown>;
      return deepMerge(
        structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>,
        userConfig,
      ) as unknown as BotConfig;
    }
  } catch {
    // Config file missing or unreadable — use defaults
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
