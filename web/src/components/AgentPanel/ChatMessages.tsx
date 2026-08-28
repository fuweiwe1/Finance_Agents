import { useAppStore } from '../../state/useAppStore';
import { useChatStore, type ChatMessage, type ToolEvent } from '../../state/useChatStore';

const NO_MESSAGES: ChatMessage[] = [];
const NO_TOOLS: ToolEvent[] = [];

export function ChatMessages() {
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  // 直接选原始引用，避免 `?? []` 每次返回新数组触发无限重渲染
  const rawMessages = useChatStore((s) => (activeSessionId ? s.messagesBySession[activeSessionId] : undefined));
  const rawTools = useChatStore((s) => (activeSessionId ? s.toolsBySession[activeSessionId] : undefined));
  const error = useChatStore((s) => s.error);
  const usage = useChatStore((s) => (activeSessionId ? s.usageBySession[activeSessionId] : undefined));
  const messages = rawMessages ?? NO_MESSAGES;
  const tools = rawTools ?? NO_TOOLS;

  if (!messages.length && !tools.length) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="mt-10 text-center text-sm text-ink-faint">
          向股票 Agent 提问，如 “TSLA 现在多少钱？” “它的 PE 是多少？”
        </div>
        {error && (
          <div className="mx-auto mt-4 max-w-sm rounded-md bg-up-soft px-3 py-2 text-center text-xs text-up">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {tools.map((t, i) => (
        <div key={i} className="my-1 flex flex-wrap items-center gap-1.5 rounded-md bg-surface-soft px-2 py-1 text-xs text-ink-soft">
          <span className={t.status === 'running' ? 'animate-pulse' : ''}>🔧</span>
          <span className="font-mono font-medium text-ink">{t.toolName}</span>
          {t.args ? <span className="font-mono text-ink-faint">{JSON.stringify(t.args)}</span> : null}
          <span
            className={
              t.status === 'error' ? 'text-up' : t.status === 'done' ? 'text-down' : 'text-pre'
            }
          >
            {t.status === 'running' ? '执行中…' : t.status === 'done' ? '完成' : '失败'}
          </span>
        </div>
      ))}

      {messages.map((m, i) => (
        <div key={i} className={`mb-2 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
              m.role === 'user' ? 'bg-accent text-white' : 'bg-surface-soft text-ink'
            }`}
          >
            {m.content}
            {m.role === 'assistant' && m.pending && (
              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-ink-faint align-middle" />
            )}
          </div>
        </div>
      ))}

      {usage && (usage.input != null || usage.output != null) && (
        <div className="mb-2 text-right text-[10px] text-ink-faint/70">
          本轮 {usage.input ?? '?'} in / {usage.output ?? '?'} out
          {usage.cost != null ? ` · $${usage.cost.toFixed(4)}` : ''}
        </div>
      )}

      {error && <div className="my-2 rounded-md bg-up-soft px-3 py-2 text-xs text-up">{error}</div>}
    </div>
  );
}
