import { Agent, type AgentEvent } from '@earendil-works/pi-agent-core';
import type { ModelManager } from './models.js';
import { buildTools } from './tools.js';
import { buildSystemPrompt, type StockContext } from './prompt.js';
import type { CompositeProvider } from '../market/composite.js';

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
}
