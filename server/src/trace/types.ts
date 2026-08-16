/** Agent 全链路观测数据结构 */

export interface TraceToolCall {
  toolName: string;
  args: unknown;
  result?: unknown;
  isError: boolean;
  startedAt: number;
  latencyMs: number;
}

export interface TraceTurn {
  modelId: string;
  startedAt: number;
  endedAt: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  responseText?: string;
  toolCalls: TraceToolCall[];
  stopReason?: string;
  error?: string;
}

export interface TraceFeedback {
  rating: number; // 1-5
  reason?: string;
}

export interface AgentTrace {
  id: string;
  sessionId: string;
  userMessage: string;
  context?: { symbol?: string; name?: string };
  startedAt: number;
  endedAt: number;
  totalMs: number;
  turns: TraceTurn[];
  outcome: 'ok' | 'error';
  errorMessage?: string;
  feedback?: TraceFeedback;
}
