import { describe, it, expect, beforeEach } from 'vitest';
import { isDuplicate, _resetForTests } from '../../src/services/dedup.js';

describe('isDuplicate', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('returns false on first occurrence', () => {
    expect(isDuplicate('delivery-1')).toBe(false);
  });

  it('returns true on second occurrence', () => {
    isDuplicate('delivery-2');
    expect(isDuplicate('delivery-2')).toBe(true);
  });

  it('treats different IDs independently', () => {
    isDuplicate('delivery-a');
    expect(isDuplicate('delivery-b')).toBe(false);
  });

  it('expires entries after TTL', async () => {
    isDuplicate('delivery-3', 50);
    expect(isDuplicate('delivery-3', 50)).toBe(true);

    await new Promise((r) => setTimeout(r, 80));
    expect(isDuplicate('delivery-3', 50)).toBe(false);
  });
});
