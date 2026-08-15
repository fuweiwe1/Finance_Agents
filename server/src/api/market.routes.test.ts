import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { CompositeProvider } from '../market/composite.js';
import { parseTencentAshareQuote } from '../market/tencent.js';
import { parseSinaAshareQuote } from '../market/sina.js';
import type { KlineBar } from '../market/types.js';
import type { TencentProvider } from '../market/tencent.js';
import type { SinaProvider } from '../market/sina.js';

const fixture = (name: string) => readFileSync(new URL(`../market/__tests__/fixtures/${name}`, import.meta.url), 'utf8');
const quoteLine = (code: string) =>
  fixture('tencent.ashare.quote.txt').split('\n').find((l) => l.startsWith(`v_${code}=`))!;
const mtQuote = () => parseTencentAshareQuote(quoteLine('sh600519'), '600519')!;
const mtSina = () => parseSinaAshareQuote(fixture('sina.ashare.quote.txt'), '600519')!;
const mtKlines: KlineBar[] = [
  { ts: 1783900800, open: 1355, high: 1359, low: 1338.14, close: 1341.99, volume: 2985300 },
];

function stubMarket(): CompositeProvider {
  const tencent = {
    name: 'tencent',
    getQuote: async () => mtQuote(),
    getKline: async () => mtKlines,
  } as unknown as TencentProvider;
  const sina = { name: 'sina', getQuote: async () => mtSina() } as unknown as SinaProvider;
  return new CompositeProvider({}, { tencent, sina });
}

describe('市场 API 契约（桩 Provider + 真实 A 股解析）', () => {
  it('GET /api/market/quote', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/quote').query({ symbol: '600519' });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(1341.99);
    expect(res.body.name).toBe('贵州茅台');
    expect(res.body.pe).toBeCloseTo(20.6, 2);
  });

  it('GET /api/market/quote 非法代码 → 400', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/quote').query({ symbol: 'TSLA' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_symbol');
  });

  it('GET /api/market/quotes 批量去重', async () => {
    const res = await request(createApp({ market: stubMarket() }))
      .get('/api/market/quotes')
      .query({ symbols: '600519,600519' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].price).toBe(1341.99);
  });

  it('GET /api/market/financials', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/financials').query({ symbol: '600519' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('tencent');
    expect(res.body.pe).toBeCloseTo(20.6, 2);
  });

  it('GET /api/market/news 返回新闻数组', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/news').query({ symbol: '600519' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/market/kline 腾讯日K', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/kline').query({ symbol: '600519' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].close).toBe(1341.99);
  });

  it('GET /api/market/search', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/search').query({ q: '600519' });
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.name).toBe('贵州茅台');
  });
});

describe('自选 API', () => {
  it('默认自选(A股) + 增删', async () => {
    const app = createApp({ market: stubMarket() });
    const get = await request(app).get('/api/watchlist');
    expect(get.status).toBe(200);
    expect(get.body).toEqual(['600519', '000001', '300750']);

    const add = await request(app).post('/api/watchlist').send({ symbol: '002594' });
    expect(add.status).toBe(200);
    expect(add.body).toContain('002594');

    const del = await request(app).delete('/api/watchlist/600519');
    expect(del.status).toBe(200);
    expect(del.body).not.toContain('600519');
  });

  it('添加非法代码 → 400', async () => {
    const res = await request(createApp({ market: stubMarket() })).post('/api/watchlist').send({ symbol: 'TSLA' });
    expect(res.status).toBe(400);
  });
});
