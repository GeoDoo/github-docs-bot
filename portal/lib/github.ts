import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import type { PortalConfig } from './config';
import { findRepoConfig, getAllConfiguredRepos } from './config';

export interface RepoDoc {
  owner: string;
  repo: string;
  fullName: string;
  title: string;
  description: string;
  markdown: string;
}

let cachedAppOctokit: Octokit | null = null;

function getAppOctokit(): Octokit | null {
  if (cachedAppOctokit) return cachedAppOctokit;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!appId || !privateKey) return null;

  cachedAppOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
  });

  return cachedAppOctokit;
}

async function getInstallationOctokit(
  installationId: number,
): Promise<Octokit> {
  const appId = process.env.GITHUB_APP_ID!;
  const privateKey = process.env.GITHUB_PRIVATE_KEY!;

  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId },
  });
}

async function listAllInstallations(app: Octokit) {
  const installations = [];
  let page = 1;
  while (true) {
    const { data } = await app.apps.listInstallations({ per_page: 100, page });
    installations.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return installations;
}

interface MinimalRepo {
  owner: { login: string };
  name: string;
  full_name: string;
}

async function listAllRepos(octokit: Octokit): Promise<MinimalRepo[]> {
  const repos: MinimalRepo[] = [];
  let page = 1;
  while (true) {
    const { data } =
      await octokit.apps.listReposAccessibleToInstallation({ per_page: 100, page });
    repos.push(...data.repositories);
    if (data.repositories.length < 100) break;
    page++;
  }
  return repos;
}

async function fetchDocFromRepo(
  octokit: Octokit,
  owner: string,
  repoName: string,
  docsPath: string,
): Promise<string | null> {
  try {
    const { data: file } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: docsPath,
    });

    if ('content' in file && file.content) {
      return Buffer.from(file.content, 'base64').toString('utf-8');
    }
  } catch {
    // No docs file in this repo
  }
  return null;
}

function enrichDoc(
  owner: string,
  repoName: string,
  fullName: string,
  markdown: string,
  config: PortalConfig,
): RepoDoc {
  const override = findRepoConfig(config, fullName);
  return {
    owner,
    repo: repoName,
    fullName,
    title: override?.title ?? repoName,
    description:
      override?.description ?? `Public API reference for ${fullName}`,
    markdown,
  };
}

async function fetchAutoMode(
  config: PortalConfig,
): Promise<RepoDoc[]> {
  const app = getAppOctokit();
  if (!app) return [];

  const installations = await listAllInstallations(app);
  const docs: RepoDoc[] = [];
  const excludeSet = new Set(
    config.repos.exclude.map((e) => e.toLowerCase()),
  );

  for (const installation of installations) {
    let octokit: Octokit;
    try {
      octokit = await getInstallationOctokit(installation.id);
    } catch {
      continue;
    }

    const repos = await listAllRepos(octokit);

    for (const repo of repos) {
      if (excludeSet.has(repo.full_name.toLowerCase())) continue;

      const markdown = await fetchDocFromRepo(
        octokit,
        repo.owner.login,
        repo.name,
        config.docsFilePath,
      );

      if (markdown) {
        docs.push(
          enrichDoc(
            repo.owner.login,
            repo.name,
            repo.full_name,
            markdown,
            config,
          ),
        );
      }
    }
  }

  return docs;
}

async function fetchManualMode(
  config: PortalConfig,
): Promise<RepoDoc[]> {
  const app = getAppOctokit();
  if (!app) return [];

  const entries = getAllConfiguredRepos(config);
  if (entries.length === 0) return [];

  const installations = await listAllInstallations(app);

  const installationMap = new Map<string, number>();
  for (const inst of installations) {
    let octokit: Octokit;
    try {
      octokit = await getInstallationOctokit(inst.id);
    } catch {
      continue;
    }
    const repos = await listAllRepos(octokit);
    for (const repo of repos) {
      installationMap.set(repo.full_name.toLowerCase(), inst.id);
    }
  }

  const docs: RepoDoc[] = [];

  for (const entry of entries) {
    const instId = installationMap.get(entry.repo.toLowerCase());
    if (!instId) continue;

    const [owner, repoName] = entry.repo.split('/');
    if (!owner || !repoName) continue;

    let octokit: Octokit;
    try {
      octokit = await getInstallationOctokit(instId);
    } catch {
      continue;
    }

    const markdown = await fetchDocFromRepo(
      octokit,
      owner,
      repoName,
      config.docsFilePath,
    );

    if (markdown) {
      docs.push(enrichDoc(owner, repoName, entry.repo, markdown, config));
    }
  }

  return docs;
}

export async function fetchAllRepoDocs(
  config: PortalConfig,
): Promise<RepoDoc[]> {
  if (config.repos.mode === 'manual') {
    return fetchManualMode(config);
  }
  return fetchAutoMode(config);
}
