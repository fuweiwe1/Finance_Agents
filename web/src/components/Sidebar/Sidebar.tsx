import { SessionsSection } from './SessionsSection';
import { WatchlistSection } from './WatchlistSection';
import { BottomNav } from './BottomNav';

export function Sidebar({
  agentPanelOpen,
  onToggleAgent,
}: {
  agentPanelOpen: boolean;
  onToggleAgent: () => void;
}) {
  return (
    <>
      <SessionsSection />
      <WatchlistSection />
      <BottomNav agentPanelVisible={agentPanelOpen} onToggleAgent={onToggleAgent} />
    </>
  );
}
