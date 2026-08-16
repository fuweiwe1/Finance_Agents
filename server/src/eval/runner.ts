import type { AgentTrace, TraceToolCall } from '../trace/types.js';
import type { EvalCase } from './cases.js';
import type { ModelManager } from '../agent/models.js';
import type { CompositeProvider } from '../market/composite.js';
import { SessionAgent } from '../agent/sessionAgent.js';
import { TraceCollector } from '../trace/collector.js';

export interface EvalCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface EvalResult {
  caseId: string;
  pass: boolean;
  checks: EvalCheck[];
  trace: AgentTrace;
  latencyMs: number;
}

/**
 * 纯函数：基于 trace + 用例产出检查项（不依赖模型/网络，可单测）。
 * 维度：outcome / 工具调用正确性 / 回答数字与工具结果一致性(防幻觉) / mustInclude / expectNot。
 */
export function evaluateTrace(trace: AgentTrace, c: EvalCase): EvalCheck[] {
  const responseText = trace.turns.map((t) => t.responseText ?? '').join('\n');
  const toolCalls = trace.turns.flatMap((t) => t.toolCalls);
  const calledTools = toolCalls.map((tc) => tc.toolName);
  const checks: EvalCheck[] = [];

  checks.push({
    name: 'outcome=ok',
    pass: trace.outcome === 'ok',
    detail: trace.outcome === 'error' ? trace.errorMessage : undefined,
  });

  if (c.expectTool) {
    const ok = calledTools.includes(c.expectTool);
    checks.push({
      name: `调用 ${c.expectTool}`,
      pass: ok,
      detail: ok ? undefined : `实际调用: ${calledTools.join(', ') || '无'}`,
    });
  }

  // 数字一致性：取工具结果里的关键数字，检查回答是否包含
  for (const tc of toolCalls) {
    const n = extractPrimaryNumber(tc);
    if (n !== undefined) {
      const ok = containsNumber(responseText, n);
      checks.push({
        name: `回答含数据 ${n}`,
        pass: ok,
        detail: ok ? undefined : '回答未包含工具返回的关键数字（疑似幻觉）',
      });
    }
  }

  for (const re of c.mustInclude ?? []) {
    const ok = re.test(responseText);
    checks.push({ name: `包含「${re.source}」`, pass: ok });
  }
  for (const re of c.expectNot ?? []) {
    const bad = re.test(responseText);
    checks.push({
      name: `不含「${re.source}」`,
      pass: !bad,
      detail: bad ? '回答出现违规词' : undefined,
    });
  }

  return checks;
}

/**
 * 提取工具结果中的关键数字用于防幻觉校验。
 * 只对 get_quote 的 price 强制（"多少钱"类回答必须出现现价）；PE 等补充数据不强制，
 * 否则"走势/新闻"类问题误报。
 */
function extractPrimaryNumber(tc: TraceToolCall): number | undefined {
  const r = tc.result as Record<string, unknown> | undefined;
  if (!r || typeof r !== 'object') return undefined;
  // AgentToolResult 形如 { content, details }，数据在 details 里；也兼容直接对象
  const src = (r['details'] && typeof r['details'] === 'object' ? r['details'] : r) as Record<string, unknown>;
  if (tc.toolName === 'get_quote' && typeof src['price'] === 'number') return src['price'] as number;
  return undefined;
}

function containsNumber(answer: string, n: number): boolean {
  // 兼容千分位逗号（"1,341.99"）：去掉逗号再匹配
  const normalized = answer.replace(/,/g, '');
  return normalized.includes(String(n)) || normalized.includes(n.toFixed(2));
}

/** 跑单个用例：真实模型 + 真实数据 → trace → 检查 */
export async function runCase(
  models: ModelManager,
  market: CompositeProvider,
  c: EvalCase,
): Promise<EvalResult> {
  const agent = new SessionAgent(models, market);
  agent.setContext(c.context);
  const collector = new TraceCollector({
    sessionId: 'eval',
    userMessage: c.message,
    modelId: models.getConfig().model,
    context: c.context,
  });
  const t0 = Date.now();
  try {
    await agent.prompt(c.message, (e) => collector.onEvent(e));
  } catch (err) {
    collector.finish(err);
  }
  collector.finish();
  const trace = collector.trace;
  const checks = evaluateTrace(trace, c);
  return { caseId: c.id, pass: checks.every((x) => x.pass), checks, trace, latencyMs: Date.now() - t0 };
}
