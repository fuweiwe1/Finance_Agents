import { useQuote } from '../../hooks/usePolling';
import { fmtPct, fmtPrice, fmtVolumeCn, trendColor, SESSION_LABEL, exchangeLabel } from '../../lib/format';
import { Skeleton } from '../ui/Skeleton';

export function MarketHeader({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);

  const metrics = q
    ? [
        { label: 'Open', value: fmtPrice(q.open) },
        { label: 'High', value: fmtPrice(q.high) },
        { label: 'Low', value: fmtPrice(q.low) },
        { label: 'Prev Close', value: fmtPrice(q.prevClose) },
        { label: 'Volume', value: fmtVolumeCn(q.volume) },
      ]
    : null;

  return (
    <div className="card mb-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            {q ? (
              <h1 className="truncate text-xl font-semibold text-ink">{q.name}</h1>
            ) : (
              <Skeleton className="h-6 w-44" />
            )}
            {q ? (
              <span className="shrink-0 rounded-md bg-surface-soft px-1.5 py-0.5 text-xs text-ink-soft">
                {q.symbol}
                {exchangeLabel(q.code) ? ` · ${exchangeLabel(q.code)}` : ''}
              </span>
            ) : (
              <Skeleton className="h-4 w-14" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {q ? (
              <>
                <span className={`font-display text-5xl font-semibold leading-tight tabular-nums ${trendColor(q.changePct)}`}>{fmtPrice(q.price)}</span>
                <span className={`text-lg font-medium tabular-nums ${trendColor(q.changePct)}`}>
                  {q.change > 0 ? '+' : ''}
                  {fmtPrice(q.change)} ({fmtPct(q.changePct)})
                </span>
              </>
            ) : (
              <Skeleton className="h-9 w-40" />
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {q ? (
            <span
              className={`chip ${
                q.session === 'regular'
                  ? 'bg-status-soft text-status'
                  : q.session === 'pre'
                    ? 'bg-pre-soft text-pre'
                    : 'bg-surface-soft text-ink-soft'
              }`}
            >
              {SESSION_LABEL[q.session] ?? q.session}
            </span>
          ) : (
            <Skeleton className="ml-auto h-6 w-24" />
          )}
          <div className="mt-2 text-xs text-ink-faint">{q ? `币种 ${q.currency}` : ''}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-line pt-3">
        {metrics
          ? metrics.map((m) => (
              <div key={m.label} className="flex items-baseline gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-ink-faint">{m.label}</span>
                <span className="text-sm font-medium tabular-nums text-ink">{m.value}</span>
              </div>
            ))
          : [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-20" />)}
      </div>
    </div>
  );
}
