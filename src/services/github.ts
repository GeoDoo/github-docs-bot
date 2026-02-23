import type { Context } from 'probot';
import type { FileUpdate } from '../types/index.js';

export interface PullRequestFile {
  filename: string;
  status: string;
  patch?: string;
  additions: number;
  deletions: number;
  changes: number;
}

export async function getPRFiles(
  context: Context<'pull_request'>,
): Promise<PullRequestFile[]> {
  const { owner, repo } = context.repo();
  const prNumber = context.payload.pull_request.number;

  const files: PullRequestFile[] = [];
  let page = 1;

  while (true) {
    const response = await context.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
      page,
    });

    files.push(...response.data);
    if (response.data.length < 100) break;
    page++;
  }

  return files;
}

export async function getFileContent(
  context: Context<'pull_request'>,
  path: string,
  ref: string,
): Promise<string | null> {
  const { owner, repo } = context.repo();

  try {
    const response = await context.octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if ('content' in response.data) {
      return Buffer.from(response.data.content, 'base64').toString('utf-8');
    }
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    if (status === 404) return null;
    throw error;
  }

  return null;
}

/**
 * Creates a single commit with all file updates using the Git Trees API.
 * No git clone required — fully API-driven.
 */
export async function createCommit(
  context: Context<'pull_request'>,
  branch: string,
  message: string,
  fileUpdates: FileUpdate[],
  parentSha: string,
): Promise<string> {
  const { owner, repo } = context.repo();

  const parentCommit = await context.octokit.git.getCommit({
    owner,
    repo,
    commit_sha: parentSha,
  });

  const treeItems = await Promise.all(
    fileUpdates.map(async (file) => {
      const blob = await context.octokit.git.createBlob({
        owner,
        repo,
        content: file.updatedContent,
        encoding: 'utf-8',
      });

      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.data.sha,
      };
    }),
  );

  const tree = await context.octokit.git.createTree({
    owner,
    repo,
    base_tree: parentCommit.data.tree.sha,
    tree: treeItems,
  });

  const commit = await context.octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.data.sha,
    parents: [parentSha],
    author: {
      name: 'github-docs-bot',
      email: 'github-docs-bot[bot]@users.noreply.github.com',
    },
  });

  await context.octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha,
  });

  return commit.data.sha;
}

export async function getLatestCommit(
  context: Context<'pull_request'>,
  branch: string,
): Promise<{
  sha: string;
  author: string;
  message: string;
  parentSha: string;
}> {
  const { owner, repo } = context.repo();

  const ref = await context.octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const commit = await context.octokit.git.getCommit({
    owner,
    repo,
    commit_sha: ref.data.object.sha,
  });

  return {
    sha: ref.data.object.sha,
    author: commit.data.author.name,
    message: commit.data.message,
    parentSha: commit.data.parents[0]?.sha ?? '',
  };
}

export interface CheckRunParams {
  headSha: string;
  conclusion: 'success' | 'failure' | 'neutral';
  title: string;
  summary: string;
  annotations?: Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: 'notice' | 'warning' | 'failure';
    message: string;
  }>;
}

/**
 * Creates a completed check run. Handles GitHub's 50-annotation-per-call
 * limit by batching annotations across multiple API calls.
 */
export async function createCheckRun(
  context: Context<'pull_request'>,
  params: CheckRunParams,
): Promise<number> {
  const { owner, repo } = context.repo();

  const annotations = params.annotations ?? [];
  const batches: (typeof annotations)[] = [];
  for (let i = 0; i < annotations.length; i += 50) {
    batches.push(annotations.slice(i, i + 50));
  }

  const checkRun = await context.octokit.checks.create({
    owner,
    repo,
    name: 'Documentation Coverage',
    head_sha: params.headSha,
    status: 'completed',
    conclusion: params.conclusion,
    output: {
      title: params.title,
      summary: params.summary,
      annotations: batches[0] ?? [],
    },
  });

  for (let i = 1; i < batches.length; i++) {
    await context.octokit.checks.update({
      owner,
      repo,
      check_run_id: checkRun.data.id,
      output: {
        title: params.title,
        summary: params.summary,
        annotations: batches[i],
      },
    });
  }

  return checkRun.data.id;
}
