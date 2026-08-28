import { ModelConfigBar } from './ModelConfigBar';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

export function AgentPanel() {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="shrink-0 border-b border-line px-3 py-2">
        <h2 className="eyebrow">Agent</h2>
      </div>
      <ModelConfigBar />
      <ChatMessages />
      <ChatInput />
    </div>
  );
}
