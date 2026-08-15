const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      message = body.error ?? message;
    } catch {
      /* ignore */
    }
    const err = new Error(message) as Error & { code?: string; status?: number };
    err.code = (await res.clone().json().catch(() => null))?.code;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export const api = {
  quote: (symbol: string) => request<MarketQuote>(`/market/quote?symbol=${encodeURIComponent(symbol)}`),
  quotes: (symbols: string[]) =>
    request<MarketQuote[]>(`/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`),
  financials: (symbol: string) => request<Financials>(`/market/financials?symbol=${encodeURIComponent(symbol)}`),
  news: (symbol: string, limit = 10) =>
    request<NewsItem[]>(`/market/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`),
  kline: (symbol: string, count = 120) =>
    request<KlineBar[]>(`/market/kline?symbol=${encodeURIComponent(symbol)}&interval=day&count=${count}`),
  search: (q: string) => request<SearchResult>(`/market/search?q=${encodeURIComponent(q)}`),

  watchlist: {
    list: () => request<string[]>('/watchlist'),
    add: (symbol: string) => request<string[]>('/watchlist', { method: 'POST', body: JSON.stringify({ symbol }) }),
    remove: (symbol: string) => request<string[]>(`/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' }),
  },

  modelConfig: {
    get: () => request<ModelConfigInfo>('/agent/model-config'),
    save: (cfg: ModelConfigInput) =>
      request<{ ok: boolean }>('/agent/model-config', { method: 'POST', body: JSON.stringify(cfg) }),
  },

  sessions: {
    list: () => request<SessionMeta[]>('/agent/sessions'),
    create: () => request<SessionMeta>('/agent/sessions', { method: 'POST' }),
    remove: (id: string) => request<{ ok: boolean }>(`/agent/sessions/${id}`, { method: 'DELETE' }),
  },

  chatUrl: (id: string) => `${BASE}/agent/sessions/${id}/chat`,
};

// ---- 类型（与后端契约一致） ----
export interface MarketQuote {
  symbol: string;
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  currency: string;
  quoteTime: string;
  marketCap?: number;
  marketCapFloat?: number;
  week52High?: number;
  week52Low?: number;
  sharesOutstanding?: number;
  afterHoursPrice?: number;
  afterHoursChangePct?: number;
  session: 'pre' | 'regular' | 'post' | 'closed';
}

export interface Financials {
  symbol: string;
  pe?: number | null;
  pb?: number | null;
  turnoverRate?: number | null;
  marketCap?: number | null;
  eps?: number | null;
  dividendYield?: number | null;
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
  time: string;
}

export interface KlineBar {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SearchResult {
  found: boolean;
  symbol?: string;
  code?: string;
  name?: string;
  price?: number;
  changePct?: number;
}

export interface SessionMeta {
  id: string;
  title: string;
  msgCount: number;
  createdAt: string;
}

export type ModelProvider = 'custom-openai' | 'openai';

export interface ModelConfigInfo {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

export interface ModelConfigInput {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
}
