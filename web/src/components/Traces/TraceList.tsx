import { useTracesStore } from '../../state/useTracesStore';
import { fmtTs } from '../../lib/format';

export function TraceList() {
  const traces = useTracesStore((s) => s.traces);
  const selectedId = useTracesStore((s) => s.selected?.id ?? null);
  const select = useTracesStore((s) => s.select);
  const loading = useTracesStore((s) => s.loading);
  const error = useTracesStore((s) => s.error);

  if (loading && !traces.length) {
    return <div className="w-72 shrink-0 border-r border-line p-3 text-xs text-ink-faint">加载中…</div>;
  }
  if (error && !traces.length) {
    return <div className="w-72 shrink-0 border-r border-line p-3 text-xs text-up">{error}</div>;
  }

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-line">
      {!traces.length && (
        <p className="p-3 text-xs text-ink-faint">暂无对话记录。发一条消息后会自动记录到这里。</p>
      )}
      <ul>
        {traces.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => void select(t.id)}
              className={`w-full border-b border-line/60 px-3 py-2 text-left transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-surface-soft ${
                t.id === selectedId ? 'bg-accent-soft' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-ink">{t.userMessage}</span>
                <span className={t.outcome === 'ok' ? 'text-down' : 'text-up'}>
                  {t.outcome === 'ok' ? '✓' : '✗'}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-faint">
                <span>{fmtTs(t.startedAt)}</span>
                <span>{(t.totalMs / 1000).toFixed(1)}s</span>
                <span>{t.turns.length}轮</span>
                {t.feedback && <span className="text-pre">{t.feedback.rating}★</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
