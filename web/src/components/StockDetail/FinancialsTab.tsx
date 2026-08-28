import { useFinancials } from '../../hooks/usePolling';
import { fmtCapCn, fmtPrice, fmtShares } from '../../lib/format';

export function FinancialsTab({ symbol }: { symbol: string }) {
  const f = useFinancials(symbol);

  if (!f) {
    return (
      <div className="card p-4">
        <p className="py-6 text-center text-sm text-ink-faint">加载中…</p>
      </div>
    );
  }

  const rows: [string, string][] = [
    ['PE (TTM)', fmtPrice(f.pe)],
    ['PB', fmtPrice(f.pb)],
    ['Turnover', f.turnoverRate != null ? `${f.turnoverRate.toFixed(2)}%` : '—'],
    ['EPS (TTM)', fmtPrice(f.eps)],
    ['Dividend Yield', f.dividendYield != null ? `${f.dividendYield.toFixed(2)}%` : '—'],
    ['Market Cap', fmtCapCn(f.marketCap)],
    ['Shares Outstanding', fmtShares(f.sharesOutstanding)],
  ];

  return (
    <div className="card p-4">
      <h3 className="eyebrow mb-2">Financials</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-line/60 last:border-0">
              <td className="py-1.5 text-[11px] uppercase tracking-wide text-ink-faint">{k}</td>
              <td className="py-1.5 text-right font-medium tabular-nums text-ink">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {f.source !== 'tencent' && (
        <p className="mt-2 border-t border-dashed border-line-strong pt-2 text-[11px] text-ink-faint">暂无数据</p>
      )}
    </div>
  );
}
