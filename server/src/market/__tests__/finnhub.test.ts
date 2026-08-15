import { describe, it, expect, vi, afterEach } from 'vitest';
import { FinnhubProvider } from '../finnhub.js';

describe('FinnhubProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('映射基本面（metric + profile2）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u.includes('/stock/metric')) {
          return new Response(
            JSON.stringify({ metric: { peTTM: 20.5, pb: 8.2, epsTTM: 10.1, dividendYieldIndicatedAnnual: 0.4 } }),
            { status: 200 },
          );
        }
        if (u.includes('/stock/profile2')) {
          return new Response(JSON.stringify({ shareOutstanding: 3200000000, marketCapitalization: 1100000 }), {
            status: 200,
          });
        }
        throw new Error(`unexpected: ${u}`);
      }),
    );
    const p = new FinnhubProvider('fake-key');
    const f = await p.getFinancials('TSLA');
    expect(f!.pe).toBe(20.5);
    expect(f!.pb).toBe(8.2);
    expect(f!.eps).toBe(10.1);
    expect(f!.dividendYield).toBe(0.4);
    expect(f!.sharesOutstanding).toBe(3200000000);
    expect(f!.marketCap).toBe(1100000 * 1e6); // 百万 → USD
    expect(f!.source).toBe('finnhub');
  });

  it('新闻为空时返回 []', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    const p = new FinnhubProvider('fake-key');
    expect(await p.getNews('TSLA', 5)).toEqual([]);
  });

  it('401 抛 key 无效错误', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const p = new FinnhubProvider('bad');
    await expect(p.getFinancials('TSLA')).rejects.toThrow(/invalid Finnhub API key/);
  });
});
