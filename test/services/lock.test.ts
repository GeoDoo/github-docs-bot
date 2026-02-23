import { describe, it, expect } from 'vitest';
import { withLock } from '../../src/services/lock.js';

describe('withLock', () => {
  it('executes function and returns result', async () => {
    const result = await withLock('key1', async () => 42);
    expect(result).toBe(42);
  });

  it('serializes concurrent calls for the same key', async () => {
    const order: number[] = [];

    const first = withLock('key2', async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 50));
      order.push(2);
      return 'first';
    });

    const second = withLock('key2', async () => {
      order.push(3);
      return 'second';
    });

    const [r1, r2] = await Promise.all([first, second]);

    expect(r1).toBe('first');
    expect(r2).toBe('second');
    expect(order).toEqual([1, 2, 3]);
  });

  it('allows parallel execution for different keys', async () => {
    const order: string[] = [];

    const a = withLock('keyA', async () => {
      order.push('a-start');
      await new Promise((r) => setTimeout(r, 30));
      order.push('a-end');
    });

    const b = withLock('keyB', async () => {
      order.push('b-start');
      await new Promise((r) => setTimeout(r, 30));
      order.push('b-end');
    });

    await Promise.all([a, b]);

    expect(order.indexOf('a-start')).toBeLessThan(order.indexOf('a-end'));
    expect(order.indexOf('b-start')).toBeLessThan(order.indexOf('b-end'));
    // Both should start before either ends (parallel)
    expect(order.indexOf('b-start')).toBeLessThan(order.indexOf('a-end'));
  });

  it('propagates errors without blocking the queue', async () => {
    const first = withLock('key3', async () => {
      throw new Error('boom');
    });

    await expect(first).rejects.toThrow('boom');

    const second = await withLock('key3', async () => 'recovered');
    expect(second).toBe('recovered');
  });
});
