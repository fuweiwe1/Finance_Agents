import { useState } from 'react';
import { useAppStore } from '../../state/useAppStore';
import { useQuotesBatch } from '../../hooks/usePolling';
import { api, type MarketQuote } from '../../lib/api';
import { fmtPct, fmtPrice, trendColor } from '../../lib/format';

export function WatchlistSection() {
  const watchlist = useAppStore((s) => s.watchlist);
  const selected = useAppStore((s) => s.selected);
  const select = useAppStore((s) => s.select);
  const addToWatchlist = useAppStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useAppStore((s) => s.removeFromWatchlist);
  const quotes = useQuotesBatch(watchlist);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const quoteMap = new Map((quotes ?? []).map((x) => [x.symbol.toUpperCase(), x]));

  const add = async () => {
    const term = q.trim();
    if (!term) return;
    setAdding(true);
    setError('');
    try {
      const found = await api.search(term);
      if (!found.found || !found.symbol) {
        setError(`未找到 "${term}"`);
        return;
      }
      await addToWatchlist(found.symbol);
      setQ('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="flex-1 overflow-y-auto border-b border-line p-3">
      <h2 className="eyebrow mb-2">WATCHLIST</h2>
      <div className="mb-2 flex gap-1">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
          placeholder="输入股票代码"
          className="input-sm w-full"
        />
        <button
          onClick={() => void add()}
          disabled={adding}
          title="添加到自选"
          className="btn-primary shrink-0"
        >
          ＋
        </button>
      </div>
      {error && <p className="mb-1 text-xs text-up">{error}</p>}
      <ul className="space-y-0.5">
        {watchlist.map((sym) => (
          <WatchlistRow
            key={sym}
            symbol={sym}
            quote={quoteMap.get(sym.toUpperCase())}
            active={selected === sym}
            onSelect={() => select(sym)}
            onRemove={() => void removeFromWatchlist(sym)}
          />
        ))}
        {!watchlist.length && <li className="py-3 text-center text-xs text-ink-faint">暂无自选，搜索添加</li>}
      </ul>
    </section>
  );
}

function WatchlistRow({
  symbol,
  quote,
  active,
  onSelect,
  onRemove,
}: {
  symbol: string;
  quote?: MarketQuote;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      onClick={onSelect}
      className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        active ? 'bg-accent-soft' : 'hover:bg-surface-soft'
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{symbol}</div>
        <div className="truncate text-xs text-ink-faint">{quote?.name ?? '—'}</div>
      </div>
      <div className="ml-2 flex items-center gap-1.5 text-right">
        <div>
          <div className="text-sm tabular-nums text-ink-soft">{fmtPrice(quote?.price)}</div>
          <div className={`text-xs tabular-nums ${trendColor(quote?.changePct)}`}>{fmtPct(quote?.changePct)}</div>
        </div>
        <button
          title="从自选移除"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded p-0.5 text-line-strong opacity-0 transition-opacity hover:bg-surface-soft hover:text-up group-hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
