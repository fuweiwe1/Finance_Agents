import type { AgentTrace, Financials, KlineBar, MarketQuote, ModelConfigInfo, NewsItem, SearchResult, SessionMeta } from './api';

/** preload 暴露的 window.api（与 electron/src/preload/index.ts 一致） */
export interface ElectronApi {
  market: {
    quote: (symbol: string) => Promise<MarketQuote>;
    quotes: (symbols: string[]) => Promise<MarketQuote[]>;
    financials: (symbol: string) => Promise<Financials>;
    news: (symbol: string, limit?: number) => Promise<NewsItem[]>;
    kline: (symbol: string, count?: number) => Promise<KlineBar[]>;
    search: (q: string) => Promise<SearchResult>;
  };
  watchlist: {
    list: () => Promise<string[]>;
    add: (symbol: string) => Promise<string[]>;
    remove: (symbol: string) => Promise<string[]>;
  };
  sessions: {
    list: () => Promise<SessionMeta[]>;
    create: () => Promise<SessionMeta>;
    remove: (id: string) => Promise<{ ok: boolean }>;
  };
  modelConfig: {
    get: () => Promise<ModelConfigInfo>;
    save: (cfg: Record<string, unknown>) => Promise<{ ok: boolean }>;
  };
  agent: {
    chat: (payload: { sessionId: string; message: string; context?: { symbol?: string; name?: string; price?: number } }) => Promise<{ ok: boolean }>;
    onEvent: (cb: (packet: { type: string; data: unknown }) => void) => () => void;
  };
  traces: {
    list: (query?: { sessionId?: string; outcome?: string; limit?: number }) => Promise<AgentTrace[]>;
    get: (id: string) => Promise<AgentTrace>;
    feedback: (id: string, rating: number, reason?: string, reasons?: string[]) => Promise<{ ok: boolean }>;
  };
}

declare global {
  interface Window {
    api?: ElectronApi;
  }
}

/** 运行在 Electron 渲染进程（preload 已注入 window.api）时为 true；浏览器 dev 为 false */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.api !== 'undefined';
}

export function electronApi(): ElectronApi {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error('Electron bridge (window.api) 不可用');
  }
  return window.api;
}