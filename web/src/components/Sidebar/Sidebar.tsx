import { SessionsSection } from './SessionsSection';
import { WatchlistSection } from './WatchlistSection';
import { BottomNav } from './BottomNav';

export function Sidebar({
  agentPanelOpen,
  onToggleAgent,
  onOpenTraces,
}: {
  agentPanelOpen: boolean;
  onToggleAgent: () => void;
  onOpenTraces: () => void;
}) {
  return (
    <>
      <SessionsSection />
      <WatchlistSection />
      <BottomNav agentPanelVisible={agentPanelOpen} onToggleAgent={onToggleAgent} onOpenTraces={onOpenTraces} />
    </>
  );
}
