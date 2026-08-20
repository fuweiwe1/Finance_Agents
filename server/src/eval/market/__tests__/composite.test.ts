import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CompositeProvider } from '../composite.js';
import { parseTencentAshareQuote } from '../tencent.js';
import { parseSinaAshareQuote } from '../sina.js';
import type { KlineBar, MarketQuote } from '../types.js';
import type { TencentProvider } from '../tencent.js';
import type { SinaProvider } from '../sina.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const quoteLine = (code: string) =>
  fixture('tencent.ashare.quote.txt').split('\n').find((l) => l.startsWith(`v_${code}=`))!;

const mtQuote = (): MarketQuote => parseTencentAshareQuote(quoteLine('sh600519'), '600519')!;
const mtSina = (): MarketQuote => parseSinaAshareQuote(fixture('sina.ashare.quote.txt'), '600519')!;
const mtKlines: KlineBar[] = [
  { ts: 1783900800, open: 1355, high: 1359, low: 1338.14, close: 1341.99, volume: 2985300 },
];

function stubTencent(opts: { quote?: MarketQuote | null; throw?: boolean } = {}) {
  return {
    name: 'tencent',
    getQuote: async () => {
      if (opts.throw) throw new Error('tencent down');
      return opts.quote !== undefined ? opts.quote : mtQuote();
    },
    getKline: async () => mtKlines,
  } as unknown as TencentProvider;
}

function stubSina(opts: { quote?: MarketQuote | null; throw?: boolean } = {}) {
  return {
    name: 'sina',
    getQuote: async () => {
      if (opts.throw) throw new Error('sina down');
      return opts.quote !== undefined ? opts.quote : mtSina();
    },
  } as unknown as SinaProvider;
}

describe('CompositeProvider（A股 · 注入桩 Provider）', () => {
  afterEach(() => {});

  it('getQuote 走腾讯', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent(), sina: stubSina() });
    const q = await m.getQuote('600519');
    expect(q).not.toBeNull();
    expect(q!.name).toBe('贵州茅台');
    expect(q!.price).toBe(1341.99);
  });

  it('腾讯失败时兜底新浪', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent({ throw: true }), sina: stubSina() });
    const q = await m.getQuote('600519');
    expect(q!.price).toBe(1341.99);
  });

  it('getFinancials 由腾讯报价字段构建', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent(), sina: stubSina() });
    const f = await m.getFinancials('600519');
    expect(f!.source).toBe('tencent');
    expect(f!.pe).toBeCloseTo(20.6, 2);
    expect(f!.pb).toBeCloseTo(6.68, 2);
    expect(f!.turnoverRate).toBeCloseTo(0.24, 2);
    expect(f!.marketCap).toBeCloseTo(16775.97 * 1e8, 0);
    expect(f!.sharesOutstanding).toBe(1250081601);
    expect(f!.eps).toBeCloseTo(1341.99 / 20.6, 1);
  });

  it('getNews 走东财并按股票名搜索', async () => {
    const body = `cb({"code":0,"result":{"cmsArticleWebOld":[
      {"date":"2026-08-15 16:51:11","code":"abc123","title":"<em>茅台</em>渠道改革半年考","content":"<em>贵州茅台</em>披露半年报。","url":"http://finance.eastmoney.com/a/abc123.html","mediaName":"北京商报"}
    ]}})`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u.includes('qt.gtimg.cn')) return new Response(quoteLine('sh600519'), { status: 200 });
        if (u.includes('search-api-web.eastmoney.com')) return new Response(body, { status: 200 });
        throw new Error(`unexpected: ${u}`);
      }),
    );
    const m = new CompositeProvider({}, { tencent: stubTencent(), sina: stubSina() });
    const news = await m.getNews('600519', 3);
    expect(news).toHaveLength(1);
    expect(news[0]!.title).toBe('茅台渠道改革半年考');
    expect(news[0]!.source).toBe('北京商报');
  });

  it('日K 走腾讯', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent(), sina: stubSina() });
    const k = await m.getKline('600519', 'day', 5);
    expect(k.length).toBe(1);
    expect(k[0]!.close).toBe(1341.99);
  });

  it('批量 getQuotes 去重', async () => {
    const m = new CompositeProvider({}, { tencent: stubTencent(), sina: stubSina() });
    const qs = await m.getQuotes(['600519', '600519']);
    expect(qs.length).toBe(1);
    expect(qs[0]!.symbol).toBe('600519');
  });
});
