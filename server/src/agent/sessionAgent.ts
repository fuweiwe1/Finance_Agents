import {
  Agent,
  estimateTokens,
  type AgentEvent,
  type AgentMessage,
} from '@earendil-works/pi-agent-core';
import type { AssistantMessage, Usage } from '@earendil-works/pi-ai';
import type { ModelManager } from './models.js';
import { buildTools } from './tools.js';
import { buildSystemPrompt, type StockContext } from './prompt.js';
import type { CompositeProvider } from '../eval/market/composite.js';

/** 长会话保护：估计 token 超阈值时从旧到新剪枝（至少保留最近一条） */
const MAX_CTX_TOKENS = 30_000;

async function pruneContext(messages: AgentMessage[]): Promise<AgentMessage[]> {
  let total = 0;
  const keep: AgentMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m) continue;
    const t = estimateTokens(m);
    if (keep.length > 0 && total + t > MAX_CTX_TOKENS) break;
    total += t;
    keep.unshift(m);
  }
  return keep;
}

/**
 * 每个会话持有一个 pi-agent-core Agent，保持上下文（消息历史）。
 * 模型配置变更时调用 reset() 丢弃旧 Agent，下次请求重建。
 */
export class SessionAgent {
  private agent: Agent | null = null;

  constructor(
    private readonly models: ModelManager,
    private readonly market: CompositeProvider,
  ) {}

  reset(): void {
    this.agent = null;
  }

  private ensure(): Agent {
    if (this.agent) return this.agent;
    const model = this.models.getModel();
    if (!model) throw new Error('模型未配置：请先在右上角配置模型 API');
    this.agent = new Agent({
      initialState: {
        systemPrompt: buildSystemPrompt(),
        model,
        tools: buildTools(this.market),
      },
      streamFn: this.models.streamFn(),
      transformContext: pruneContext,
    });
    return this.agent;
  }

  setContext(ctx?: StockContext): void {
    const agent = this.ensure();
    // pi-agent-core 允许直接改 state.systemPrompt（AgentState 可变）
    agent.state.systemPrompt = buildSystemPrompt(ctx);
  }

  async prompt(message: string, onEvent: (event: AgentEvent) => void): Promise<void> {
    const agent = this.ensure();
    const unsub = agent.subscribe((event) => onEvent(event));
    try {
      await agent.prompt(message);
    } finally {
      unsub();
    }
  }

  /** 最近一条助手消息的 token/cost 用量（pi-ai usage），无则 null */
  lastUsage(): { input?: number; output?: number; cost?: number } | null {
    if (!this.agent) return null;
    const messages = this.agent.state.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && isAssistantWithUsage(m)) {
        return {
          input: m.usage.input,
          output: m.usage.output,
          cost: m.usage.cost?.total,
        };
      }
    }
    return null;
  }
}

function isAssistantWithUsage(m: AgentMessage): m is AssistantMessage & { usage: Usage } {
  return m.role === 'assistant' && 'usage' in m && m.usage !== undefined;
}
