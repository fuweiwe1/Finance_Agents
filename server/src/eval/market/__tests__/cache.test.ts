import { describe, it, expect, vi } from 'vitest';
import { TTLCache } from '../cache.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('TTLCache', () => {
  it('TTL 内命中缓存', async () => {
    const load = vi.fn(async () => 42);
    const cache = new TTLCache<number>(1000);
    await cache.get('a', load);
    await cache.get('a', load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('single-flight：并发同 key 只加载一次', async () => {
    let calls = 0;
    const cache = new TTLCache<number>(1000);
    const load = async () => {
      calls++;
      await sleep(20);
      return calls;
    };
    const [a, b, c] = await Promise.all([cache.get('k', load), cache.get('k', load), cache.get('k', load)]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(c).toBe(1);
    expect(calls).toBe(1);
  });

  it('TTL 过期后重新加载', async () => {
    const load = vi.fn(async () => 1);
    const cache = new TTLCache<number>(50);
    await cache.get('k', load);
    await sleep(70);
    await cache.get('k', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('不缓存 null', async () => {
    let calls = 0;
    const cache = new TTLCache<number | null>(1000);
    const load = async () => {
      calls++;
      return null;
    };
    await cache.get('k', load);
    await cache.get('k', load);
    expect(calls).toBe(2);
  });

  it('加载抛错不缓存，下次重试', async () => {
    let calls = 0;
    const cache = new TTLCache<number>(1000);
    const load = async () => {
      calls++;
      if (calls === 1) throw new Error('boom');
      return 7;
    };
    await expect(cache.get('k', load)).rejects.toThrow('boom');
    await expect(cache.get('k', load)).resolves.toBe(7);
    expect(calls).toBe(2);
  });

  it('invalidate 清除指定/全部缓存', async () => {
    const load = vi.fn(async () => 1);
    const cache = new TTLCache<number>(1000);
    await cache.get('k', load);
    cache.invalidate('k');
    await cache.get('k', load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
