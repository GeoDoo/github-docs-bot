import type { BotConfig, FileUpdate, RepoRef, Logger } from '../types/index.js';
import { createCommit, getLatestCommit } from './github.js';

const BOT_COMMIT_MARKER = '[github-docs-bot]';

/**
 * Commits documentation updates to a branch.
 *
 * When strategy is "amend", replaces the bot's previous commit (if it's at
 * the branch tip) by re-parenting the new commit onto the one before it.
 * This keeps exactly one bot commit in the history at all times.
 *
 * Returns the new commit SHA, or null if there was nothing to commit.
 */
export async function commitDocUpdates(
  ref: RepoRef,
  branch: string,
  config: BotConfig,
  fileUpdates: FileUpdate[],
  log: Logger,
): Promise<string | null> {
  if (fileUpdates.length === 0) {
    log.info('No documentation changes to commit');
    return null;
  }

  const latest = await getLatestCommit(ref, branch);

  let parentSha: string;

  if (
    config.commit.strategy === 'amend' &&
    latest.message.includes(BOT_COMMIT_MARKER)
  ) {
    parentSha = latest.parentSha;
    log.info(
      `Amending previous bot commit ${latest.sha.substring(0, 7)}`,
    );
  } else {
    parentSha = latest.sha;
  }

  try {
    const commitSha = await createCommit(
      ref,
      branch,
      config.commit.message,
      fileUpdates,
      parentSha,
    );

    log.info(`Created doc commit ${commitSha.substring(0, 7)} on ${branch}`);
    return commitSha;
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;

    if (status === 409) {
      log.warn({ error }, 'Branch was updated during generation, retrying...');
      const refreshed = await getLatestCommit(ref, branch);
      const commitSha = await createCommit(
        ref,
        branch,
        config.commit.message,
        fileUpdates,
        refreshed.sha,
      );
      log.info(
        `Retry succeeded — created doc commit ${commitSha.substring(0, 7)}`,
      );
      return commitSha;
    }

    throw error;
  }
}
