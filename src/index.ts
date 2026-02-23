import type { Probot } from 'probot';
import { handlePullRequest } from './handlers/pull-request.js';
import {
  handleInstallationCreated,
  handleRepositoriesAdded,
} from './handlers/installation.js';
import { registerParser } from './parsers/index.js';
import { typescriptParser } from './parsers/typescript.js';
import { pythonParser } from './parsers/python.js';
import { javaParser } from './parsers/java.js';

export default (app: Probot) => {
  registerParser(typescriptParser);
  registerParser(pythonParser);
  registerParser(javaParser);

  app.log.info('github-docs-bot is running');

  // --- PR-level documentation (incremental) ---
  app.on(
    [
      'pull_request.opened',
      'pull_request.synchronize',
      'pull_request.ready_for_review',
      'pull_request.reopened',
    ],
    handlePullRequest,
  );

  // --- Installation bootstrap (full-repo scan) ---
  app.on('installation.created', handleInstallationCreated);
  app.on('installation_repositories.added', handleRepositoriesAdded);
};
