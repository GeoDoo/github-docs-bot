import type { Context } from 'probot';
import type { RepoRef } from '../types/index.js';
import { loadConfig } from '../config/loader.js';
import { getDefaultBranch } from '../services/github.js';
import { bootstrapRepo } from '../services/bootstrap.js';

type InstallationCreatedContext = Context<'installation.created'>;
type ReposAddedContext = Context<'installation_repositories.added'>;

/**
 * Handles initial app installation — runs bootstrap on every included repo.
 */
export async function handleInstallationCreated(
  context: InstallationCreatedContext,
): Promise<void> {
  const repos = context.payload.repositories ?? [];
  const owner = context.payload.installation.account.login;

  context.log.info(
    `App installed on ${repos.length} repos by ${owner}`,
  );

  for (const repo of repos) {
    await bootstrapSingleRepo(context.octokit, owner, repo.name, context.log);
  }
}

/**
 * Handles repos being added to an existing installation.
 */
export async function handleRepositoriesAdded(
  context: ReposAddedContext,
): Promise<void> {
  const repos = context.payload.repositories_added ?? [];
  const owner = context.payload.installation.account.login;

  context.log.info(
    `${repos.length} repos added to existing installation for ${owner}`,
  );

  for (const repo of repos) {
    await bootstrapSingleRepo(context.octokit, owner, repo.name, context.log);
  }
}

async function bootstrapSingleRepo(
  octokit: Context['octokit'],
  owner: string,
  repoName: string,
  log: Context['log'],
): Promise<void> {
  const ref: RepoRef = { octokit, owner, repo: repoName };

  try {
    const defaultBranch = await getDefaultBranch(ref);
    const config = await loadConfig(ref, defaultBranch);
    const result = await bootstrapRepo(ref, config, log);

    if (result) {
      log.info(
        `Bootstrap complete for ${owner}/${repoName}: PR #${result.prNumber}`,
      );
    }
  } catch (error) {
    log.error(
      { error },
      `Bootstrap failed for ${owner}/${repoName}`,
    );
  }
}
