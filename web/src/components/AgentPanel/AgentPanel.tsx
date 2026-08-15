import { ModelConfigBar } from './ModelConfigBar';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

export function AgentPanel() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Agent</h2>
      </div>
      <ModelConfigBar />
      <ChatMessages />
      <ChatInput />
    </div>
  );
}
