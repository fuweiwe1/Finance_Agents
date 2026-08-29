import { describe, it, expect } from 'vitest';
import type { MarketQuote } from '../../eval/market/types.js';
import { validateReport, issuesToLimitations } from '../validate.js';
import { makeReport } from './fixture.js';

const quote: MarketQuote = {
  symbol: '600519',
  code: '600519',
  name: '贵州茅台',
  price: 1297.4,
  change: 5,
  changePct: 0.39,
  open: 1295,
  high: 1301,
  low: 1289,
  prevClose: 1292.4,
  volume: 100000,
  currency: 'CNY',
  quoteTime: '',
  session: 'post',
};

const indicators = {
  ma5: 1300.23,
  ma10: 1296.44,
  ma20: 1315.58,
  biasMa5: -0.22,
  biasStatus: '安全' as const,
  supportLevel: 1270.33,
  resistanceLevel: 1363.35,
  supportResistanceEstimated: true,
  volumeRatio5d: 0.54,
  volumeStatus: '缩量' as const,
  trendScore: 35,
  barsUsed: 120,
};

/** 覆盖 price_position 的某几个字段，其余取自默认报告。 */
function withPricePosition(over: { current_price?: number; support_level?: number; resistance_level?: number; bias_ma5?: number }) {
  const base = makeReport();
  const dp = base.dashboard.data_perspective;
  return makeReport({
    dashboard: { data_perspective: { ...dp, price_position: { ...dp.price_position, ...over } } },
  });
}

describe('validateReport', () => {
  it('自洽报告 → ok', () => {
    const r = validateReport(makeReport(), { quote, indicators });
    expect(r.ok).toBe(true);
  });

  it('current_price 与行情偏差 >5% → 硬冲突（regen）', () => {
    const r = validateReport(withPricePosition({ current_price: 1400 }), { quote, indicators });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.startsWith('[regen]') && i.includes('current_price'))).toBe(true);
  });

  it('support > resistance → 硬冲突', () => {
    const r = validateReport(withPricePosition({ support_level: 1400, resistance_level: 1300 }), { quote, indicators });
    expect(r.ok).toBe(false);
  });

  it('bias 偏离计算值 → 软冲突，不阻断', () => {
    const r = validateReport(withPricePosition({ bias_ma5: 8 }), { quote, indicators });
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.startsWith('[soft]') && i.includes('bias_ma5'))).toBe(true);
  });

  it('decision_type 与 operation_advice 不一致 → 软冲突', () => {
    const r = validateReport(makeReport({ decision_type: 'buy', operation_advice: '卖出' }), { quote, indicators });
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.includes('decision_type'))).toBe(true);
  });

  it('sentiment 低但 buy → 软冲突', () => {
    const r = validateReport(makeReport({ sentiment_score: 30, decision_type: 'buy', operation_advice: '买入' }), { quote, indicators });
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.includes('sentiment'))).toBe(true);
  });

  it('issuesToLimitations 剥离前缀', () => {
    expect(issuesToLimitations(['[soft] 支撑压力为估计', '[regen] current_price 偏差 8%'])).toEqual(['支撑压力为估计', 'current_price 偏差 8%']);
  });
});