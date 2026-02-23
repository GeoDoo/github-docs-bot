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
      languages: string[];
      style: 'jsdoc' | 'google' | 'numpy' | 'rustdoc';
      scope: 'exported_only' | 'all';
    };
    readme: {
      enabled: boolean;
      auto_update_sections: string[];
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
    patterns: string[];
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

export interface DocGap {
  file: string;
  name: string;
  kind: 'function' | 'class' | 'method' | 'interface' | 'type' | 'variable';
  startLine: number;
  endLine: number;
  code: string;
  existingDoc?: string;
}

export interface GeneratedDoc {
  gap: DocGap;
  documentation: string;
}

export interface FileUpdate {
  path: string;
  originalContent: string;
  updatedContent: string;
}

export interface AnalysisResult {
  gaps: DocGap[];
  fileContents: Map<string, string>;
}

export type PullRequestContext = Context<'pull_request'>;
