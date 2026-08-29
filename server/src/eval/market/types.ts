export type MarketSession = 'pre' | 'regular' | 'post' | 'closed';

/** 统一的市场报价类型（内部规范，跨 Provider 归一化） */
export interface MarketQuote {
  symbol: string; // 归一化代码，如 "TSLA"
  code: string; // 带交易所限定，如 "TSLA.OQ" / "TSLA.US"
  name: string; // 展示名（中文优先，英文兜底）
  price: number;
  change: number; // 涨跌额
  changePct: number; // 涨跌幅 %
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number; // 股
  currency: string;
  quoteTime: string; // Provider 原始时间串
  marketCap?: number; // USD
  marketCapFloat?: number; // USD
  week52High?: number;
  week52Low?: number;
  sharesOutstanding?: number;
  afterHoursPrice?: number;
  afterHoursChangePct?: number;
  session: MarketSession;
  // A 股行情字段直接携带的财务指标（腾讯）
  pe?: number;
  pb?: number;
  turnoverRate?: number;
  eps?: number;
  volumeRatio?: number; // 量比（腾讯字段 49）
}

export interface Financials {
  symbol: string;
  pe?: number | null;
  pb?: number | null;
  turnoverRate?: number | null; // 换手率 %
  marketCap?: number | null; // 元
  eps?: number | null;
  dividendYield?: number | null; // %
  sharesOutstanding?: number | null;
  source: 'tencent' | 'unavailable';
}

export interface NewsItem {
  id?: string;
  symbol: string;
  title: string;
  summary?: string;
  source?: string;
  url?: string;
  time: string; // ISO
}

export interface KlineBar {
  ts: number; // unix 秒
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: 'network' | 'parse' | 'invalid_symbol' | 'provider',
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}
