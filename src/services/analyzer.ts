import { minimatch } from 'minimatch';
import type { Context } from 'probot';
import type { BotConfig, DocGap, AnalysisResult } from '../types/index.js';
import { getParserForFile } from '../parsers/index.js';
import { getFileContent, getPRFiles } from './github.js';

const CONCURRENCY = 10;

export async function analyzePR(
  context: Context<'pull_request'>,
  config: BotConfig,
): Promise<AnalysisResult> {
  const headRef = context.payload.pull_request.head.ref;
  const files = await getPRFiles(context);

  const codeFiles = files.filter((f) => {
    if (f.status === 'removed') return false;
    if (config.ignore.paths.some((pattern) => minimatch(f.filename, pattern)))
      return false;
    return getParserForFile(f.filename) !== null;
  });

  context.log.info(
    `Analyzing ${codeFiles.length} code files out of ${files.length} changed`,
  );

  const allGaps: DocGap[] = [];
  const fileContents = new Map<string, string>();

  for (let i = 0; i < codeFiles.length; i += CONCURRENCY) {
    const batch = codeFiles.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (file) => {
        const content = await getFileContent(context, file.filename, headRef);
        if (!content) return;

        fileContents.set(file.filename, content);

        const parser = getParserForFile(file.filename);
        if (!parser) return;

        const gaps = parser.parse(content, file.filename, config);
        allGaps.push(...gaps);
      }),
    );
  }

  context.log.info(
    `Found ${allGaps.length} documentation gaps across ${codeFiles.length} files`,
  );

  return { gaps: allGaps, fileContents };
}
