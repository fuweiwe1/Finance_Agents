import { create } from 'zustand';
import { api } from '../lib/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

export interface ToolEvent {
  toolName: string;
  status: 'running' | 'done' | 'error';
  args?: unknown;
  result?: unknown;
}

interface ChatState {
  messagesBySession: Record<string, ChatMessage[]>;
  toolsBySession: Record<string, ToolEvent[]>;
  streaming: boolean;
  error: string | null;
  send: (
    sessionId: string,
    text: string,
    context?: { symbol?: string; name?: string; price?: number },
  ) => Promise<void>;
  resetSession: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messagesBySession: {},
  toolsBySession: {},
  streaming: false,
  error: null,

  resetSession: (sessionId) => {
    set((s) => {
      const messagesBySession = { ...s.messagesBySession };
      const toolsBySession = { ...s.toolsBySession };
      delete messagesBySession[sessionId];
      delete toolsBySession[sessionId];
      return { messagesBySession, toolsBySession };
    });
  },

  send: async (sessionId, text, context) => {
    const userMsg: ChatMessage = { role: 'user', content: text };
    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [...(s.messagesBySession[sessionId] ?? []), userMsg],
      },
      streaming: true,
      error: null,
    }));

    /** 追加一段文本到当前流式助手气泡 */
    const appendDelta = (delta: string) => {
      if (!delta) return;
      set((s) => {
        const list = [...(s.messagesBySession[sessionId] ?? [])];
        const last = list[list.length - 1];
        if (last && last.role === 'assistant' && last.pending) {
          list[list.length - 1] = { role: 'assistant', content: last.content + delta, pending: true };
        } else {
          list.push({ role: 'assistant', content: delta, pending: true });
        }
        return { messagesBySession: { ...s.messagesBySession, [sessionId]: list } };
      });
    };

    /** 标记流式气泡完成（去掉 pending 光标） */
    const finalize = () => {
      set((s) => {
        const list = [...(s.messagesBySession[sessionId] ?? [])];
        const last = list[list.length - 1];
        if (last && last.role === 'assistant' && last.pending) {
          list[list.length - 1] = { ...last, pending: false };
        }
        return { messagesBySession: { ...s.messagesBySession, [sessionId]: list } };
      });
    };

    const patchTools = (fn: (t: ToolEvent[]) => ToolEvent[]) =>
      set((s) => ({ toolsBySession: { ...s.toolsBySession, [sessionId]: fn(s.toolsBySession[sessionId] ?? []) } }));

    try {
      const res = await fetch(api.chatUrl(sessionId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
        const msg = body?.error ?? `HTTP ${res.status}`;
        set({ streaming: false, error: msg });
        if (body?.code === 'model_not_configured') return;
        throw new Error(msg);
      }
      if (!res.body) throw new Error('no response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split('\n\n');
        buf = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const event = chunk.match(/^event: (.+)$/m)?.[1] ?? '';
          const dataLine = chunk.match(/^data: (.+)$/m)?.[1] ?? '{}';
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(dataLine) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (event === 'error') {
            appendDelta(`⚠️ ${String(data.message ?? '发生错误')}`);
            continue;
          }
          if (event !== 'agent_event') continue;

          const type = data.type as string;
          if (type === 'message_update') {
            const sub = (data as { assistantMessageEvent?: { type?: string; delta?: string } }).assistantMessageEvent;
            if (sub?.type === 'text_delta' && typeof sub.delta === 'string') appendDelta(sub.delta);
          } else if (type === 'tool_execution_start') {
            const d = data as { toolName?: string; args?: unknown };
            patchTools((t) => [...t, { toolName: d.toolName ?? 'tool', status: 'running', args: d.args }]);
          } else if (type === 'tool_execution_end') {
            const d = data as { toolName?: string; result?: unknown; isError?: boolean };
            patchTools((t) => {
              const copy = [...t];
              const idx = [...copy].reverse().findIndex((x) => x.toolName === d.toolName && x.status === 'running');
              if (idx >= 0) {
                copy[copy.length - 1 - idx] = {
                  ...copy[copy.length - 1 - idx]!,
                  status: d.isError ? 'error' : 'done',
                  result: d.result,
                };
              }
              return copy;
            });
          }
        }
      }
      finalize();
    } catch (err) {
      set({ streaming: false, error: err instanceof Error ? err.message : '未知错误' });
    } finally {
      set({ streaming: false });
    }
  },
}));
