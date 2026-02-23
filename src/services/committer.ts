import type { BotConfig, FileUpdate, RepoRef, Logger } from '../types/index.js';
import { createCommit, getLatestCommit } from './github.js';

const BOT_COMMIT_MARKER = '[github-docs-bot]';
const MAX_RETRIES = 2;

/**
 * Determines the correct parent SHA for a commit, accounting for the
 * amend strategy and merge commits.
 */
export function resolveParentSha(
  latest: { sha: string; parentSha: string; message: string },
  strategy: string,
): string {
  if (strategy !== 'amend') return latest.sha;
  if (!latest.message.includes(BOT_COMMIT_MARKER)) return latest.sha;
  if (!latest.parentSha) return latest.sha;
  return latest.parentSha;
}

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

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const latest = await getLatestCommit(ref, branch);
    const parentSha = resolveParentSha(latest, config.commit.strategy);

    if (parentSha !== latest.sha) {
      log.info(
        `Amending previous bot commit ${latest.sha.substring(0, 7)}`,
      );
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

      if (status === 409 && attempt < MAX_RETRIES) {
        log.warn(
          { error },
          `Branch was updated during generation, retrying (attempt ${attempt + 1}/${MAX_RETRIES})...`,
        );
        continue;
      }

      throw error;
    }
  }

  return null;
}
