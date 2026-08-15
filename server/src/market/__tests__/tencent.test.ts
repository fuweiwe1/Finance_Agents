import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseTencentQuote } from '../tencent.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('parseTencentQuote（腾讯字段解析，真实响应 fixture 锁格式）', () => {
  it('解析 TSLA 真实响应', () => {
    const q = parseTencentQuote(fixture('tencent.tsla.txt'), 'TSLA');
    expect(q).not.toBeNull();
    expect(q!.name).toBe('特斯拉');
    expect(q!.code).toBe('TSLA.OQ');
    expect(q!.price).toBe(342.27);
    expect(q!.prevClose).toBe(339.96);
    expect(q!.open).toBe(342.33);
    expect(q!.high).toBe(351.26);
    expect(q!.low).toBe(335.33);
    expect(q!.volume).toBe(45437144);
    expect(q!.change).toBe(2.31);
    expect(q!.changePct).toBeCloseTo(0.68, 2);
    expect(q!.currency).toBe('USD');
    expect(q!.quoteTime).toContain('2026-08-14');
    expect(q!.marketCap).toBeCloseTo(13518.11587 * 1e8, 0);
    expect(q!.marketCapFloat).toBeCloseTo(12092.74913 * 1e8, 0);
    expect(q!.week52High).toBe(498.83);
    expect(q!.week52Low).toBe(297.38);
    expect(q!.sharesOutstanding).toBe(3949547394); // field 62 总股本（field 63 为流通股本）
    expect(q!.afterHoursPrice).toBe(342.81);
  });

  it('解析 AAPL 真实响应（交叉验证字段索引）', () => {
    const q = parseTencentQuote(fixture('tencent.aapl.txt'), 'AAPL');
    expect(q!.price).toBe(305.93);
    expect(q!.high).toBe(307.49);
    expect(q!.low).toBe(304.3);
    expect(q!.marketCap).toBeCloseTo(44647.97487 * 1e8, 0);
    expect(q!.sharesOutstanding).toBe(14594180000);
    expect(q!.week52High).toBe(344.26);
    expect(q!.week52Low).toBe(222.95);
    expect(q!.afterHoursPrice).toBe(305.78);
  });

  it('解析 NVDA 真实响应（交叉验证）', () => {
    const q = parseTencentQuote(fixture('tencent.nvda.txt'), 'NVDA');
    expect(q!.price).toBe(225.16);
    expect(q!.changePct).toBeCloseTo(-0.06, 2);
    expect(q!.sharesOutstanding).toBe(24221000000);
    expect(q!.marketCap).toBeCloseTo(54536.0036 * 1e8, 0);
  });

  it('无效代码（全零）返回 null', () => {
    expect(parseTencentQuote(fixture('tencent.invalid.txt'), 'ZZZZ')).toBeNull();
  });

  it('畸形响应抛 parse 错误', () => {
    expect(() => parseTencentQuote('garbage', 'TSLA')).toThrow();
    expect(() => parseTencentQuote('v_usTSLA="only",', 'TSLA')).toThrow();
  });
});
