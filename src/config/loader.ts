import yaml from 'js-yaml';
import type { RepoRef, BotConfig } from '../types/index.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { BotConfigSchema } from './schema.js';
import { getFileContent } from '../services/github.js';

const CONFIG_PATH = '.github/docs-bot.yml';

/**
 * Loads repo-specific config from .github/docs-bot.yml, falling back to
 * defaults for any missing values. Validates the merged result against
 * the Zod schema — returns defaults if validation fails.
 */
export async function loadConfig(
  ref: RepoRef,
  gitRef: string,
): Promise<BotConfig> {
  try {
    const content = await getFileContent(ref, CONFIG_PATH, gitRef);

    if (content) {
      const userConfig = yaml.load(content, {
        schema: yaml.JSON_SCHEMA,
      }) as Record<string, unknown>;

      const merged = deepMerge(
        structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>,
        userConfig,
      );

      const result = BotConfigSchema.safeParse(merged);

      if (result.success) {
        return result.data;
      }

      const issues = result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      console.warn(
        `[github-docs-bot] Invalid config in .github/docs-bot.yml, using defaults:\n${issues}`,
      );
    }
  } catch (error) {
    console.warn('[github-docs-bot] Failed to load .github/docs-bot.yml, using defaults:', error);
  }

  return structuredClone(DEFAULT_CONFIG);
}

function deepMerge(
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...defaults };

  for (const key of Object.keys(overrides)) {
    if (!(key in overrides)) continue;
    const val = overrides[key];
    if (val === undefined) continue;

    const defaultVal = defaults[key];
    if (
      val !== null &&
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
