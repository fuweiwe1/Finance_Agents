import { describe, it, expect } from 'vitest';
import type { AgentEvent } from '@earendil-works/pi-agent-core';
import { TraceCollector } from '../collector.js';

const turnStart = (): AgentEvent => ({ type: 'turn_start' }) as AgentEvent;
const textDelta = (delta: string): AgentEvent =>
  ({ type: 'message_update', message: {}, assistantMessageEvent: { type: 'text_delta', delta } }) as AgentEvent;
const toolStart = (id: string, name: string, args: unknown): AgentEvent =>
  ({ type: 'tool_execution_start', toolCallId: id, toolName: name, args }) as AgentEvent;
const toolEnd = (id: string, name: string, result: unknown, isError: boolean): AgentEvent =>
  ({ type: 'tool_execution_end', toolCallId: id, toolName: name, result, isError }) as AgentEvent;
const turnEnd = (usage?: { input?: number; output?: number }, stopReason?: string): AgentEvent =>
  ({ type: 'turn_end', message: { usage, stopReason }, toolResults: [] }) as unknown as AgentEvent;

describe('TraceCollector（事件流 → 结构化 trace）', () => {
  it('完整一轮：turn + 工具 + 回答 + tokens', () => {
    const c = new TraceCollector({ sessionId: 's1', userMessage: '茅台PE', modelId: 'deepseek-v4-flash' });
    c.onEvent(turnStart());
    c.onEvent(toolStart('1', 'get_financials', { symbol: '600519' }));
    c.onEvent(toolEnd('1', 'get_financials', { ok: true, pe: 20.6 }, false));
    c.onEvent(textDelta('贵州茅台 PE 为 20.6'));
    c.onEvent(turnEnd({ input: 100, output: 50 }, 'end_turn'));
    c.finish();

    const t = c.trace;
    expect(t.sessionId).toBe('s1');
    expect(t.userMessage).toBe('茅台PE');
    expect(t.turns).toHaveLength(1);
    expect(t.turns[0]!.modelId).toBe('deepseek-v4-flash');
    expect(t.turns[0]!.toolCalls).toHaveLength(1);
    expect(t.turns[0]!.toolCalls[0]!.toolName).toBe('get_financials');
    expect(t.turns[0]!.toolCalls[0]!.isError).toBe(false);
    expect(t.turns[0]!.responseText).toContain('PE 为 20.6');
    expect(t.turns[0]!.inputTokens).toBe(100);
    expect(t.turns[0]!.outputTokens).toBe(50);
    expect(t.turns[0]!.stopReason).toBe('end_turn');
    expect(t.outcome).toBe('ok');
  });

  it('工具报错被标记 isError', () => {
    const c = new TraceCollector({ sessionId: 's', userMessage: 'x' });
    c.onEvent(turnStart());
    c.onEvent(toolStart('1', 'get_quote', { symbol: '600519' }));
    c.onEvent(toolEnd('1', 'get_quote', { error: 'not found' }, true));
    c.onEvent(turnEnd());
    c.finish();
    expect(c.trace.turns[0]!.toolCalls[0]!.isError).toBe(true);
  });

  it('并行工具调用按 toolCallId 区分，不串台不丢失', () => {
    const c = new TraceCollector({ sessionId: 's', userMessage: '茅台' });
    c.onEvent(turnStart());
    c.onEvent(toolStart('a', 'get_quote', { symbol: '600519' }));
    c.onEvent(toolStart('b', 'get_financials', { symbol: '600519' }));
    // 完成顺序与开始顺序相反（并行）
    c.onEvent(toolEnd('b', 'get_financials', { ok: true, pe: 20.6 }, false));
    c.onEvent(toolEnd('a', 'get_quote', { ok: true, price: 1341.99 }, false));
    c.onEvent(turnEnd());
    c.finish();
    const calls = c.trace.turns[0]!.toolCalls;
    expect(calls).toHaveLength(2);
    const quote = calls.find((tc) => tc.toolName === 'get_quote')!;
    const fin = calls.find((tc) => tc.toolName === 'get_financials')!;
    expect((quote.result as { price: number }).price).toBe(1341.99);
    expect((fin.result as { pe: number }).pe).toBe(20.6);
  });

  it('finish(error) 标记 outcome=error', () => {
    const c = new TraceCollector({ sessionId: 's', userMessage: 'x' });
    c.finish(new Error('boom'));
    expect(c.trace.outcome).toBe('error');
    expect(c.trace.errorMessage).toBe('boom');
  });

  it('异常中断残留的 turn 也会被保留', () => {
    const c = new TraceCollector({ sessionId: 's', userMessage: 'x' });
    c.onEvent(turnStart());
    c.onEvent(textDelta('回答到一半'));
    c.finish(); // 没有 turn_end
    expect(c.trace.turns).toHaveLength(1);
    expect(c.trace.turns[0]!.responseText).toContain('回答到一半');
  });
});
