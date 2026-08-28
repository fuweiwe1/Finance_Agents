import { electronApi, isElectron, type ElectronApi } from './bridge';

const BASE = '/api';

/** 双传输：Electron 渲染进程走 window.api(IPC)；浏览器 dev 走 fetch + Express */
const ipc: ElectronApi | null = isElectron() ? electronApi() : null;

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
  quote: (symbol: string) =>
    ipc ? ipc.market.quote(symbol) : request<MarketQuote>(`/market/quote?symbol=${encodeURIComponent(symbol)}`),
  quotes: (symbols: string[]) =>
    ipc ? ipc.market.quotes(symbols) : request<MarketQuote[]>(`/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`),
  financials: (symbol: string) =>
    ipc ? ipc.market.financials(symbol) : request<Financials>(`/market/financials?symbol=${encodeURIComponent(symbol)}`),
  news: (symbol: string, limit = 10) =>
    ipc
      ? ipc.market.news(symbol, limit)
      : request<NewsItem[]>(`/market/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`),
  kline: (symbol: string, count = 120) =>
    ipc
      ? ipc.market.kline(symbol, count)
      : request<KlineBar[]>(`/market/kline?symbol=${encodeURIComponent(symbol)}&interval=day&count=${count}`),
  search: (q: string) => (ipc ? ipc.market.search(q) : request<SearchResult>(`/market/search?q=${encodeURIComponent(q)}`)),

  watchlist: {
    list: () => (ipc ? ipc.watchlist.list() : request<string[]>('/watchlist')),
    add: (symbol: string) =>
      ipc
        ? ipc.watchlist.add(symbol)
        : request<string[]>('/watchlist', { method: 'POST', body: JSON.stringify({ symbol }) }),
    remove: (symbol: string) =>
      ipc
        ? ipc.watchlist.remove(symbol)
        : request<string[]>(`/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' }),
  },

  modelConfig: {
    get: () => (ipc ? ipc.modelConfig.get() : request<ModelConfigInfo>('/agent/model-config')),
    save: (cfg: ModelConfigInput) =>
      ipc
        ? ipc.modelConfig.save(cfg as unknown as Record<string, unknown>)
        : request<{ ok: boolean }>('/agent/model-config', { method: 'POST', body: JSON.stringify(cfg) }),
  },

  sessions: {
    list: () => (ipc ? ipc.sessions.list() : request<SessionMeta[]>('/agent/sessions')),
    create: () => (ipc ? ipc.sessions.create() : request<SessionMeta>('/agent/sessions', { method: 'POST' })),
    remove: (id: string) =>
      ipc ? ipc.sessions.remove(id) : request<{ ok: boolean }>(`/agent/sessions/${id}`, { method: 'DELETE' }),
  },

  chatUrl: (id: string) => `${BASE}/agent/sessions/${id}/chat`,

  traces: {
    list: (params?: { sessionId?: string; outcome?: string; limit?: number }) =>
      ipc ? ipc.traces.list(params) : request<AgentTrace[]>(`/traces${qs(params)}`),
    get: (id: string) => (ipc ? ipc.traces.get(id) : request<AgentTrace>(`/traces/${encodeURIComponent(id)}`)),
    feedback: (id: string, rating: number, reason?: string, reasons?: string[]) =>
      ipc
        ? ipc.traces.feedback(id, rating, reason, reasons)
        : request<{ ok: boolean }>(`/traces/${encodeURIComponent(id)}/feedback`, {
            method: 'POST',
            body: JSON.stringify({ rating, reason, reasons }),
          }),
  },
};

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

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

// ---- Traces（与后端 trace/types.ts 契约一致） ----
export interface TraceToolCall {
  toolName: string;
  args: unknown;
  result?: unknown;
  isError: boolean;
  startedAt: number;
  latencyMs: number;
}

export interface TraceTurn {
  modelId: string;
  startedAt: number;
  endedAt: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  responseText?: string;
  toolCalls: TraceToolCall[];
  stopReason?: string;
  error?: string;
}

export interface AgentTrace {
  id: string;
  sessionId: string;
  userMessage: string;
  context?: { symbol?: string; name?: string };
  startedAt: number;
  endedAt: number;
  totalMs: number;
  turns: TraceTurn[];
  outcome: 'ok' | 'error';
  errorMessage?: string;
  feedback?: { rating: number; reason?: string; reasons?: string[] };
}
