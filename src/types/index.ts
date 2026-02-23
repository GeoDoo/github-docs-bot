import type { Context } from 'probot';

/**
 * Minimal interface for interacting with a specific GitHub repository.
 * Works with any Probot context type (pull_request, installation, etc.)
 * so services don't need to know which webhook triggered them.
 */
export interface RepoRef {
  octokit: Context['octokit'];
  owner: string;
  repo: string;
}

export interface Logger {
  info(msg: string, ...args: unknown[]): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface BotConfig {
  triggers: {
    skip_draft: boolean;
    skip_labels: string[];
    only_on_ready_for_review: boolean;
  };
  documentation: {
    inline: {
      enabled: boolean;
      style: 'auto' | 'jsdoc' | 'google' | 'numpy' | 'rustdoc' | 'javadoc';
      scope: 'exported_only' | 'all';
    };
  };
  ai: {
    provider: 'anthropic' | 'openai';
    model: string;
    custom_instructions: string;
  };
  check: {
    conclusion_on_missing: 'success' | 'failure' | 'neutral';
  };
  ignore: {
    paths: string[];
  };
  commit: {
    strategy: 'amend' | 'append' | 'skip_if_unchanged';
    message: string;
  };
  bootstrap: {
    enabled: boolean;
    max_files_per_pr: number;
    branch: string;
  };
}

export interface FileUpdate {
  path: string;
  originalContent: string;
  updatedContent: string;
}
