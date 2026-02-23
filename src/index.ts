import type { Probot } from 'probot';
import { handlePullRequest } from './handlers/pull-request.js';
import { registerParser } from './parsers/index.js';
import { typescriptParser } from './parsers/typescript.js';
import { pythonParser } from './parsers/python.js';

export default (app: Probot) => {
  registerParser(typescriptParser);
  registerParser(pythonParser);

  app.log.info('github-docs-bot is running');

  app.on(
    [
      'pull_request.opened',
      'pull_request.synchronize',
      'pull_request.ready_for_review',
      'pull_request.reopened',
    ],
    handlePullRequest,
  );
};
