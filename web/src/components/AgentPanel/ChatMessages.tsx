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
  const messages = rawMessages ?? NO_MESSAGES;
  const tools = rawTools ?? NO_TOOLS;

  if (!messages.length && !tools.length) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="mt-10 text-center text-sm text-slate-400">
          向股票 Agent 提问，如 “TSLA 现在多少钱？” “它的 PE 是多少？”
        </div>
        {error && (
          <div className="mx-auto mt-4 max-w-sm rounded-md bg-red-50 px-3 py-2 text-center text-xs text-red-600">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {tools.map((t, i) => (
        <div key={i} className="my-1 flex flex-wrap items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500">
          <span className={t.status === 'running' ? 'animate-pulse' : ''}>🔧</span>
          <span className="font-mono font-medium text-slate-700">{t.toolName}</span>
          {t.args ? <span className="font-mono text-slate-400">{JSON.stringify(t.args)}</span> : null}
          <span
            className={
              t.status === 'error' ? 'text-red-500' : t.status === 'done' ? 'text-emerald-600' : 'text-amber-600'
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
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
            }`}
          >
            {m.content}
            {m.role === 'assistant' && m.pending && (
              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-slate-400 align-middle" />
            )}
          </div>
        </div>
      ))}

      {error && (
        <div className="my-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}
