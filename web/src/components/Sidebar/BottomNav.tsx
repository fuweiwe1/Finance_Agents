const NAV_ITEMS = [
  { key: 'portfolio', label: 'Portfolio', icon: '💼' },
  { key: 'alerts', label: 'Alerts', icon: '🔔' },
  { key: 'skills', label: 'Skills', icon: '🧩' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
] as const;

export function BottomNav({
  agentPanelVisible,
  onToggleAgent,
  onOpenTraces,
}: {
  agentPanelVisible: boolean;
  onToggleAgent: () => void;
  onOpenTraces: () => void;
}) {
  return (
    <nav className="shrink-0 space-y-0.5 border-t border-slate-200 p-2">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          <span className="text-base leading-none">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
      <button
        onClick={onOpenTraces}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
      >
        <span className="text-base leading-none">🕵️</span>
        <span>Traces</span>
      </button>
      <button
        onClick={onToggleAgent}
        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${
          agentPanelVisible ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <span className="text-base leading-none">🤖</span>
        <span className="flex-1 text-left">Agent Panel</span>
        <span className="h-2 w-2 rounded-full bg-emerald-500" title="在线" />
      </button>
    </nav>
  );
}
