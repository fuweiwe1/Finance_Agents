import { describe, it, expect } from 'vitest';
import { applyChatPacket, type ChatPacketSink, type ToolEvent, type UsageInfo } from './useChatStore';

function makeSink() {
  const deltas: string[] = [];
  let finalized = false;
  let tools: ToolEvent[] = [];
  let usage: UsageInfo | null = null;
  const sink: ChatPacketSink = {
    appendDelta: (d) => deltas.push(d),
    finalize: () => {
      finalized = true;
    },
    patchTools: (fn) => {
      tools = fn(tools);
    },
    setUsage: (u) => {
      usage = u;
    },
  };
  return { sink, deltas, get tools() { return tools }, get finalized() { return finalized }, get usage() { return usage } };
}

describe('applyChatPacket（IPC 聊天流事件协议）', () => {
  it('text_delta 累积为助手文本', () => {
    const h = makeSink();
    applyChatPacket(
      { type: 'agent_event', data: { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: '贵州' } } },
      h.sink,
    );
    applyChatPacket(
      { type: 'agent_event', data: { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: '茅台' } } },
      h.sink,
    );
    expect(h.deltas.join('')).toBe('贵州茅台');
  });

  it('工具调用 running → done（带结果）', () => {
    const h = makeSink();
    applyChatPacket({ type: 'agent_event', data: { type: 'tool_execution_start', toolName: 'get_quote', args: { symbol: '600519' } } }, h.sink);
    expect(h.tools[0]).toMatchObject({ toolName: 'get_quote', status: 'running' });
    applyChatPacket({ type: 'agent_event', data: { type: 'tool_execution_end', toolName: 'get_quote', result: { price: 1341.99 }, isError: false } }, h.sink);
    expect(h.tools[0]).toMatchObject({ status: 'done', result: { price: 1341.99 } });
  });

  it('chat_end 写入 usage', () => {
    const h = makeSink();
    applyChatPacket({ type: 'chat_end', data: { ok: true, usage: { input: 197, output: 265, cost: 0 } } }, h.sink);
    expect(h.usage).toEqual({ input: 197, output: 265, cost: 0 });
  });

  it('error 包追加 ⚠️ 提示', () => {
    const h = makeSink();
    applyChatPacket({ type: 'error', data: { message: '模型未配置' } }, h.sink);
    expect(h.deltas[0]).toContain('模型未配置');
  });
});