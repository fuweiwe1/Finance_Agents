import { describe, it, expect } from 'vitest';
import type { KlineBar, MarketQuote } from '../../eval/market/types.js';
import { computeIndicators } from '../indicators.js';

function makeKline(prices: number[], vols?: number[]): KlineBar[] {
  return prices.map((close, i) => ({
    ts: i,
    open: close,
    high: close + 0.1,
    low: close - 0.1,
    close,
    volume: vols?.[i] ?? 1_000_000,
  }));
}

function makeQuote(price: number): MarketQuote {
  return {
    symbol: '600519',
    code: '600519',
    name: '测试',
    price,
    change: 0,
    changePct: 0,
    open: price,
    high: price,
    low: price,
    prevClose: price,
    volume: 0,
    currency: 'CNY',
    quoteTime: '',
    session: 'post',
  };
}

describe('computeIndicators', () => {
  it('计算 MA5/10/20 与乖离率', () => {
    // 20 根横盘 100 元 + 最后一根 105 元
    const prices = [...Array(20).fill(100), 105];
    const k = makeKline(prices);
    const q = makeQuote(105);
    const r = computeIndicators(k, q);

    expect(r.ma5).toBeCloseTo(101, 6); // 近5根: [100,100,100,100,105]
    expect(r.ma10).toBeCloseTo(100.5, 6);
    expect(r.ma20).toBeCloseTo(100.25, 6);
    expect(r.biasMa5).toBeCloseTo((105 / 101 - 1) * 100, 6);
    expect(r.biasStatus).toBe('安全'); // 乖离 ~3.96%
    expect(r.barsUsed).toBe(21);
  });

  it('乖离率状态阈值：安全 → 警戒 → 危险', () => {
    const base = [...Array(20).fill(100)];
    const near = computeIndicators(makeKline([...base, 100.5]), makeQuote(100.5));
    expect(near.biasStatus).toBe('安全');

    const warn = computeIndicators(makeKline([...base, 109]), makeQuote(109));
    expect(warn.biasStatus).toBe('警戒');

    const danger = computeIndicators(makeKline([...base, 120]), makeQuote(120));
    expect(danger.biasStatus).toBe('危险');
  });

  it('支撑/压力 = 近20日高低，数据不足标记 estimated', () => {
    const k = makeKline(Array.from({ length: 50 }, (_, i) => 80 + (i % 40)));
    const r = computeIndicators(k, makeQuote(100));
    expect(r.supportLevel).toBeCloseTo(79.9, 6); // 近20日最低（含 low=close-0.1）
    expect(r.resistanceLevel).toBeCloseTo(119.1, 6);
    expect(r.supportResistanceEstimated).toBe(false);

    const short = computeIndicators(makeKline(Array(10).fill(50)), makeQuote(52));
    expect(short.supportResistanceEstimated).toBe(true);
    expect(short.supportLevel).toBeCloseTo(49.9, 6); // 仍给启发值，但标记 estimated
    expect(short.resistanceLevel).toBeCloseTo(50.1, 6);
  });

  it('量能：放量/缩量/平量', () => {
    // 今日量 3x 于前5日均量 → 放量
    const vols = [1, 1, 1, 1, 1, 1, 3];
    const k = makeKline(Array(7).fill(100), vols);
    const r = computeIndicators(k, makeQuote(100));
    expect(r.volumeRatio5d).toBe(3);
    expect(r.volumeStatus).toBe('放量');

    const r2 = computeIndicators(makeKline(Array(7).fill(100), [1, 1, 1, 1, 1, 1, 0.5]), makeQuote(100));
    expect(r2.volumeStatus).toBe('缩量');

    const r3 = computeIndicators(makeKline(Array(7).fill(100), [1, 1, 1, 1, 1, 1, 1.1]), makeQuote(100));
    expect(r3.volumeStatus).toBe('平量');
  });

  it('趋势基础分：多头排列 > 空头排列', () => {
    const bull = computeIndicators(makeKline(Array.from({ length: 25 }, (_, i) => 90 + i * 2)), makeQuote(145));
    const bear = computeIndicators(makeKline(Array.from({ length: 25 }, (_, i) => 140 - i * 2)), makeQuote(95));
    expect(bull.trendScore).toBeGreaterThan(bear.trendScore);
    expect(bull.trendScore).toBeGreaterThan(50);
    expect(bear.trendScore).toBeLessThan(50);
  });
});