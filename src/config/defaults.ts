import type { BotConfig } from '../types/index.js';

export const DEFAULT_CONFIG: BotConfig = {
  triggers: {
    skip_draft: true,
    skip_labels: ['no-docs', 'wip'],
    only_on_ready_for_review: false,
  },
  documentation: {
    inline: {
      enabled: true,
      style: 'auto',
      scope: 'exported_only',
    },
  },
  ai: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    custom_instructions: '',
  },
  check: {
    conclusion_on_missing: 'neutral',
  },
  ignore: {
    paths: [
      '**/*.test.ts',
      '**/*.test.js',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/vendor/**',
      '**/target/**',
      '**/*.d.ts',
      '**/*.min.js',
      '**/*.min.css',
      '**/*.generated.*',
      '**/*.pb.go',
    ],
  },
  commit: {
    strategy: 'amend',
    message: 'docs: auto-update documentation [github-docs-bot]',
  },
  bootstrap: {
    enabled: true,
    max_files_per_pr: 50,
    branch: 'docs/initial-documentation',
  },
};
