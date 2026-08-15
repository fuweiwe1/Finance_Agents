import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CompositeProvider } from '../composite.js';
import { parseTencentQuote } from '../tencent.js';
import { parseSinaQuote } from '../sina.js';
import type { KlineBar, MarketQuote } from '../types.js';
import type { TencentProvider } from '../tencent.js';
import type { SinaProvider } from '../sina.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

// 用真实解析器从 fixture 得到结构正确的报价，作为桩 Provider 的返回
const tlaQuote = (): MarketQuote => parseTencentQuote(fixture('tencent.tsla.txt'), 'TSLA')!;
const sinaQuote = (): MarketQuote => parseSinaQuote(fixture('sina.tsla.txt'), 'TSLA')!;
const tlaKlines: KlineBar[] = [
  { ts: 1784534400, open: 338, high: 340, low: 337, close: 339, volume: 1000 },
  { ts: 1784620800, open: 339, high: 342, low: 338.5, close: 341, volume: 2000 },
  { ts: 1784707200, open: 342.33, high: 351.26, low: 335.33, close: 342.27, volume: 45437144 },
];

function stubTencent(opts: { quote?: MarketQuote | null; throw?: boolean } = {}) {
  return {
    name: 'tencent',
    getQuote: async () => {
      if (opts.throw) throw new Error('tencent down');
      return opts.quote !== undefined ? opts.quote : tlaQuote();
    },
    getKline: async () => tlaKlines,
  } as unknown as TencentProvider;
}

function stubSina(opts: { quote?: MarketQuote | null; throw?: boolean } = {}) {
  return {
    name: 'sina',
    getQuote: async () => {
      if (opts.throw) throw new Error('sina down');
      return opts.quote !== undefined ? opts.quote : sinaQuote();
    },
  } as unknown as SinaProvider;
}

describe('CompositeProvider（注入桩 Provider）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getQuote 走腾讯', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent(), sina: stubSina() });
    const q = await m.getQuote('TSLA');
    expect(q).not.toBeNull();
    expect(q!.price).toBe(342.27);
    expect(q!.marketCap).toBeCloseTo(13518.11587 * 1e8, 0);
  });

  it('腾讯失败时兜底新浪', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent({ throw: true }), sina: stubSina() });
    const q = await m.getQuote('TSLA');
    expect(q!.price).toBe(342.27);
    expect(q!.afterHoursPrice).toBe(341.63); // 新浪的盘后价
  });

  it('无 key 时估值/基本面降级为腾讯底座', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent(), sina: stubSina() });
    const f = await m.getFinancials('TSLA');
    expect(f!.source).toBe('tencent');
    expect(f!.pe).toBeNull();
    expect(f!.pb).toBeNull();
    expect(f!.marketCap).toBeCloseTo(13518.11587 * 1e8, 0);
    expect(f!.sharesOutstanding).toBe(3949547394);
  });

  it('有 key 时估值/基本面用 Finnhub 增强', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u.includes('/stock/metric'))
          return new Response(JSON.stringify({ metric: { peTTM: 20.5, pb: 8.2, epsTTM: 10.1 } }), { status: 200 });
        if (u.includes('/stock/profile2'))
          return new Response(JSON.stringify({ shareOutstanding: 3200 }), { status: 200 });
        throw new Error(`unexpected: ${u}`);
      }),
    );
    const m = new CompositeProvider({ finnhubApiKey: 'fake' }, { tencent: stubTencent(), sina: stubSina() });
    const f = await m.getFinancials('TSLA');
    expect(f!.source).toBe('finnhub');
    expect(f!.pe).toBe(20.5);
    expect(f!.pb).toBe(8.2);
    expect(f!.sharesOutstanding).toBe(3200000000);
  });

  it('Finnhub 失败时降级腾讯底座（不抛错）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));
    const m = new CompositeProvider({ finnhubApiKey: 'fake' }, { tencent: stubTencent(), sina: stubSina() });
    const f = await m.getFinancials('TSLA');
    expect(f!.source).toBe('tencent');
    expect(f!.pe).toBeNull();
  });

  it('无 key 时新闻返回 []', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent(), sina: stubSina() });
    expect(await m.getNews('TSLA', 5)).toEqual([]);
  });

  it('日K 走腾讯 kline', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent(), sina: stubSina() });
    const k = await m.getKline('TSLA', 'day', 5);
    expect(k.length).toBe(3);
    expect(k[2]!.open).toBe(342.33);
    expect(k[2]!.close).toBe(342.27);
    expect(k[2]!.high).toBe(351.26);
  });

  it('批量 getQuotes 去重', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent(), sina: stubSina() });
    const qs = await m.getQuotes(['TSLA', 'tsla', 'TSLA']);
    expect(qs.length).toBe(1);
    expect(qs[0]!.symbol).toBe('TSLA');
  });
});
