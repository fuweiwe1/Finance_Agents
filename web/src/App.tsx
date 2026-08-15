import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { StockDetailPanel } from './components/StockDetail/StockDetailPanel';
import { AgentPanel } from './components/AgentPanel/AgentPanel';
import { useAppStore } from './state/useAppStore';

export default function App() {
  const init = useAppStore((s) => s.init);
  const [agentPanelOpen, setAgentPanelOpen] = useState(true);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <Sidebar agentPanelOpen={agentPanelOpen} onToggleAgent={() => setAgentPanelOpen((v) => !v)} />
      </aside>

      <main className="h-full flex-1 overflow-y-auto">
        <StockDetailPanel />
      </main>

      {agentPanelOpen && (
        <section className="h-full w-[380px] shrink-0 border-l border-slate-200">
          <AgentPanel />
        </section>
      )}
    </div>
  );
}
