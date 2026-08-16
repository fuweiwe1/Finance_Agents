import type { AgentEvent } from '@earendil-works/pi-agent-core';
import type { AgentTrace, TraceToolCall, TraceTurn } from './types.js';

export interface TraceInput {
  sessionId: string;
  userMessage: string;
  modelId?: string;
  context?: { symbol?: string; name?: string };
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * 把 agent 事件流（pi-agent-core）沉淀为结构化 Trace：
 * turn_start → 开一轮；text_delta → 累积回答；tool_execution_start/end → 记录工具调用；
 * turn_end → 收尾本轮（含 usage/tokens）；finish() → 汇总总耗时/outcome。
 */
export class TraceCollector {
  private turn: TraceTurn | null = null;
  // 并行工具用 toolCallId 区分，避免单槽覆盖导致结果串台/丢失
  private tools = new Map<string, TraceToolCall>();
  readonly trace: AgentTrace;

  constructor(input: TraceInput) {
    this.trace = {
      id: genId(),
      sessionId: input.sessionId,
      userMessage: input.userMessage,
      context: input.context,
      startedAt: Date.now(),
      endedAt: 0,
      totalMs: 0,
      turns: [],
      outcome: 'ok',
    };
    this.modelId = input.modelId ?? '';
  }

  private readonly modelId: string;

  onEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'turn_start':
        this.turn = {
          modelId: this.modelId,
          startedAt: Date.now(),
          endedAt: 0,
          latencyMs: 0,
          toolCalls: [],
          responseText: '',
        };
        break;

      case 'message_update': {
        const sub = (event as { assistantMessageEvent?: { type?: string; delta?: string } }).assistantMessageEvent;
        if (sub?.type === 'text_delta' && typeof sub.delta === 'string' && this.turn) {
          this.turn.responseText = (this.turn.responseText ?? '') + sub.delta;
        }
        break;
      }

      case 'tool_execution_start': {
        const e = event as { toolCallId: string; toolName: string; args: unknown };
        this.tools.set(e.toolCallId, {
          toolName: e.toolName,
          args: e.args,
          isError: false,
          latencyMs: 0,
          startedAt: Date.now(),
        });
        break;
      }

      case 'tool_execution_end': {
        const e = event as { toolCallId: string; toolName: string; result: unknown; isError: boolean };
        const t = this.tools.get(e.toolCallId);
        if (t) {
          t.result = e.result;
          t.isError = e.isError;
          t.latencyMs = Date.now() - t.startedAt;
          this.turn?.toolCalls.push(t);
          this.tools.delete(e.toolCallId);
        }
        break;
      }

      case 'turn_end': {
        const e = event as {
          message?: { usage?: { input?: number; output?: number; cost?: { total?: number } }; stopReason?: string };
        };
        if (this.turn) {
          this.turn.endedAt = Date.now();
          this.turn.latencyMs = this.turn.endedAt - this.turn.startedAt;
          this.turn.inputTokens = e.message?.usage?.input;
          this.turn.outputTokens = e.message?.usage?.output;
          this.turn.cost = e.message?.usage?.cost?.total;
          this.turn.stopReason = e.message?.stopReason;
          this.trace.turns.push(this.turn);
          this.turn = null;
        }
        break;
      }

      default:
        break;
    }
  }

  /** 结束采集：处理异常中断残留的工具/turn，汇总 outcome/耗时 */
  finish(error?: unknown): AgentTrace {
    // 先落残留工具（并行执行中被中断、未收到 tool_execution_end）
    const now = Date.now();
    for (const t of this.tools.values()) {
      t.latencyMs = now - t.startedAt;
      this.turn?.toolCalls.push(t);
    }
    this.tools.clear();
    // 再收尾未 turn_end 的残留 turn（异常中断）
    if (this.turn) {
      this.turn.endedAt = now;
      this.turn.latencyMs = this.turn.endedAt - this.turn.startedAt;
      this.trace.turns.push(this.turn);
      this.turn = null;
    }
    if (error) {
      this.trace.outcome = 'error';
      this.trace.errorMessage = error instanceof Error ? error.message : String(error);
    }
    this.trace.endedAt = Date.now();
    this.trace.totalMs = this.trace.endedAt - this.trace.startedAt;
    return this.trace;
  }
}
