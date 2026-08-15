import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { CompositeProvider } from '../market/composite.js';
import { parseTencentQuote } from '../market/tencent.js';
import { parseSinaQuote } from '../market/sina.js';
import type { KlineBar } from '../market/types.js';
import type { TencentProvider } from '../market/tencent.js';
import type { SinaProvider } from '../market/sina.js';

const fixture = (name: string) => readFileSync(new URL(`../market/__tests__/fixtures/${name}`, import.meta.url), 'utf8');
const tlaQuote = () => parseTencentQuote(fixture('tencent.tsla.txt'), 'TSLA')!;
const sinaQuote = () => parseSinaQuote(fixture('sina.tsla.txt'), 'TSLA')!;
const tlaKlines: KlineBar[] = [
  { ts: 1784707200, open: 342.33, high: 351.26, low: 335.33, close: 342.27, volume: 45437144 },
];

function stubMarket(): CompositeProvider {
  const tencent = {
    name: 'tencent',
    getQuote: async () => tlaQuote(),
    getKline: async () => tlaKlines,
  } as unknown as TencentProvider;
  const sina = { name: 'sina', getQuote: async () => sinaQuote() } as unknown as SinaProvider;
  return new CompositeProvider({}, { tencent, sina });
}

describe('市场 API 契约（桩 Provider + 真实解析器）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('GET /api/market/quote', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/quote').query({ symbol: 'TSLA' });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(342.27);
    expect(res.body.name).toBe('特斯拉');
  });

  it('GET /api/market/quote 非法代码 → 400', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/quote').query({ symbol: 'BAD!!' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_symbol');
  });

  it('GET /api/market/quotes 批量去重', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/quotes').query({ symbols: 'TSLA,TSLA' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].price).toBe(342.27);
  });

  it('GET /api/market/financials 无 key 降级', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/financials').query({ symbol: 'TSLA' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('tencent');
    expect(res.body.pe).toBeNull();
    expect(res.body.marketCap).toBeCloseTo(13518.11587 * 1e8, 0);
  });

  it('GET /api/market/news 无 key → []', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/news').query({ symbol: 'TSLA' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/market/kline 腾讯日K', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/kline').query({ symbol: 'TSLA' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].close).toBe(342.27);
  });

  it('GET /api/market/search', async () => {
    const res = await request(createApp({ market: stubMarket() })).get('/api/market/search').query({ q: 'TSLA' });
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.name).toBe('特斯拉');
  });
});

describe('自选 API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('默认自选 + 增删', async () => {
    const app = createApp({ market: stubMarket() });
    const get = await request(app).get('/api/watchlist');
    expect(get.status).toBe(200);
    expect(get.body).toEqual(['TSLA', 'AAPL', 'NVDA']);

    const add = await request(app).post('/api/watchlist').send({ symbol: 'msft' });
    expect(add.status).toBe(200);
    expect(add.body).toContain('MSFT');

    const del = await request(app).delete('/api/watchlist/TSLA');
    expect(del.status).toBe(200);
    expect(del.body).not.toContain('TSLA');
  });

  it('添加非法代码 → 400', async () => {
    const res = await request(createApp({ market: stubMarket() })).post('/api/watchlist').send({ symbol: '!!!' });
    expect(res.status).toBe(400);
  });
});
