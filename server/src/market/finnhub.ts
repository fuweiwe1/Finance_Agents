import { MarketDataError, type Financials, type KlineBar, type NewsItem } from './types.js';
import type { MarketDataProvider } from './provider.js';

interface FinnhubMetricResponse {
  metric?: Record<string, unknown>;
  [k: string]: unknown;
}

interface FinnhubProfile2 {
  marketCapitalization?: number; // 单位：百万 USD
  shareOutstanding?: number;
  name?: string;
}

interface FinnhubNewsItem {
  id?: number;
  headline: string;
  summary?: string;
  source?: string;
  url?: string;
  datetime?: number; // unix 秒
}

interface FinnhubCandle {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  t: number[];
  v: number[];
  s: 'ok' | 'no_data';
}

const API_BASE = 'https://finnhub.io/api/v1';

/** 免费档 60 次/分；调用方靠缓存 + 批量 + 轮询节流控制配额 */
export class FinnhubProvider implements MarketDataProvider {
  readonly name = 'finnhub';

  constructor(private readonly apiKey: string) {}

  private async get<T>(path: string): Promise<T> {
    const url = `${API_BASE}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (res.status === 401 || res.status === 403) {
      throw new MarketDataError('invalid Finnhub API key', 'finnhub', 'provider');
    }
    if (res.status === 429) {
      throw new MarketDataError('Finnhub rate limit (60/min) exceeded', 'finnhub', 'provider');
    }
    if (!res.ok) throw new MarketDataError(`HTTP ${res.status}`, 'finnhub', 'network');
    return (await res.json()) as T;
  }

  async getFinancials(symbol: string): Promise<Financials | null> {
    const [metricRes, profileRes] = await Promise.all([
      this.get<FinnhubMetricResponse>(`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`),
      this.get<FinnhubProfile2>(`/stock/profile2?symbol=${encodeURIComponent(symbol)}`),
    ]);
    const m = metricRes.metric ?? {};
    return {
      symbol,
      pe: (m['peTTM'] as number | undefined) ?? null,
      pb: (m['pb'] as number | undefined) ?? null,
      eps: (m['epsTTM'] as number | undefined) ?? null,
      dividendYield: (m['dividendYieldIndicatedAnnual'] as number | undefined) ?? null,
      // Finnhub profile2 的 shareOutstanding/marketCapitalization 单位都是「百万」
      sharesOutstanding: profileRes.shareOutstanding !== undefined ? profileRes.shareOutstanding * 1e6 : null,
      marketCap: profileRes.marketCapitalization !== undefined ? profileRes.marketCapitalization * 1e6 : null,
      turnoverRate: null,
      source: 'finnhub',
    };
  }

  async getNews(symbol: string, limit = 10): Promise<NewsItem[]> {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 30 * 24 * 3600;
    const items = await this.get<FinnhubNewsItem[]>(
      `/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmtDate(from)}&to=${fmtDate(to)}`,
    );
    return items.slice(0, limit).map((n) => ({
      id: n.id !== undefined ? String(n.id) : undefined,
      symbol,
      title: n.headline,
      summary: n.summary,
      source: n.source,
      url: n.url,
      time: n.datetime ? new Date(n.datetime * 1000).toISOString() : '',
    }));
  }

  async getKline(symbol: string, interval = 'D', count = 120): Promise<KlineBar[]> {
    const resolution = mapResolution(interval);
    const to = Math.floor(Date.now() / 1000);
    const from = to - count * 24 * 3600;
    const candle = await this.get<FinnhubCandle>(
      `/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}`,
    );
    if (candle.s !== 'ok' || !candle.t.length) return [];
    const bars: KlineBar[] = [];
    for (let i = 0; i < candle.t.length; i++) {
      const ts = candle.t[i];
      const o = candle.o[i];
      const h = candle.h[i];
      const l = candle.l[i];
      const c = candle.c[i];
      if (ts === undefined || o === undefined || h === undefined || l === undefined || c === undefined) continue;
      bars.push({ ts, open: o, high: h, low: l, close: c, volume: candle.v[i] ?? 0 });
    }
    return bars;
  }
}

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function mapResolution(interval: string): string {
  switch (interval) {
    case 'week':
    case '1w':
      return 'W';
    case 'month':
    case '1M':
      return 'M';
    default:
      return 'D';
  }
}
