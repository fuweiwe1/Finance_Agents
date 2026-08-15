import { useAppStore } from '../../state/useAppStore';

export function SessionsSection() {
  const sessions = useAppStore((s) => s.sessions);
  const activeId = useAppStore((s) => s.activeSessionId);
  const createSession = useAppStore((s) => s.createSession);
  const selectSession = useAppStore((s) => s.selectSession);
  const deleteSession = useAppStore((s) => s.deleteSession);

  return (
    <section className="border-b border-slate-200 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">SESSIONS</h2>
      <button
        onClick={() => void createSession()}
        className="mb-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        + New Session
      </button>
      <ul className="space-y-0.5">
        {sessions.map((s) => (
          <li
            key={s.id}
            onClick={() => selectSession(s.id)}
            className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm ${
              s.id === activeId ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="truncate">{s.title}</span>
            <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-slate-400">
              {s.msgCount} msgs
              <button
                title="删除会话"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteSession(s.id);
                }}
                className="hidden text-slate-400 hover:text-red-500 group-hover:inline"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
        {!sessions.length && <li className="py-1 text-xs text-slate-400">暂无会话</li>}
      </ul>
    </section>
  );
}
