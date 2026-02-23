import type { Probot } from 'probot';
import type { ApplicationFunctionOptions } from 'probot/lib/types.js';
import { handlePullRequest } from './handlers/pull-request.js';
import {
  handleInstallationCreated,
  handleRepositoriesAdded,
} from './handlers/installation.js';
import { getMetrics } from './services/metrics.js';

export default (app: Probot, { getRouter }: ApplicationFunctionOptions) => {
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

  // --- Health / metrics endpoint ---
  if (getRouter) {
    const router = getRouter();
    router.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok', ...getMetrics() });
    });
  }
};
