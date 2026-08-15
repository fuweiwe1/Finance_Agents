import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { StockDetailPanel } from './components/StockDetail/StockDetailPanel';
import { AgentPanel } from './components/AgentPanel/AgentPanel';
import { useAppStore } from './state/useAppStore';

const MIN_PANEL_W = 300;
const MAX_PANEL_W = 640;
const DEFAULT_PANEL_W = 380;

function clampWidth(w: number): number {
  return Math.min(MAX_PANEL_W, Math.max(MIN_PANEL_W, w));
}

export default function App() {
  const init = useAppStore((s) => s.init);
  const [agentPanelOpen, setAgentPanelOpen] = useState(true);
  const [agentPanelWidth, setAgentPanelWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('agentPanelWidth'));
      return Number.isFinite(saved) && saved > 0 ? clampWidth(saved) : DEFAULT_PANEL_W;
    } catch {
      return DEFAULT_PANEL_W;
    }
  });
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    try {
      localStorage.setItem('agentPanelWidth', String(agentPanelWidth));
    } catch {
      /* ignore */
    }
  }, [agentPanelWidth]);

  // 拖拽手柄：左移面板变宽，右移变窄；中部 flex-1 自动伸缩
  const startResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: agentPanelWidth };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        setAgentPanelWidth(clampWidth(dragRef.current.startWidth - dx));
      };
      const onUp = () => {
        dragRef.current = null;
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      document.body.style.cursor = 'col-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [agentPanelWidth],
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <Sidebar agentPanelOpen={agentPanelOpen} onToggleAgent={() => setAgentPanelOpen((v) => !v)} />
      </aside>

      {/* 中部详情：min-w-0 防止面板变宽时溢出 */}
      <main className="h-full min-w-0 flex-1 overflow-y-auto">
        <StockDetailPanel />
      </main>

      {agentPanelOpen && (
        <>
          <div
            data-testid="panel-resize-handle"
            onMouseDown={startResize}
            title="拖拽调整宽度"
            className="w-1 shrink-0 cursor-col-resize bg-slate-200 transition-colors hover:bg-blue-400 active:bg-blue-500"
          />
          <section className="h-full shrink-0 overflow-hidden border-l border-slate-200" style={{ width: agentPanelWidth }}>
            <AgentPanel />
          </section>
        </>
      )}
    </div>
  );
}
