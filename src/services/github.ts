import type { RepoRef, FileUpdate } from '../types/index.js';

// ---------------------------------------------------------------------------
// PR files
// ---------------------------------------------------------------------------

export interface PullRequestFile {
  filename: string;
  status: string;
  patch?: string;
  additions: number;
  deletions: number;
  changes: number;
}

export async function getPRFiles(
  ref: RepoRef,
  prNumber: number,
): Promise<PullRequestFile[]> {
  const files: PullRequestFile[] = [];
  let page = 1;

  while (true) {
    const response = await ref.octokit.pulls.listFiles({
      owner: ref.owner,
      repo: ref.repo,
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

// ---------------------------------------------------------------------------
// File content
// ---------------------------------------------------------------------------

export async function getFileContent(
  ref: RepoRef,
  path: string,
  gitRef: string,
): Promise<string | null> {
  try {
    const response = await ref.octokit.repos.getContent({
      owner: ref.owner,
      repo: ref.repo,
      path,
      ref: gitRef,
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

// ---------------------------------------------------------------------------
// Repo tree — returns all file paths in a single API call
// ---------------------------------------------------------------------------

export interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
}

export async function getRepoTree(
  ref: RepoRef,
  treeSha: string,
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const response = await ref.octokit.git.getTree({
    owner: ref.owner,
    repo: ref.repo,
    tree_sha: treeSha,
    recursive: 'true',
  });

  const entries = response.data.tree
    .filter((e): e is TreeEntry => e.type === 'blob' && e.path !== undefined)
    .map((e) => ({
      path: e.path!,
      mode: e.mode!,
      type: e.type!,
      sha: e.sha!,
      size: e.size,
    }));

  return { entries, truncated: response.data.truncated ?? false };
}

// ---------------------------------------------------------------------------
// Git commits (Trees API — no clone required)
// ---------------------------------------------------------------------------

/**
 * Creates a single commit with all file updates using the Git Trees API.
 */
export async function createCommit(
  ref: RepoRef,
  branch: string,
  message: string,
  fileUpdates: FileUpdate[],
  parentSha: string,
): Promise<string> {
  const parentCommit = await ref.octokit.git.getCommit({
    owner: ref.owner,
    repo: ref.repo,
    commit_sha: parentSha,
  });

  const treeItems = await Promise.all(
    fileUpdates.map(async (file) => {
      const blob = await ref.octokit.git.createBlob({
        owner: ref.owner,
        repo: ref.repo,
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

  const tree = await ref.octokit.git.createTree({
    owner: ref.owner,
    repo: ref.repo,
    base_tree: parentCommit.data.tree.sha,
    tree: treeItems,
  });

  const commit = await ref.octokit.git.createCommit({
    owner: ref.owner,
    repo: ref.repo,
    message,
    tree: tree.data.sha,
    parents: [parentSha],
    author: {
      name: 'github-docs-bot',
      email: 'github-docs-bot[bot]@users.noreply.github.com',
    },
  });

  await ref.octokit.git.updateRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha,
  });

  return commit.data.sha;
}

export async function getLatestCommit(
  ref: RepoRef,
  branch: string,
): Promise<{
  sha: string;
  author: string;
  message: string;
  parentSha: string;
}> {
  const gitRef = await ref.octokit.git.getRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${branch}`,
  });

  const commit = await ref.octokit.git.getCommit({
    owner: ref.owner,
    repo: ref.repo,
    commit_sha: gitRef.data.object.sha,
  });

  return {
    sha: gitRef.data.object.sha,
    author: commit.data.author.name,
    message: commit.data.message,
    parentSha: commit.data.parents[0]?.sha ?? '',
  };
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export async function createBranch(
  ref: RepoRef,
  branchName: string,
  fromSha: string,
): Promise<void> {
  try {
    await ref.octokit.git.createRef({
      owner: ref.owner,
      repo: ref.repo,
      ref: `refs/heads/${branchName}`,
      sha: fromSha,
    });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    // 422 = branch already exists — update it instead
    if (status === 422) {
      await ref.octokit.git.updateRef({
        owner: ref.owner,
        repo: ref.repo,
        ref: `heads/${branchName}`,
        sha: fromSha,
        force: true,
      });
      return;
    }
    throw error;
  }
}

export async function branchExists(
  ref: RepoRef,
  branchName: string,
): Promise<boolean> {
  try {
    await ref.octokit.git.getRef({
      owner: ref.owner,
      repo: ref.repo,
      ref: `heads/${branchName}`,
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Pull requests
// ---------------------------------------------------------------------------

export async function createPullRequest(
  ref: RepoRef,
  params: {
    title: string;
    body: string;
    head: string;
    base: string;
  },
): Promise<number> {
  const response = await ref.octokit.pulls.create({
    owner: ref.owner,
    repo: ref.repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base,
  });

  return response.data.number;
}

// ---------------------------------------------------------------------------
// Check runs
// ---------------------------------------------------------------------------

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
  ref: RepoRef,
  params: CheckRunParams,
): Promise<number> {
  const annotations = params.annotations ?? [];
  const batches: (typeof annotations)[] = [];
  for (let i = 0; i < annotations.length; i += 50) {
    batches.push(annotations.slice(i, i + 50));
  }

  const checkRun = await ref.octokit.checks.create({
    owner: ref.owner,
    repo: ref.repo,
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
    await ref.octokit.checks.update({
      owner: ref.owner,
      repo: ref.repo,
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

// ---------------------------------------------------------------------------
// Default branch
// ---------------------------------------------------------------------------

export async function getDefaultBranch(ref: RepoRef): Promise<string> {
  const response = await ref.octokit.repos.get({
    owner: ref.owner,
    repo: ref.repo,
  });
  return response.data.default_branch;
}
