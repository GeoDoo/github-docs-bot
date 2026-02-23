import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

export interface RepoEntry {
  repo: string;
  title?: string;
  description?: string;
}

export interface Category {
  name: string;
  repos: RepoEntry[];
}

export interface PortalConfig {
  site: {
    title: string;
    description: string;
  };
  repos: {
    mode: 'auto' | 'manual';
    exclude: string[];
    categories: Category[];
  };
  revalidateSeconds: number;
  docsFilePath: string;
}

const DEFAULT_CONFIG: PortalConfig = {
  site: {
    title: 'API Documentation',
    description: 'Unified public API reference across all repositories',
  },
  repos: {
    mode: 'auto',
    exclude: [],
    categories: [],
  },
  revalidateSeconds: 300,
  docsFilePath: 'docs/API.md',
};

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const overVal = override[key];
    if (overVal === undefined) continue;

    const baseVal = base[key];
    if (
      overVal !== null &&
      typeof overVal === 'object' &&
      !Array.isArray(overVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>,
      );
    } else {
      result[key] = overVal;
    }
  }
  return result;
}

function normalizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((cat) => ({
    name: String(cat?.name ?? 'Uncategorized'),
    repos: Array.isArray(cat?.repos)
      ? cat.repos.map((r: unknown) => {
          if (typeof r === 'string') return { repo: r };
          const entry = r as Record<string, unknown>;
          return {
            repo: String(entry.repo ?? ''),
            title: entry.title ? String(entry.title) : undefined,
            description: entry.description
              ? String(entry.description)
              : undefined,
          };
        })
      : [],
  }));
}

let cachedConfig: PortalConfig | null = null;

export function getPortalConfig(): PortalConfig {
  if (cachedConfig) return cachedConfig;

  const configPath = join(process.cwd(), 'portal.yml');

  if (!existsSync(configPath)) {
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw, {
      schema: yaml.JSON_SCHEMA,
    }) as Record<string, unknown> | null;

    if (!parsed || typeof parsed !== 'object') {
      cachedConfig = DEFAULT_CONFIG;
      return cachedConfig;
    }

    const merged = deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      parsed,
    ) as unknown as PortalConfig;

    if (parsed.repos && typeof parsed.repos === 'object') {
      const reposRaw = parsed.repos as Record<string, unknown>;
      merged.repos.categories = normalizeCategories(reposRaw.categories);
      merged.repos.exclude = Array.isArray(reposRaw.exclude)
        ? reposRaw.exclude.map(String)
        : [];
    }

    cachedConfig = merged;
    return cachedConfig;
  } catch (error) {
    console.warn('[docs-portal] Failed to load portal.yml, using defaults:', error);
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }
}

export function getAllConfiguredRepos(config: PortalConfig): RepoEntry[] {
  return config.repos.categories.flatMap((cat) => cat.repos);
}

export function findRepoConfig(
  config: PortalConfig,
  fullName: string,
): RepoEntry | undefined {
  for (const cat of config.repos.categories) {
    const entry = cat.repos.find(
      (r) => r.repo.toLowerCase() === fullName.toLowerCase(),
    );
    if (entry) return entry;
  }
  return undefined;
}

export function findRepoCategory(
  config: PortalConfig,
  fullName: string,
): string | undefined {
  for (const cat of config.repos.categories) {
    if (
      cat.repos.some(
        (r) => r.repo.toLowerCase() === fullName.toLowerCase(),
      )
    ) {
      return cat.name;
    }
  }
  return undefined;
}
