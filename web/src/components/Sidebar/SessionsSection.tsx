import { useAppStore } from '../../state/useAppStore';

export function SessionsSection() {
  const sessions = useAppStore((s) => s.sessions);
  const activeId = useAppStore((s) => s.activeSessionId);
  const createSession = useAppStore((s) => s.createSession);
  const selectSession = useAppStore((s) => s.selectSession);
  const deleteSession = useAppStore((s) => s.deleteSession);

  return (
    <section className="border-b border-line p-3">
      <h2 className="eyebrow mb-2">SESSIONS</h2>
      <button
        onClick={() => void createSession()}
        className="btn-primary mb-2 w-full"
      >
        + New Session
      </button>
      <ul className="space-y-0.5">
        {sessions.map((s) => (
          <li
            key={s.id}
            onClick={() => selectSession(s.id)}
            className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              s.id === activeId ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-surface-soft'
            }`}
          >
            <span className="truncate">{s.title}</span>
            <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-ink-faint">
              {s.msgCount} msgs
              <button
                title="删除会话"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteSession(s.id);
                }}
                className="hidden text-ink-faint transition-colors hover:text-up group-hover:inline"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
        {!sessions.length && <li className="py-1 text-xs text-ink-faint">暂无会话</li>}
      </ul>
    </section>
  );
}
