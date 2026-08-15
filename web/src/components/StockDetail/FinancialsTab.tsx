import { useFinancials } from '../../hooks/usePolling';
import { fmtCapCn, fmtPrice, fmtShares } from '../../lib/format';

export function FinancialsTab({ symbol }: { symbol: string }) {
  const f = useFinancials(symbol);

  if (!f) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="py-6 text-center text-sm text-slate-400">加载中…</p>
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
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Financials</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-slate-50 last:border-0">
              <td className="py-1.5 text-xs uppercase tracking-wide text-slate-400">{k}</td>
              <td className="py-1.5 text-right font-medium tabular-nums text-slate-800">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {f.source !== 'tencent' && (
        <p className="mt-2 border-t border-dashed border-slate-200 pt-2 text-[11px] text-slate-400">暂无数据</p>
      )}
    </div>
  );
}
