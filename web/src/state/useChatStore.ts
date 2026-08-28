import { create } from 'zustand';
import { api } from '../lib/api';
import { electronApi, isElectron } from '../lib/bridge';

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

export interface UsageInfo {
  input?: number;
  output?: number;
  cost?: number;
}

/** 传输无关的聊天事件包：浏览器 SSE 与 Electron IPC 都以 { type, data } 呈现 */
export interface ChatPacket {
  type: string; // chat_start | chat_end | error | agent_event
  data: unknown;
}

export interface ChatPacketSink {
  appendDelta: (delta: string) => void;
  finalize: () => void;
  patchTools: (fn: (t: ToolEvent[]) => ToolEvent[]) => void;
  setUsage: (u: UsageInfo) => void;
}

/** 共享事件处理（对 SSE 与 IPC 一视同仁），可单测（IPC 序列化协议验证） */
export function applyChatPacket(packet: ChatPacket, sink: ChatPacketSink): void {
  const { type, data } = packet;
  if (type === 'chat_end') {
    const u = (data as { usage?: UsageInfo }).usage;
    if (u) sink.setUsage(u);
    return;
  }
  if (type === 'error') {
    const msg = String((data as { message?: unknown }).message ?? '发生错误');
    sink.appendDelta(`⚠️ ${msg}`);
    return;
  }
  if (type !== 'agent_event') return;
  const d = data as Record<string, unknown>;
  if (d.type === 'message_update') {
    const sub = (d as { assistantMessageEvent?: { type?: string; delta?: string } }).assistantMessageEvent;
    if (sub?.type === 'text_delta' && typeof sub.delta === 'string') sink.appendDelta(sub.delta);
  } else if (d.type === 'tool_execution_start') {
    const event = d as { toolName?: string; args?: unknown };
    sink.patchTools((t) => [...t, { toolName: event.toolName ?? 'tool', status: 'running', args: event.args }]);
  } else if (d.type === 'tool_execution_end') {
    const event = d as { toolName?: string; result?: unknown; isError?: boolean };
    sink.patchTools((t) => {
      const copy = [...t];
      const idx = [...copy].reverse().findIndex((x) => x.toolName === event.toolName && x.status === 'running');
      if (idx >= 0) {
        copy[copy.length - 1 - idx] = {
          ...copy[copy.length - 1 - idx]!,
          status: event.isError ? 'error' : 'done',
          result: event.result,
        };
      }
      return copy;
    });
  }
}

interface ChatState {
  messagesBySession: Record<string, ChatMessage[]>;
  toolsBySession: Record<string, ToolEvent[]>;
  usageBySession: Record<string, UsageInfo>;
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
  usageBySession: {},
  streaming: false,
  error: null,

  resetSession: (sessionId) => {
    set((s) => {
      const messagesBySession = { ...s.messagesBySession };
      const toolsBySession = { ...s.toolsBySession };
      const usageBySession = { ...s.usageBySession };
      delete messagesBySession[sessionId];
      delete toolsBySession[sessionId];
      delete usageBySession[sessionId];
      return { messagesBySession, toolsBySession, usageBySession };
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

    /** 追加文本到当前流式助手气泡 */
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

    const setUsage = (u: UsageInfo) => set((s) => ({ usageBySession: { ...s.usageBySession, [sessionId]: u } }));

    const sink: ChatPacketSink = { appendDelta, finalize, patchTools, setUsage };

    if (isElectron()) {
      await electronChat(sessionId, text, context, sink, set);
    } else {
      await httpChat(sessionId, text, context, sink, set);
    }
  },
}));

/** Electron 传输：invoke 启动 + onEvent 订阅流式事件 */
async function electronChat(
  sessionId: string,
  text: string,
  context: { symbol?: string; name?: string; price?: number } | undefined,
  sink: ChatPacketSink,
  set: (partial: Partial<ChatState>) => void,
): Promise<void> {
  const win = electronApi();
  const off = win.agent.onEvent((packet) => applyChatPacket(packet, sink));
  try {
    await win.agent.chat({ sessionId, message: text, context });
    sink.finalize();
  } catch (err) {
    set({ streaming: false, error: err instanceof Error ? err.message : '未知错误' });
  } finally {
    off();
    set({ streaming: false });
  }
}

/** 浏览器传输：fetch + SSE 解析（dev 通道） */
async function httpChat(
  sessionId: string,
  text: string,
  context: { symbol?: string; name?: string; price?: number } | undefined,
  sink: ChatPacketSink,
  set: (partial: Partial<ChatState>) => void,
): Promise<void> {
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
        let data: unknown = {};
        try {
          data = JSON.parse(dataLine);
        } catch {
          continue;
        }
        applyChatPacket({ type: event, data }, sink);
      }
    }
    sink.finalize();
  } catch (err) {
    set({ streaming: false, error: err instanceof Error ? err.message : '未知错误' });
  } finally {
    set({ streaming: false });
  }
}