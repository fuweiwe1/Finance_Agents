import { useEffect, useRef, useState } from 'react';
import { api, type Financials, type KlineBar, type MarketQuote, type NewsItem } from '../lib/api';

/**
 * 通用轮询：deps 变化重启；失败指数退避(1→2→4→8)；页面隐藏时暂停请求但仍重排；
 * 每次调度加 ±20% 抖动，避免同一时刻集中请求。
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[]): T | null {
  const [data, setData] = useState<T | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1;

    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(tick, intervalMs);
        return;
      }
      try {
        const d = await fetcherRef.current();
        if (cancelled) return;
        setData(d);
        backoff = 1;
      } catch {
        if (cancelled) return;
        backoff = Math.min(backoff * 2, 8);
      }
      if (cancelled) return;
      const jitter = 0.8 + Math.random() * 0.4;
      timer = setTimeout(tick, intervalMs * jitter * backoff);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // deps 由调用方显式传入（symbol/join 串等），故不把 fetcher 闭包列为依赖
  }, deps);

  return data;
}

export function useQuote(symbol: string): MarketQuote | null {
  return usePolling(() => api.quote(symbol), 10_000, [symbol]);
}

export function useQuotesBatch(symbols: string[]): MarketQuote[] | null {
  const key = [...symbols].sort().join(',').toLowerCase();
  return usePolling(() => api.quotes(symbols), 10_000, [key]);
}

export function useFinancials(symbol: string): Financials | null {
  return usePolling(() => api.financials(symbol), 60_000, [symbol]);
}

export function useKline(symbol: string, count = 120): KlineBar[] | null {
  return usePolling(() => api.kline(symbol, count), 60_000, [symbol, count]);
}

export function useNews(symbol: string, limit = 10): NewsItem[] | null {
  return usePolling(() => api.news(symbol, limit), 60_000, [symbol, limit]);
}
