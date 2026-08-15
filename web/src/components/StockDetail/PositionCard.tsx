/** POSITION 持仓卡（通栏）。本期为本地空持仓。 */
export function PositionCard() {
  return (
    <div className="mt-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">POSITION</h3>
      <p className="py-2 text-sm text-slate-400">无持仓</p>
    </div>
  );
}
