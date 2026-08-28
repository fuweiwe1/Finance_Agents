export type TabKey = 'overview' | 'chart' | 'financials' | 'news';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'chart', label: 'Chart' },
  { key: 'financials', label: 'Financials' },
  { key: 'news', label: 'News' },
];

export function Tabs({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <div className="mb-3 flex gap-1 border-b border-line">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            active === t.key
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
