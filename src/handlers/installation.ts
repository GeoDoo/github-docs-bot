import type { Context } from 'probot';
import type { RepoRef } from '../types/index.js';
import { loadConfig } from '../config/loader.js';
import { getDefaultBranch } from '../services/github.js';
import { bootstrapRepo } from '../services/bootstrap.js';
import { notifyPortalRevalidation } from '../services/revalidate.js';
import { isDuplicate } from '../services/dedup.js';
import { increment } from '../services/metrics.js';

type InstallationCreatedContext = Context<'installation.created'>;
type ReposAddedContext = Context<'installation_repositories.added'>;

const BOOTSTRAP_CONCURRENCY = 3;

/**
 * Handles initial app installation — runs bootstrap on every included repo.
 */
export async function handleInstallationCreated(
  context: InstallationCreatedContext,
): Promise<void> {
  if (isDuplicate(context.id)) {
    increment('webhooksDeduplicated');
    context.log.info(`Skipping duplicate delivery ${context.id}`);
    return;
  }

  const repos = context.payload.repositories ?? [];
  const owner = context.payload.installation.account.login;

  context.log.info(
    `App installed on ${repos.length} repos by ${owner}`,
  );

  await bootstrapRepos(
    context.octokit,
    owner,
    repos.map((r) => r.name),
    context.log,
  );
}

/**
 * Handles repos being added to an existing installation.
 */
export async function handleRepositoriesAdded(
  context: ReposAddedContext,
): Promise<void> {
  if (isDuplicate(context.id)) {
    increment('webhooksDeduplicated');
    context.log.info(`Skipping duplicate delivery ${context.id}`);
    return;
  }

  const repos = context.payload.repositories_added ?? [];
  const owner = context.payload.installation.account.login;

  context.log.info(
    `${repos.length} repos added to existing installation for ${owner}`,
  );

  await bootstrapRepos(
    context.octokit,
    owner,
    repos.map((r) => r.name),
    context.log,
  );
}

async function bootstrapRepos(
  octokit: Context['octokit'],
  owner: string,
  repoNames: string[],
  log: Context['log'],
): Promise<void> {
  for (let i = 0; i < repoNames.length; i += BOOTSTRAP_CONCURRENCY) {
    const batch = repoNames.slice(i, i + BOOTSTRAP_CONCURRENCY);
    await Promise.allSettled(
      batch.map((name) => bootstrapSingleRepo(octokit, owner, name, log)),
    );
  }
}

async function bootstrapSingleRepo(
  octokit: Context['octokit'],
  owner: string,
  repoName: string,
  log: Context['log'],
): Promise<void> {
  const ref: RepoRef = { octokit, owner, repo: repoName };

  increment('bootstrapsStarted');

  try {
    const defaultBranch = await getDefaultBranch(ref);
    const config = await loadConfig(ref, defaultBranch);
    const result = await bootstrapRepo(ref, config, log);

    increment('bootstrapsCompleted');

    if (result) {
      log.info(
        `Bootstrap complete for ${owner}/${repoName}: PR #${result.prNumber}`,
      );
      await notifyPortalRevalidation(`${owner}/${repoName}`, log);
    }
  } catch (error) {
    increment('bootstrapsFailed');
    log.error(
      { error },
      `Bootstrap failed for ${owner}/${repoName}`,
    );
  }
}
