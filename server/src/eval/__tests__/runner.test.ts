import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createModels, fauxProvider, fauxToolCall, fauxAssistantMessage } from '@earendil-works/pi-ai';
import { evaluateTrace, runCase } from '../runner.js';
import { ModelManager, type ModelProvider } from '../../agent/models.js';
import { CompositeProvider } from '../../market/composite.js';
import { parseTencentAshareQuote } from '../../market/tencent.js';
import type { AgentTrace, TraceToolCall } from '../../trace/types.js';
import type { TencentProvider } from '../../market/tencent.js';
import type { SinaProvider } from '../../market/sina.js';

const fixture = (name: string) => readFileSync(new URL(`../../market/__tests__/fixtures/${name}`, import.meta.url), 'utf8');
const quoteLine = (code: string) =>
  fixture('tencent.ashare.quote.txt').split('\n').find((l) => l.startsWith(`v_${code}=`))!;

function makeTrace(opts: { responseText?: string; toolCalls?: TraceToolCall[]; outcome?: 'ok' | 'error'; errorMessage?: string } = {}): AgentTrace {
  return {
    id: 't',
    sessionId: 's',
    userMessage: 'q',
    startedAt: 0,
    endedAt: 1,
    totalMs: 1,
    outcome: opts.outcome ?? 'ok',
    errorMessage: opts.errorMessage,
    turns: [
      {
        modelId: 'm',
        startedAt: 0,
        endedAt: 1,
        latencyMs: 1,
        toolCalls: opts.toolCalls ?? [],
        responseText: opts.responseText ?? '',
      },
    ],
  };
}

const quoteCall: TraceToolCall = {
  toolName: 'get_quote',
  args: { symbol: '600519' },
  result: { ok: true, price: 1341.99 },
  isError: false,
  startedAt: 0,
  latencyMs: 10,
};

describe('evaluateTrace（纯检查逻辑）', () => {
  it('全通过：正确工具 + 数字一致 + 免责 + 无违规词', () => {
    const checks = evaluateTrace(
      makeTrace({ toolCalls: [quoteCall], responseText: '最新价 1341.99 元。以上不构成投资建议。' }),
      { id: 't', message: 'q', expectTool: 'get_quote', mustInclude: [/不构成投资建议/], expectNot: [/美股/] },
    );
    expect(checks.every((c) => c.pass)).toBe(true);
  });

  it('工具选错 → 失败', () => {
    const checks = evaluateTrace(
      makeTrace({ toolCalls: [{ ...quoteCall, toolName: 'get_financials' }], responseText: 'PE 20.6' }),
      { id: 't', message: 'q', expectTool: 'get_quote' },
    );
    expect(checks.find((c) => c.name.includes('get_quote'))?.pass).toBe(false);
  });

  it('回答缺关键数字（幻觉）→ 失败', () => {
    const checks = evaluateTrace(
      makeTrace({ toolCalls: [quoteCall], responseText: '茅台价格挺高。' }),
      { id: 't', message: 'q', expectTool: 'get_quote' },
    );
    expect(checks.find((c) => c.name.includes('回答含数据'))?.pass).toBe(false);
  });

  it('数字带千分位逗号（1,341.99）也算包含', () => {
    const checks = evaluateTrace(
      makeTrace({ toolCalls: [quoteCall], responseText: '现价 1,341.99 元。' }),
      { id: 't', message: 'q', expectTool: 'get_quote' },
    );
    expect(checks.find((c) => c.name.includes('回答含数据'))?.pass).toBe(true);
  });

  it('回归：回答仍"仅支持美股"拒绝 → 失败', () => {
    const checks = evaluateTrace(
      makeTrace({ responseText: '我的工具仅支持美股，查不了A股。' }),
      { id: 't', message: 'q', expectNot: [/仅支持美股|不支持A股/] },
    );
    expect(checks.find((c) => c.name.includes('不支持A股'))?.pass).toBe(false);
  });

  it('正常回答"是A股，不是美股" → 通过（不误报）', () => {
    const checks = evaluateTrace(
      makeTrace({ responseText: '贵州茅台是 A 股，在上交所上市，不是美股。' }),
      { id: 't', message: 'q', expectNot: [/仅支持美股|不支持A股/] },
    );
    expect(checks.every((c) => c.pass)).toBe(true);
  });

  it('outcome=error → 失败', () => {
    const checks = evaluateTrace(makeTrace({ outcome: 'error', errorMessage: 'boom' }), { id: 't', message: 'q' });
    expect(checks.find((c) => c.name === 'outcome=ok')?.pass).toBe(false);
  });
});

describe('runCase（fauxProvider + 桩数据集成）', () => {
  function makeModels(faux: ReturnType<typeof fauxProvider>): ModelManager {
    const models = createModels();
    models.setProvider(faux.provider);
    return new ModelManager({
      models,
      config: {
        provider: faux.provider.id as ModelProvider,
        model: faux.getModel()!.id,
        baseUrl: 'faux',
        apiKey: 'test',
      },
    });
  }

  function makeMarket(): CompositeProvider {
    const tencent = {
      name: 'tencent',
      getQuote: async () => parseTencentAshareQuote(quoteLine('sh600519'), '600519')!,
      getKline: async () => [],
    } as unknown as TencentProvider;
    const sina = { name: 'sina', getQuote: async () => null } as unknown as SinaProvider;
    return new CompositeProvider({}, { tencent, sina });
  }

  it('跑通并通过：faux 调 get_quote，回答含价格', async () => {
    const faux = fauxProvider();
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall('get_quote', { symbol: '600519' })]),
      fauxAssistantMessage('贵州茅台最新价 1341.99 元。以上不构成投资建议。'),
    ]);
    const r = await runCase(makeModels(faux), makeMarket(), {
      id: 't',
      message: 'q',
      context: { symbol: '600519', name: '贵州茅台' },
      expectTool: 'get_quote',
      mustInclude: [/不构成投资建议/],
    });
    expect(r.pass).toBe(true);
    expect(r.trace.turns[0]!.toolCalls[0]!.toolName).toBe('get_quote');
  });

  it('回答缺数字 → 失败', async () => {
    const faux = fauxProvider();
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall('get_quote', { symbol: '600519' })]),
      fauxAssistantMessage('茅台价格挺高的。'),
    ]);
    const r = await runCase(makeModels(faux), makeMarket(), { id: 't', message: 'q', expectTool: 'get_quote' });
    expect(r.pass).toBe(false);
  });
});
