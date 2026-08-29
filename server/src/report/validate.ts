import type { MarketQuote } from '../eval/market/types.js';
import type { TrendIndicators } from './indicators.js';
import type { StockReport } from './schema.js';

/**
 * 一致性校验：报表中的关键数字与行情/指标快照是否自洽；
 * 决策标签与评分带、操作建议是否一致。数值硬冲突 → 重生成；软冲突 → 降级/标记。
 */

export interface ValidateResult {
  ok: boolean;
  issues: string[];
}

const ISSUE_REGEN = 'regen'; // 硬问题：重试一次
const ISSUE_SOFT = 'soft'; // 软问题：降置信 + data_limitations

export function validateReport(
  report: StockReport,
  ctx: { quote: MarketQuote | null; indicators: TrendIndicators },
): ValidateResult {
  const issues: string[] = [];
  const pricePos = report.dashboard?.data_perspective?.price_position;

  // 数值自洽
  if (ctx.quote?.price != null && pricePos?.current_price != null) {
    const p = pricePos.current_price;
    const q = ctx.quote.price;
    const diff = Math.abs(p - q) / q;
    if (diff > 0.05) {
      issues.push(`[${ISSUE_REGEN}] current_price=${p} 与行情 ${q} 偏差 ${(diff * 100).toFixed(1)}%`);
    }
  }

  if (pricePos?.bias_ma5 != null && ctx.indicators.biasMa5 != null) {
    if (Math.abs(pricePos.bias_ma5 - ctx.indicators.biasMa5) > 3) {
      issues.push(`[${ISSUE_SOFT}] bias_ma5=${pricePos.bias_ma5}% 与计算 ${ctx.indicators.biasMa5.toFixed(2)}% 偏差>3pt`);
    }
  }

  const s = pricePos?.support_level;
  const r = pricePos?.resistance_level;
  const cur = pricePos?.current_price;
  if (s != null && r != null && s > r) {
    issues.push(`[${ISSUE_REGEN}] support ${s} > resistance ${r}`);
  }
  if (cur != null && s != null && cur < s) {
    issues.push(`[${ISSUE_SOFT}] current_price ${cur} 低于 support ${s}`);
  }
  if (cur != null && r != null && cur > r) {
    issues.push(`[${ISSUE_SOFT}] current_price ${cur} 高于 resistance ${r}`);
  }

  // 决策标签一致性（软）
  const mapOp: Record<string, string[]> = {
    buy: ['买入', '加仓'],
    hold: ['持有', '观望'],
    sell: ['减仓', '卖出'],
  };
  const op = report.operation_advice;
  if (op && !(mapOp[report.decision_type] ?? []).includes(op)) {
    issues.push(`[${ISSUE_SOFT}] decision_type=${report.decision_type} 与 operation_advice=${op} 不一致`);
  }

  const sc = report.sentiment_score;
  if (sc != null) {
    if (sc < 40 && report.decision_type === 'buy') {
      issues.push(`[${ISSUE_SOFT}] sentiment ${sc} 低但 decision_type=buy`);
    }
    if (sc >= 60 && report.decision_type === 'sell') {
      issues.push(`[${ISSUE_SOFT}] sentiment ${sc} 高但 decision_type=sell`);
    }
  }

  const hard = issues.some((i) => i.startsWith('[' + ISSUE_REGEN + ']'));
  return { ok: !hard, issues };
}

/** 把校验问题转成（降级）data_limitations 文案。 */
export function issuesToLimitations(issues: string[]): string[] {
  return issues.map((i) => i.replace(/^\[(soft|regen)\] /, '').trim());
}