/**
 * Lightweight in-process metrics counters. Exposed via the /health endpoint
 * for monitoring dashboards and alerting. No external dependencies required.
 */

interface Counters {
  webhooksReceived: number;
  webhooksSkipped: number;
  webhooksDeduplicated: number;
  prsProcessed: number;
  prsDocumented: number;
  prsFailed: number;
  bootstrapsStarted: number;
  bootstrapsCompleted: number;
  bootstrapsFailed: number;
  llmCalls: number;
  llmErrors: number;
  llmRetries: number;
  filesAnalyzed: number;
  docsGenerated: number;
}

const counters: Counters = {
  webhooksReceived: 0,
  webhooksSkipped: 0,
  webhooksDeduplicated: 0,
  prsProcessed: 0,
  prsDocumented: 0,
  prsFailed: 0,
  bootstrapsStarted: 0,
  bootstrapsCompleted: 0,
  bootstrapsFailed: 0,
  llmCalls: 0,
  llmErrors: 0,
  llmRetries: 0,
  filesAnalyzed: 0,
  docsGenerated: 0,
};

const startedAt = Date.now();

export function increment(key: keyof Counters, amount = 1): void {
  counters[key] += amount;
}

export function getMetrics(): Counters & { uptimeMs: number } {
  return {
    ...counters,
    uptimeMs: Date.now() - startedAt,
  };
}
