import { MarketDataError, type Financials, type KlineBar, type NewsItem, type MarketQuote } from './types.js';
import { normalizeSymbol } from './normalize.js';
import type { MarketDataProvider } from './provider.js';
import { TencentProvider } from './tencent.js';
import { SinaProvider } from './sina.js';
import { FinnhubProvider } from './finnhub.js';
import { TTLCache } from './cache.js';

export interface CompositeOptions {
  finnhubApiKey?: string;
  quoteTtlMs?: number; // 默认 10s
  financialsTtlMs?: number; // 默认 1h
  newsTtlMs?: number; // 默认 10min
  klineTtlMs?: number; // 默认 1h
}

/**
 * 组合 Provider：
 * - 行情(报价/批量/盘后) → 腾讯，失败兜底新浪；
 * - 估值/基本面/新闻/图表 → Finnhub（无 key 或失败时降级，不抛错）。
 */
export class CompositeProvider implements MarketDataProvider {
  readonly name = 'composite';
  private readonly tencent: TencentProvider;
  private readonly sina: SinaProvider;
  private readonly finnhub: FinnhubProvider | null;
  private readonly quoteCache: TTLCache<MarketQuote | null>;
  private readonly finCache: TTLCache<Financials | null>;
  private readonly newsCache: TTLCache<NewsItem[]>;
  private readonly klineCache: TTLCache<KlineBar[]>;

  /** deps 仅供测试注入桩 Provider */
  constructor(
    opts: CompositeOptions = {},
    deps: { tencent?: TencentProvider; sina?: SinaProvider } = {},
  ) {
    this.tencent = deps.tencent ?? new TencentProvider();
    this.sina = deps.sina ?? new SinaProvider();
    this.finnhub = opts.finnhubApiKey ? new FinnhubProvider(opts.finnhubApiKey) : null;
    this.quoteCache = new TTLCache(opts.quoteTtlMs ?? 10_000);
    this.finCache = new TTLCache(opts.financialsTtlMs ?? 3_600_000);
    this.newsCache = new TTLCache(opts.newsTtlMs ?? 600_000);
    this.klineCache = new TTLCache(opts.klineTtlMs ?? 3_600_000);
  }

  get hasFinnhub(): boolean {
    return this.finnhub !== null;
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
    const key = norm.symbol.toLowerCase();
    return this.finCache.get(key, async () => {
      const quote = await this.getQuote(key).catch(() => null);
      const base: Financials = {
        symbol: norm.symbol,
        pe: null,
        pb: null,
        turnoverRate: null,
        eps: null,
        dividendYield: null,
        marketCap: quote?.marketCap ?? null,
        sharesOutstanding: quote?.sharesOutstanding ?? null,
        source: 'tencent',
      };
      if (!this.finnhub) return base; // 无 key → 只有腾讯提供的市值/股本
      try {
        const f = await this.finnhub.getFinancials(norm.symbol);
        if (!f) return base;
        const shares = f.sharesOutstanding ?? base.sharesOutstanding;
        const volume = quote?.volume;
        const turnoverRate = volume && shares ? (volume / shares) * 100 : f.turnoverRate;
        return {
          ...f,
          symbol: norm.symbol,
          marketCap: f.marketCap ?? base.marketCap,
          sharesOutstanding: shares,
          turnoverRate,
        };
      } catch (err) {
        console.warn(`[composite] finnhub financials failed for ${symbol}: ${(err as Error).message}`);
        return base;
      }
    });
  }

  async getNews(symbol: string, limit = 10): Promise<NewsItem[]> {
    const norm = normalizeSymbol(symbol);
    const fh = this.finnhub;
    if (!norm || !fh) return [];
    const key = `${norm.symbol.toLowerCase()}:${limit}`;
    return this.newsCache.get(key, () => fh.getNews(norm.symbol, limit));
  }

  async getKline(symbol: string, interval = 'day', count = 120): Promise<KlineBar[]> {
    const norm = normalizeSymbol(symbol);
    if (!norm) return [];
    const key = `${norm.symbol.toLowerCase()}:${interval}:${count}`;
    const fh = this.finnhub;
    if (interval === 'day' || interval === '1d') {
      // 日K优先走腾讯（免费国内可达），失败降级 Finnhub
      return this.klineCache.get(key, async () => {
        try {
          return await this.tencent.getKline(norm.symbol, 'day', count);
        } catch (err) {
          if (err instanceof MarketDataError && err.code === 'invalid_symbol') throw err;
          if (!fh) throw err;
          return fh.getKline(norm.symbol, 'D', count);
        }
      });
    }
    if (!fh) return [];
    return this.klineCache.get(key, () => fh.getKline(norm.symbol, interval, count));
  }
}
