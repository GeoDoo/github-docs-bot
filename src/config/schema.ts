import { z } from 'zod';

export const BotConfigSchema = z.object({
  triggers: z.object({
    skip_draft: z.boolean(),
    skip_labels: z.array(z.string()),
    only_on_ready_for_review: z.boolean(),
  }),
  documentation: z.object({
    inline: z.object({
      enabled: z.boolean(),
      style: z.enum(['auto', 'jsdoc', 'google', 'numpy', 'rustdoc', 'javadoc']),
      scope: z.enum(['exported_only', 'all']),
    }),
    reference: z.object({
      enabled: z.boolean(),
      output_dir: z.string().min(1),
    }),
  }),
  ai: z.object({
    provider: z.enum(['anthropic', 'openai']),
    model: z.string().min(1),
    custom_instructions: z.string(),
  }),
  check: z.object({
    conclusion_on_missing: z.enum(['success', 'failure', 'neutral']),
  }),
  ignore: z.object({
    paths: z.array(z.string()),
  }),
  commit: z.object({
    strategy: z.enum(['amend', 'append', 'skip_if_unchanged']),
    message: z.string().min(1),
  }),
  bootstrap: z.object({
    enabled: z.boolean(),
    max_files_per_pr: z.number().int().min(0),
    branch: z.string().min(1),
  }),
});
