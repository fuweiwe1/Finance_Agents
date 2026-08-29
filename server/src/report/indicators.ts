import type { KlineBar, MarketQuote } from '../eval/market/types.js';

/**
 * 决策仪表盘 · 指标计算（纯函数，无网络）。
 * 从日K + 报价推导均线/乖离/支撑压力/量能状态/趋势基础分。
 * 支撑压力为启发式（近 K 线高低），调用方需标注「estimated」。
 */

export interface TrendIndicators {
  ma5?: number;
  ma10?: number;
  ma20?: number;
  biasMa5?: number; // 乖离率 % = (price - ma5) / ma5 * 100
  biasStatus: '安全' | '警戒' | '危险' | '未知';
  supportLevel?: number; // 近 20 日最低（启发式）
  resistanceLevel?: number; // 近 20 日最高（启发式）
  supportResistanceEstimated: boolean;
  volumeRatio5d?: number; // 今日量 / 近 5 日均量
  volumeStatus: '放量' | '缩量' | '平量' | '未知';
  trendScore: number; // 0-100 均线排列基础分（模型在此基础上叠加判断）
  barsUsed: number; // 实际用到的 K 线根数
}

const BIAS_SAFE = 6; // |乖离| ≤ 6% → 安全
const BIAS_WARN = 12; // 6% < |乖离| ≤ 12% → 警戒；>12% → 危险
const VOL_RISE = 1.5; // 今日量 / 5日均 ≥ 1.5 → 放量
const VOL_FALL = 0.7; // ≤ 0.7 → 缩量
const SUPPORT_RES_LOOKBACK = 20; // 支撑/压力回看根数

function mean(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

function lastN(closes: number[], n: number): number[] {
  return closes.slice(-n);
}

export function computeIndicators(kline: KlineBar[], quote: MarketQuote | null): TrendIndicators {
  const barsUsed = kline.length;
  const closes = kline.map((b) => b.close);

  const ma5 = mean(lastN(closes, 5));
  const ma10 = mean(lastN(closes, 10));
  const ma20 = mean(lastN(closes, 20));

  const price = quote?.price;
  let biasMa5: number | undefined;
  let biasStatus: TrendIndicators['biasStatus'] = '未知';
  if (price !== undefined && ma5 && ma5 > 0) {
    biasMa5 = (price / ma5 - 1) * 100;
    const abs = Math.abs(biasMa5);
    biasStatus = abs <= BIAS_SAFE ? '安全' : abs <= BIAS_WARN ? '警戒' : '危险';
  }

  // 支撑/压力：近 20 日最低/最高（含今日），数据不足时标记 estimated
  const look = kline.slice(-SUPPORT_RES_LOOKBACK);
  const supportLevel = look.length ? Math.min(...look.map((b) => b.low)) : undefined;
  const resistanceLevel = look.length ? Math.max(...look.map((b) => b.high)) : undefined;
  const supportResistanceEstimated = look.length < SUPPORT_RES_LOOKBACK;

  // 量能：今日量 vs 近 5 日均量（不含今日）
  const vols = kline.map((b) => b.volume);
  const todayVol = vols.length ? vols[vols.length - 1] : undefined;
  const prev5 = vols.slice(-6, -1);
  const prev5Avg = mean(prev5);
  let volumeRatio5d: number | undefined;
  let volumeStatus: TrendIndicators['volumeStatus'] = '未知';
  if (todayVol !== undefined && prev5Avg && prev5Avg > 0) {
    volumeRatio5d = todayVol / prev5Avg;
    volumeStatus = volumeRatio5d >= VOL_RISE ? '放量' : volumeRatio5d <= VOL_FALL ? '缩量' : '平量';
  }

  // 趋势基础分：价格在 MA20 上方 +20，均线多头排列 (ma5>ma10>ma20) +30，空头排列 -30，其余 0；clamp 0-100
  let trendScore = 50;
  if (price !== undefined && ma20 !== undefined) trendScore += price >= ma20 ? 15 : -15;
  if (ma5 !== undefined && ma10 !== undefined && ma20 !== undefined) {
    if (ma5 > ma10 && ma10 > ma20) trendScore += 25;
    else if (ma5 < ma10 && ma10 < ma20) trendScore -= 25;
  }
  trendScore = Math.max(0, Math.min(100, trendScore));

  return {
    ma5,
    ma10,
    ma20,
    biasMa5,
    biasStatus,
    supportLevel,
    resistanceLevel,
    supportResistanceEstimated,
    volumeRatio5d,
    volumeStatus,
    trendScore,
    barsUsed,
  };
}