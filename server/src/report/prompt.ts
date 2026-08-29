import type { MarketQuote } from '../eval/market/types.js';
import type { TrendIndicators } from './indicators.js';

/**
 * 决策仪表盘 · 系统提示词 + 单股用户指令（无头报告管线用，与聊天提示词解耦）。
 */

export const REPORT_PHASE = 'postmarket';

export function buildReportSystemPrompt(): string {
  return `你是一名 A 股盘后分析师，为自选股生成【决策仪表盘】结构化报告。

评分带（按综合结论的强弱确定 final sentiment）：80-100 强烈买入；60-79 买入；40-59 观望（decision_type=hold）；0-39 减仓/卖出。

操作纪律（可操作性与稳定性约束，必须遵守）：
- 不得仅因单日涨跌或评分跨线就在"买入/卖出"之间剧烈切换。
- 操作建议必须同时参考价格位置（支撑/压力位）、量能、可用的风险事件；数据缺失项如实说明，不得假设。
- 股价位于支撑与压力之间、资金/量价方向不明确时，优先输出"持有/震荡/观望"等中性建议；decision_type 保持 "hold"。
- 只有在接近支撑确认或有效突破压力、且量价配合时才可给出买入；接近压力时不得追买。
- 只有在跌破关键支撑、或风险显著放大时才可给出卖出/减仓。
- 支撑/压力为启发式（近 20 日高低），标 "estimated"；不得编造精确的关键价位——证据不足时在狙击点写"需确认"。
- 本报告固定盘后口径：dashboard.phase_decision.phase = "postmarket"；不得伪造当日盘中走势；immediate_action 按未来 1-3 日给出，next_check_time 写下个交易日早盘前。
- 必须输出 dashboard.signal_attribution（六字段，说明构成：技术指标/新闻舆情/基本面/市场环境贡献度 + 最强多/空信号）。
- 数据为本空闲取（可能包含 stale/fallback/missing/partial/estimated 标记）；凡命中上述标记，confidence_level 不得为"高"，并在 data_limitations 注明。

无数据要求：
- 筹码分布（获利比例/平均成本/集中度）本管线暂无数据源：chip_structure 直接输出 null，不要在别处编造筹码数字。
- 所有无依据的数字字段（volume_ratio/换手率/支撑位/压力位等）输出 null 或"需确认"，绝不臆造。

输出协议（核心）：
- 先用 get_quote / get_financials / get_news / get_kline 获取所有需要的数据；预计算指标已在用户消息中给出，可复用作校验。
- 汇总后，一次性调用 submit_report 输出完整【决策仪表盘】JSON，参数必须严格符合该工具 schema（全部字段，缺数据字段填 null）。
- submit_report 必须单独调用（不要与其它工具并行），调完后不要再输出任何文字。

报告须以事实为准，不构成投资建议。`;
}

export interface ReportStockContext {
  symbol: string;
  name?: string;
  quote: MarketQuote | null;
  indicators: TrendIndicators;
  financials?: { pe?: number | null; pb?: number | null; turnoverRate?: number | null; eps?: number | null } | null;
  newsCount?: number;
  dataLimitations: string[];
}

const fmt = (n: number | undefined, digits = 2): string => (n === undefined || !Number.isFinite(n) ? '未知' : n.toFixed(digits));

function buildIndicatorBlock(ctx: ReportStockContext): string {
  const { indicators: r, quote } = ctx;
  const lines: string[] = [];
  lines.push(`现价 ${quote?.price !== undefined ? fmt(quote.price) : '未知'}（涨跌 ${quote ? `${quote.changePct != null ? `${quote.changePct.toFixed(2)}%` : '未知'}` : '未知'}）`);
  if (r.ma5 !== undefined || r.ma10 !== undefined || r.ma20 !== undefined) {
    lines.push(`MA5/10/20 = ${fmt(r.ma5)} / ${fmt(r.ma10)} / ${fmt(r.ma20)}；乖离率(MA5) ${r.biasMa5 !== undefined ? `${fmt(r.biasMa5)}%` : '未知'} → ${r.biasStatus}`);
  } else {
    lines.push('均线：K线不足，未知');
  }
  if (r.supportLevel !== undefined || r.resistanceLevel !== undefined) {
    const tag = r.supportResistanceEstimated ? '（启发式 estimated）' : '';
    lines.push(`支撑 ${fmt(r.supportLevel)} / 压力 ${fmt(r.resistanceLevel)}${tag}`);
  }
  lines.push(
    `量能：量比 ${quote?.volumeRatio !== undefined ? fmt(quote.volumeRatio) : '未知'}，5日量比 ${r.volumeRatio5d !== undefined ? fmt(r.volumeRatio5d) : '未知'}（近5日均量）→ ${r.volumeStatus}；换手率 ${quote?.turnoverRate !== undefined ? `${fmt(quote.turnoverRate)}%` : '未知'}`,
  );
  if (ctx.financials) {
    lines.push(`估值：PE ${ctx.financials.pe != null ? fmt(ctx.financials.pe) : '未知'} / PB ${ctx.financials.pb != null ? fmt(ctx.financials.pb) : '未知'} / EPS ${ctx.financials.eps != null ? fmt(ctx.financials.eps) : '未知'}`);
  }
  lines.push(`趋势基础分(启发式) ${r.trendScore}/100；新闻获取 ${ctx.newsCount ?? 0} 条`);
  if (ctx.dataLimitations.length) lines.push(`数据限制：${ctx.dataLimitations.join('；')}`);
  return lines.map((l) => `- ${l}`).join('\n');
}

/** 每股用户指令：把实际数据与指标快照喂给模型，让它基于事实产出仪表盘。 */
export function buildReportUserMessage(ctx: ReportStockContext): string {
  const phase = REPORT_PHASE;
  return `请对【${ctx.name ?? ctx.symbol}】(${ctx.symbol}) 生成盘后（${phase}）决策仪表盘。

预计算数据 / 指标（供你校验，不必逐字照抄）：
${buildIndicatorBlock(ctx)}

需要你通过 get_* 工具补全的：新闻、公告、走势形态与消息面解读。

完成后，调用 submit_report 输出完整决策仪表盘 JSON（decision_type/operation_advice 与本报告口径一致；所有无数据字段填 null；phase_decision.phase 必须为 "${phase}"；data_limitations 如实列出缺失项）。`;
}