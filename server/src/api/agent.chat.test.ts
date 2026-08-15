import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createModels, fauxProvider, fauxToolCall, fauxAssistantMessage } from '@earendil-works/pi-ai';
import { createApp } from '../app.js';
import { ModelManager, type ModelProvider } from '../agent/models.js';
import { SessionStore } from '../agent/sessions.js';
import { CompositeProvider } from '../market/composite.js';
import { parseTencentQuote } from '../market/tencent.js';
import type { TencentProvider } from '../market/tencent.js';
import type { SinaProvider } from '../market/sina.js';

const fixture = (name: string) => readFileSync(new URL(`../market/__tests__/fixtures/${name}`, import.meta.url), 'utf8');

function stubMarket(): CompositeProvider {
  const tencent = {
    name: 'tencent',
    getQuote: async () => parseTencentQuote(fixture('tencent.tsla.txt'), 'TSLA')!,
    getKline: async () => [],
  } as unknown as TencentProvider;
  const sina = { name: 'sina', getQuote: async () => null } as unknown as SinaProvider;
  return new CompositeProvider({}, { tencent, sina });
}

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

function parseSse(text: string): SseEvent[] {
  return text
    .split('\n\n')
    .filter((c) => c.trim().length > 0)
    .map((chunk) => {
      const event = chunk.match(/^event: (.+)$/m)?.[1] ?? '';
      const data = chunk.match(/^data: (.+)$/m)?.[1] ?? '{}';
      return { event, data: JSON.parse(data) as Record<string, unknown> };
    });
}

describe('Agent 对话 SSE（fauxProvider 脚本化模型，无 key 可测）', () => {
  it('流式事件：工具调用 get_quote → 最终回答 → chat_end', async () => {
    const faux = fauxProvider();
    const models = createModels();
    models.setProvider(faux.provider);
    // 脚本化：第 1 次模型调用返回工具调用，第 2 次返回最终回答
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall('get_quote', { symbol: 'TSLA' })]),
      fauxAssistantMessage('TSLA 最新价为 342.27 美元，上涨 0.68%。'),
    ]);

    const modelManager = new ModelManager({
      models,
      config: {
        provider: faux.provider.id as ModelProvider,
        model: faux.getModel()!.id,
        baseUrl: 'faux',
        apiKey: 'test',
      },
    });
    const sessions = new SessionStore();
    const app = createApp({ models: modelManager, market: stubMarket(), sessions });

    const created = await request(app).post('/api/agent/sessions');
    const id = created.body.id as string;

    const res = await request(app)
      .post(`/api/agent/sessions/${id}/chat`)
      .send({ message: 'TSLA 现在多少钱？', context: { symbol: 'TSLA', name: '特斯拉' } });

    expect(res.status).toBe(200);
    const events = parseSse(res.text);

    // 事件顺序起点
    expect(events[0]!.event).toBe('chat_start');

    // 工具调用执行
    const toolEnds = events.filter(
      (e) => e.event === 'agent_event' && (e.data as { type?: string }).type === 'tool_execution_end',
    );
    expect(toolEnds.length).toBe(1);
    expect((toolEnds[0]!.data as { toolName?: string }).toolName).toBe('get_quote');
    expect((toolEnds[0]!.data as { isError?: boolean }).isError).toBe(false);

    // 最终回答 + 会话结束
    expect(events.some((e) => e.event === 'chat_end' && e.data.ok === true)).toBe(true);
    expect(events.at(-1)!.event).toBe('chat_end');

    // 消息计数 +1
    const list = await request(app).get('/api/agent/sessions');
    expect(list.body.find((s: { id: string }) => s.id === id)?.msgCount).toBe(1);
  });

  it('无上下文也能对话', async () => {
    const faux = fauxProvider();
    const models = createModels();
    models.setProvider(faux.provider);
    faux.setResponses([fauxAssistantMessage('你好！有什么可以帮你？')]);

    const modelManager = new ModelManager({
      models,
      config: {
        provider: faux.provider.id as ModelProvider,
        model: faux.getModel()!.id,
        baseUrl: 'faux',
        apiKey: 'test',
      },
    });
    const app = createApp({ models: modelManager, market: stubMarket(), sessions: new SessionStore() });
    const created = await request(app).post('/api/agent/sessions');
    const id = created.body.id as string;

    const res = await request(app).post(`/api/agent/sessions/${id}/chat`).send({ message: 'hi' });
    expect(res.status).toBe(200);
    const events = parseSse(res.text);
    expect(events.at(-1)!.event).toBe('chat_end');
    expect(events.at(-1)!.data.ok).toBe(true);
  });
});
