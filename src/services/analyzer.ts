import { minimatch } from 'minimatch';
import type { BotConfig, DocGap, AnalysisResult, RepoRef, Logger } from '../types/index.js';
import { getParserForFile } from '../parsers/index.js';
import { getFileContent, getPRFiles, getRepoTree } from './github.js';

const CONCURRENCY = 10;

/**
 * Analyze only the files changed in a pull request.
 */
export async function analyzePR(
  ref: RepoRef,
  prNumber: number,
  headRef: string,
  config: BotConfig,
  log: Logger,
): Promise<AnalysisResult> {
  const files = await getPRFiles(ref, prNumber);

  const codeFiles = files
    .filter((f) => f.status !== 'removed')
    .filter((f) => !config.ignore.paths.some((p) => minimatch(f.filename, p)))
    .filter((f) => getParserForFile(f.filename) !== null);

  log.info(
    `Analyzing ${codeFiles.length} code files out of ${files.length} changed`,
  );

  return analyzeFiles(
    ref,
    codeFiles.map((f) => f.filename),
    headRef,
    config,
    log,
  );
}

/**
 * Analyze the entire repository by walking the full git tree.
 * Used during bootstrap when the app is first installed.
 */
export async function analyzeRepo(
  ref: RepoRef,
  treeSha: string,
  config: BotConfig,
  log: Logger,
): Promise<AnalysisResult> {
  const { entries, truncated } = await getRepoTree(ref, treeSha);

  if (truncated) {
    log.warn(
      { truncated },
      'Repo tree was truncated by GitHub — very large repos may have incomplete coverage',
    );
  }

  const codePaths = entries
    .map((e) => e.path)
    .filter((p) => !config.ignore.paths.some((pattern) => minimatch(p, pattern)))
    .filter((p) => getParserForFile(p) !== null);

  const capped = codePaths.slice(0, config.bootstrap.max_files_per_pr);

  log.info(
    `Bootstrap: scanning ${capped.length} code files out of ${entries.length} total (cap: ${config.bootstrap.max_files_per_pr})`,
  );

  return analyzeFiles(ref, capped, treeSha, config, log);
}

/**
 * Shared logic: fetch content, parse, and collect gaps for a list of file paths.
 */
async function analyzeFiles(
  ref: RepoRef,
  filePaths: string[],
  gitRef: string,
  config: BotConfig,
  log: Logger,
): Promise<AnalysisResult> {
  const allGaps: DocGap[] = [];
  const fileContents = new Map<string, string>();

  for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
    const batch = filePaths.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (filePath) => {
        const content = await getFileContent(ref, filePath, gitRef);
        if (!content) return;

        fileContents.set(filePath, content);

        const parser = getParserForFile(filePath);
        if (!parser) return;

        const gaps = parser.parse(content, filePath, config);
        allGaps.push(...gaps);
      }),
    );
  }

  log.info(
    `Found ${allGaps.length} documentation gaps across ${fileContents.size} files`,
  );

  return { gaps: allGaps, fileContents };
}
