/**
 * TTL cache for webhook delivery IDs. GitHub may re-deliver webhooks
 * when it doesn't receive a timely response. This prevents processing
 * the same event twice.
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

interface CacheEntry {
  expiresAt: number;
}

const seen = new Map<string, CacheEntry>();
let sweepTimer: ReturnType<typeof setInterval> | null = null;

function ensureSweeper(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of seen) {
      if (entry.expiresAt <= now) {
        seen.delete(key);
      }
    }
    if (seen.size === 0 && sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }, SWEEP_INTERVAL_MS);

  if (typeof sweepTimer === 'object' && 'unref' in sweepTimer) {
    sweepTimer.unref();
  }
}

/**
 * Returns true if this delivery ID has already been seen (duplicate).
 * Returns false on first occurrence and marks it as seen.
 */
export function isDuplicate(deliveryId: string, ttlMs = DEFAULT_TTL_MS): boolean {
  const existing = seen.get(deliveryId);
  if (existing) {
    if (existing.expiresAt > Date.now()) return true;
    seen.delete(deliveryId);
  }

  seen.set(deliveryId, { expiresAt: Date.now() + ttlMs });
  ensureSweeper();
  return false;
}

export function _resetForTests(): void {
  seen.clear();
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
