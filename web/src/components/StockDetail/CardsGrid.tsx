import type { ReactNode } from 'react';
import { useFinancials, useQuote } from '../../hooks/usePolling';
import { fmtCap, fmtPct, fmtPrice, fmtShares, fmtVolume, trendColor } from '../../lib/format';

function KV({ label, value, className = '' }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-sm font-medium tabular-nums text-slate-800 ${className}`}>{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <p className="mt-1 border-t border-dashed border-slate-200 pt-1 text-[11px] text-slate-400">{text}</p>;
}

/** 2×2 指标卡网格：QUOTE / PERFORMANCE / VALUATION / BASIC FUNDAMENTALS */
export function CardsGrid({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);
  const f = useFinancials(symbol);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card title="QUOTE">
        <KV label="Price" value={fmtPrice(q?.price)} className={trendColor(q?.changePct)} />
        <KV label="Change" value={fmtPct(q?.changePct)} className={trendColor(q?.changePct)} />
        <KV label="Volume" value={fmtVolume(q?.volume)} />
      </Card>

      <Card title="PERFORMANCE">
        <KV label="Day Range" value={q ? `${fmtPrice(q.low)} – ${fmtPrice(q.high)}` : '—'} />
        <KV label="Open" value={fmtPrice(q?.open)} />
        <KV label="Prev Close" value={fmtPrice(q?.prevClose)} />
        <KV label="52W High/Low" value={q ? `${fmtPrice(q.week52High)} / ${fmtPrice(q.week52Low)}` : '—'} />
      </Card>

      <Card title="VALUATION">
        <KV label="PE" value={fmtPrice(f?.pe)} />
        <KV label="PB" value={fmtPrice(f?.pb)} />
        <KV label="Turnover" value={f?.turnoverRate != null ? `${f.turnoverRate.toFixed(2)}%` : '—'} />
        <KV label="Market Cap" value={fmtCap(f?.marketCap ?? q?.marketCap)} />
        {f?.source !== 'finnhub' && <Hint text="PE / PB 需配置 Finnhub key" />}
      </Card>

      <Card title="BASIC FUNDAMENTALS">
        <KV label="EPS" value={fmtPrice(f?.eps)} />
        <KV label="Dividend" value={f?.dividendYield != null ? `${f.dividendYield.toFixed(2)}%` : '—'} />
        <KV label="Shares" value={fmtShares(f?.sharesOutstanding ?? q?.sharesOutstanding)} />
        {f?.source !== 'finnhub' && <Hint text="EPS / 股息 需配置 Finnhub key" />}
      </Card>
    </div>
  );
}
