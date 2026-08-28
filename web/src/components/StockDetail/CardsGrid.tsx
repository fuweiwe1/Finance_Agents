import type { ReactNode } from 'react';
import { useFinancials, useQuote } from '../../hooks/usePolling';
import { fmtCapCn, fmtPct, fmtPrice, fmtShares, fmtVolumeCn, trendColor } from '../../lib/format';

function KV({ label, value, className = '' }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
      <span className={`text-sm font-medium tabular-nums text-ink ${className}`}>{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="eyebrow mb-2">{title}</h3>
      {children}
    </div>
  );
}

/** 2×2 指标卡网格：QUOTE / PERFORMANCE / VALUATION / BASIC FUNDAMENTALS（A 股） */
export function CardsGrid({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);
  const f = useFinancials(symbol);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card title="QUOTE">
        <KV label="Price" value={fmtPrice(q?.price)} className={trendColor(q?.changePct)} />
        <KV label="Change" value={fmtPct(q?.changePct)} className={trendColor(q?.changePct)} />
        <KV label="Volume" value={fmtVolumeCn(q?.volume)} />
      </Card>

      <Card title="PERFORMANCE">
        <KV label="Day Range" value={q ? `${fmtPrice(q.low)} – ${fmtPrice(q.high)}` : '—'} />
        <KV label="Open" value={fmtPrice(q?.open)} />
        <KV label="Prev Close" value={fmtPrice(q?.prevClose)} />
        <KV label="Year High/Low" value={q ? `${fmtPrice(q.week52High)} / ${fmtPrice(q.week52Low)}` : '—'} />
      </Card>

      <Card title="VALUATION">
        <KV label="PE" value={fmtPrice(f?.pe)} />
        <KV label="PB" value={fmtPrice(f?.pb)} />
        <KV label="Turnover" value={f?.turnoverRate != null ? `${f.turnoverRate.toFixed(2)}%` : '—'} />
        <KV label="Market Cap" value={fmtCapCn(f?.marketCap ?? q?.marketCap)} />
      </Card>

      <Card title="BASIC FUNDAMENTALS">
        <KV label="EPS(TTM)" value={fmtPrice(f?.eps)} />
        <KV label="Dividend" value={f?.dividendYield != null ? `${f.dividendYield.toFixed(2)}%` : '—'} />
        <KV label="Shares" value={fmtShares(f?.sharesOutstanding ?? q?.sharesOutstanding)} />
      </Card>
    </div>
  );
}
