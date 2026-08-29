import { SessionsSection } from './SessionsSection';
import { WatchlistSection } from './WatchlistSection';
import { BottomNav } from './BottomNav';

export function Sidebar({
  agentPanelOpen,
  onToggleAgent,
  onOpenTraces,
  onOpenSettings,
}: {
  agentPanelOpen: boolean;
  onToggleAgent: () => void;
  onOpenTraces: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <>
      <SessionsSection />
      <WatchlistSection />
      <BottomNav
        agentPanelVisible={agentPanelOpen}
        onToggleAgent={onToggleAgent}
        onOpenTraces={onOpenTraces}
        onOpenSettings={onOpenSettings}
      />
    </>
  );
}
