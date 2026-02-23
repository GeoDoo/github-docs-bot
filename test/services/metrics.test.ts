import { describe, it, expect } from 'vitest';
import { increment, getMetrics } from '../../src/services/metrics.js';

describe('metrics', () => {
  it('increments counters', () => {
    const before = getMetrics().webhooksReceived;
    increment('webhooksReceived');
    increment('webhooksReceived');
    expect(getMetrics().webhooksReceived).toBe(before + 2);
  });

  it('increments by custom amount', () => {
    const before = getMetrics().docsGenerated;
    increment('docsGenerated', 10);
    expect(getMetrics().docsGenerated).toBe(before + 10);
  });

  it('tracks uptime', () => {
    expect(getMetrics().uptimeMs).toBeGreaterThan(0);
  });
});
