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
  onOpenSettings,
}: {
  agentPanelVisible: boolean;
  onToggleAgent: () => void;
  onOpenTraces: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <nav className="shrink-0 space-y-0.5 border-t border-line p-2">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          onClick={item.key === 'settings' ? onOpenSettings : undefined}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-ink-soft transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-surface-soft"
        >
          <span className="text-base leading-none">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
      <button
        onClick={onOpenTraces}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-ink-soft transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-surface-soft"
      >
        <span className="text-base leading-none">🕵️</span>
        <span>Traces</span>
      </button>
      <button
        onClick={onToggleAgent}
        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          agentPanelVisible ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-surface-soft'
        }`}
      >
        <span className="text-base leading-none">🤖</span>
        <span className="flex-1 text-left">Agent Panel</span>
        <span className="h-2 w-2 rounded-full bg-status" title="在线" />
      </button>
    </nav>
  );
}
