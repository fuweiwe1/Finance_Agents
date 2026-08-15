import { useQuote } from '../../hooks/usePolling';
import { fmtPct, fmtPrice, fmtVolume, trendColor, SESSION_LABEL } from '../../lib/format';
import { Skeleton } from '../ui/Skeleton';

export function MarketHeader({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);

  const metrics = q
    ? [
        { label: 'Open', value: fmtPrice(q.open) },
        { label: 'High', value: fmtPrice(q.high) },
        { label: 'Low', value: fmtPrice(q.low) },
        { label: 'Prev Close', value: fmtPrice(q.prevClose) },
        { label: 'Volume', value: fmtVolume(q.volume) },
      ]
    : null;

  return (
    <div className="mb-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            {q ? (
              <h1 className="truncate text-xl font-semibold text-slate-900">{q.name}</h1>
            ) : (
              <Skeleton className="h-6 w-44" />
            )}
            {q ? (
              <span className="shrink-0 text-sm text-slate-500">{q.symbol}.US</span>
            ) : (
              <Skeleton className="h-4 w-14" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {q ? (
              <>
                <span className={`text-4xl font-bold tabular-nums ${trendColor(q.changePct)}`}>{fmtPrice(q.price)}</span>
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
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                q.session === 'post'
                  ? 'bg-amber-100 text-amber-700'
                  : q.session === 'regular'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {SESSION_LABEL[q.session] ?? q.session}
            </span>
          ) : (
            <Skeleton className="ml-auto h-6 w-24" />
          )}
          <div className="mt-2 text-xs text-slate-400">{q ? `币种 ${q.currency}` : ''}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-slate-100 pt-3">
        {metrics
          ? metrics.map((m) => (
              <div key={m.label} className="flex items-baseline gap-1.5">
                <span className="text-xs uppercase tracking-wide text-slate-400">{m.label}</span>
                <span className="text-sm font-medium tabular-nums text-slate-700">{m.value}</span>
              </div>
            ))
          : [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-20" />)}
      </div>
    </div>
  );
}
