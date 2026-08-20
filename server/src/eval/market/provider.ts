import type { MarketQuote, Financials, NewsItem, KlineBar } from './types.js';

/**
 * 市场数据 Provider 能力接口。
 * 各方法均为可选：不同 Provider 只实现自己能力子集
 * （腾讯=行情/K线；新浪=行情；Finnhub=基本面/新闻/K线）；CompositeProvider 是完整门面。
 */
export interface MarketDataProvider {
  readonly name: string;
  getQuote?(symbol: string): Promise<MarketQuote | null>;
  getFinancials?(symbol: string): Promise<Financials | null>;
  getNews?(symbol: string, limit?: number): Promise<NewsItem[]>;
  getKline?(symbol: string, interval?: string, count?: number): Promise<KlineBar[]>;
}
