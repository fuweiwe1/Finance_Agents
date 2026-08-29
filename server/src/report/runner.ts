import { Agent } from '@earendil-works/pi-agent-core';
import type { ModelManager } from '../agent/models.js';
import { buildTools } from '../agent/tools.js';
import type { CompositeProvider } from '../eval/market/composite.js';
import { normalizeSymbol } from '../eval/market/normalize.js';
import { computeIndicators, type TrendIndicators } from './indicators.js';
import { buildReportSystemPrompt, buildReportUserMessage, type ReportStockContext } from './prompt.js';
import { makeSubmitReportTool, type StockReport } from './schema.js';
import { issuesToLimitations, validateReport } from './validate.js';

/** 每股数据上下文（喂给提示词 + 校验用）。 */
export interface StockReportResult {
  symbol: string;
  ok: boolean;
  report?: StockReport;
  error?: string;
  issues: string[];
  latencyMs: number;
}

const PER_STOCK_TIMEOUT_MS = 180_000;

async function collectContext(market: CompositeProvider, symbol: string): Promise<ReportStockContext> {
  const norm = normalizeSymbol(symbol);
  if (!norm) throw new Error(`无效的 A 股代码: ${symbol}`);
  const sym = norm.symbol;

  const dataLimitations: string[] = [];

  const [quote, kline, financials, news] = await Promise.all([
    market.getQuote(sym).catch(() => null),
    market.getKline(sym, 'day', 120).catch(() => []),
    market.getFinancials(sym).catch(() => null),
    market.getNews(sym, 8).catch(() => []),
  ]);

  if (!quote) dataLimitations.push('行情获取失败，价格/量能数据不全');
  if (!kline.length) dataLimitations.push('K线获取失败，均线/支撑压力为估计');

  const indicators: TrendIndicators = computeIndicators(kline, quote);
  if (indicators.supportResistanceEstimated) dataLimitations.push('支撑压力基于近20日数据，属启发式估计');

  return {
    symbol: sym,
    name: quote?.name ?? sym,
    quote,
    indicators,
    financials: financials
      ? { pe: financials.pe, pb: financials.pb, turnoverRate: financials.turnoverRate, eps: financials.eps }
      : null,
    newsCount: news.length,
    dataLimitations,
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} 超时 ${ms / 1000}s`)), ms)),
  ]);
}

async function attemptOnce(
  ctx: ReportStockContext,
  models: ModelManager,
  market: CompositeProvider,
  correction?: string,
): Promise<StockReport> {
  const model = models.getModel();
  if (!model) throw new Error('未配置模型');

  let report: StockReport | undefined;
  const agent = new Agent({
    initialState: {
      systemPrompt: buildReportSystemPrompt(),
      model,
      tools: [...buildTools(market), makeSubmitReportTool((r) => (report = r))],
    },
    streamFn: models.streamFn(),
  });

  const userMsg = correction ? `${buildReportUserMessage(ctx)}\n\n【上次校验失败提示】${correction}\n请修正后重新调用 submit_report。` : buildReportUserMessage(ctx);
  await withTimeout(agent.prompt(userMsg), PER_STOCK_TIMEOUT_MS, `${ctx.symbol} 报告生成`);

  if (!report) throw new Error('模型未调用 submit_report 提交报告');
  return report;
}

export async function runStockReport(
  models: ModelManager,
  market: CompositeProvider,
  symbol: string,
): Promise<StockReportResult> {
  const t0 = Date.now();
  try {
    const ctx = await collectContext(market, symbol);
    let report: StockReport;
    let issues: string[] = [];

    // 首次生成
    report = await attemptOnce(ctx, models, market);

    // 一致性校验；硬冲突重生成一次
    const v = validateReport(report, { quote: ctx.quote, indicators: ctx.indicators });
    issues = [...v.issues];
    if (!v.ok) {
      const correction = issues.filter((i) => i.startsWith('[regen]')).map((i) => i.replace(/^\[regen\] /, '')).join('；');
      try {
        report = await attemptOnce(ctx, models, market, correction);
        const v2 = validateReport(report, { quote: ctx.quote, indicators: ctx.indicators });
        issues = [...v2.issues];
      } catch {
        // 重试失败保留首版（降级处理）
      }
    }

    // 数据局限 → 置信度不得为「高」，并把问题并入 data_limitations
    const soft = issuesToLimitations(issues.filter((i) => !i.startsWith('[regen]')));
    appendLimitations(report, soft);
    const finalConfidence: StockReport['confidence_level'] =
      issues.length > 0 && report.confidence_level === '高' ? '中' : report.confidence_level;
    if (finalConfidence !== report.confidence_level) {
      report = { ...report, confidence_level: finalConfidence };
    }

    return { symbol, ok: true, report, issues, latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      symbol,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      issues: [],
      latencyMs: Date.now() - t0,
    };
  }
}

function appendLimitations(report: StockReport, list: string[]): void {
  if (!list.length) return;
  const existing = report.dashboard?.phase_decision?.data_limitations ?? [];
  const merged = [...new Set([...existing, ...list])];
  if (report.dashboard?.phase_decision) report.dashboard.phase_decision.data_limitations = merged;
}

export interface RunReportOptions {
  /** 并发上限 */
  concurrency?: number;
  onLog?: (line: string) => void;
}

export async function runReports(
  models: ModelManager,
  market: CompositeProvider,
  symbols: string[],
  opts: RunReportOptions = {},
): Promise<StockReportResult[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const log = opts.onLog ?? (() => {});
  const results: StockReportResult[] = new Array(symbols.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const i = cursor++;
      if (i >= symbols.length) return;
      const sym = symbols[i]!;
      log(`▶ ${sym} ...`);
      const r = await runStockReport(models, market, sym);
      results[i] = r;
      log(`  ${r.ok ? `✅ ${sym}` : `❌ ${sym}: ${r.error ?? '生成失败'}`}（${(r.latencyMs / 1000).toFixed(1)}s${r.issues.length ? `, ${r.issues.length} 个提示` : ''}）`);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker()));
  return results;
}