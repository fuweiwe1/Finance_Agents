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
      className="fixed inset-0 z-50 flex items-center justify-center bg-accent/25 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex h-[82vh] w-[92vw] max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-24px_rgba(35,32,27,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">🕵️ Traces · Agent 全链路</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              className="btn-ghost"
            >
              刷新
            </button>
            <button
              onClick={onClose}
              className="rounded px-2 py-1 text-xs text-ink-soft transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-surface-soft"
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
