import { MarketDataError, type Financials, type KlineBar, type NewsItem, type MarketQuote } from './types.js';
import { normalizeSymbol } from './normalize.js';
import type { MarketDataProvider } from './provider.js';
import { TencentProvider } from './tencent.js';
import { SinaProvider } from './sina.js';
import { fetchNewsByName } from './eastmoneyNews.js';
import { TTLCache } from './cache.js';

export interface CompositeOptions {
  quoteTtlMs?: number; // 默认 10s
  klineTtlMs?: number; // 默认 1h
  newsTtlMs?: number; // 默认 10min
}

/**
 * 组合 Provider（仅 A 股，全部国内免费源）：
 * - 行情(报价/批量) → 腾讯，失败兜底新浪；
 * - 基本面 → 腾讯报价字段（PE/PB/换手/市值/股本/EPS 推导）；
 * - 新闻 → 东方财富（按股票名搜索）；
 * - 日K → 腾讯 fqkline（qfqday）。
 */
export class CompositeProvider implements MarketDataProvider {
  readonly name = 'composite';
  private readonly tencent: TencentProvider;
  private readonly sina: SinaProvider;
  private readonly quoteCache: TTLCache<MarketQuote | null>;
  private readonly klineCache: TTLCache<KlineBar[]>;
  private readonly newsCache: TTLCache<NewsItem[]>;

  /** deps 仅供测试注入桩 Provider */
  constructor(
    opts: CompositeOptions = {},
    deps: { tencent?: TencentProvider; sina?: SinaProvider } = {},
  ) {
    this.tencent = deps.tencent ?? new TencentProvider();
    this.sina = deps.sina ?? new SinaProvider();
    this.quoteCache = new TTLCache(opts.quoteTtlMs ?? 10_000);
    this.klineCache = new TTLCache(opts.klineTtlMs ?? 3_600_000);
    this.newsCache = new TTLCache(opts.newsTtlMs ?? 600_000);
  }

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    return this.quoteCache.get(symbol.toLowerCase(), async () => {
      try {
        const q = await this.tencent.getQuote(symbol);
        if (q) return q;
      } catch (err) {
        console.warn(`[composite] tencent failed for ${symbol}, fallback to sina: ${(err as Error).message}`);
      }
      return this.sina.getQuote(symbol);
    });
  }

  /** 批量行情（自选列表一次拉全，减少请求数） */
  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const out: MarketQuote[] = [];
    const uniq = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
    for (const s of uniq) {
      const q = await this.getQuote(s).catch(() => null);
      if (q) out.push(q);
    }
    return out;
  }

  async getFinancials(symbol: string): Promise<Financials | null> {
    const norm = normalizeSymbol(symbol);
    if (!norm) return null;
    const q = await this.getQuote(norm.symbol).catch(() => null);
    if (!q) return null;
    return {
      symbol: norm.symbol,
      pe: q.pe ?? null,
      pb: q.pb ?? null,
      turnoverRate: q.turnoverRate ?? null,
      marketCap: q.marketCap ?? null,
      eps: q.eps ?? null,
      dividendYield: null, // 腾讯行情未提供股息率
      sharesOutstanding: q.sharesOutstanding ?? null,
      source: 'tencent',
    };
  }

  async getNews(symbol: string, limit = 10): Promise<NewsItem[]> {
    const norm = normalizeSymbol(symbol);
    if (!norm) return [];
    const key = `${norm.symbol.toLowerCase()}:${limit}`;
    return this.newsCache.get(key, async () => {
      // 东财按股票名搜索；先取报价拿名字，失败用代码兜底
      const q = await this.getQuote(norm.symbol).catch(() => null);
      const name = q?.name ?? norm.symbol;
      try {
        return await fetchNewsByName(name, limit);
      } catch (err) {
        console.warn(`[composite] news failed for ${symbol}: ${(err as Error).message}`);
        return [];
      }
    });
  }

  async getKline(symbol: string, interval = 'day', count = 120): Promise<KlineBar[]> {
    const norm = normalizeSymbol(symbol);
    if (!norm) return [];
    const key = `${norm.symbol.toLowerCase()}:${interval}:${count}`;
    return this.klineCache.get(key, async () => {
      try {
        return await this.tencent.getKline(norm.symbol, interval, count);
      } catch (err) {
        if (err instanceof MarketDataError && err.code === 'invalid_symbol') throw err;
        // 腾讯 K 线失败 → 返回空而非抛错（图表显示空态引导）
        console.warn(`[composite] kline failed for ${symbol}: ${(err as Error).message}`);
        return [];
      }
    });
  }
}
