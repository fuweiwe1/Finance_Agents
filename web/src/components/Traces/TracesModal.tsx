import { useEffect } from 'react';
import { useTracesStore } from '../../state/useTracesStore';
import { TraceList } from './TraceList';
import { TraceDetail } from './TraceDetail';

export function TracesModal({ onClose }: { onClose: () => void }) {
  const load = useTracesStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[82vh] w-[92vw] max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">🕵️ Traces · Agent 全链路</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-200"
            >
              刷新
            </button>
            <button
              onClick={onClose}
              className="rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100"
            >
              ✕ 关闭
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <TraceList />
          <TraceDetail />
        </div>
      </div>
    </div>
  );
}
