import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseTencentAshareQuote, parseTencentKline } from '../tencent.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

function quoteLine(code: string): string {
  const line = fixture('tencent.ashare.quote.txt').split('\n').find((l) => l.startsWith(`v_${code}=`));
  if (!line) throw new Error(`fixture line for ${code} not found`);
  return line;
}

describe('parseTencentAshareQuote（腾讯 A 股，真实 fixture 锁格式）', () => {
  it('解析贵州茅台(sh600519)', () => {
    const q = parseTencentAshareQuote(quoteLine('sh600519'), '600519');
    expect(q).not.toBeNull();
    expect(q!.name).toBe('贵州茅台');
    expect(q!.price).toBe(1341.99);
    expect(q!.prevClose).toBe(1355.29);
    expect(q!.open).toBe(1355.0);
    expect(q!.high).toBe(1359.0);
    expect(q!.low).toBe(1338.14);
    expect(q!.volume).toBe(29853 * 100); // 手 → 股
    expect(q!.change).toBeCloseTo(-13.3, 2);
    expect(q!.changePct).toBeCloseTo(-0.98, 2);
    expect(q!.currency).toBe('CNY');
    expect(q!.marketCap).toBeCloseTo(16775.97 * 1e8, 0);
    expect(q!.pe).toBeCloseTo(20.6, 2);
    expect(q!.pb).toBeCloseTo(6.68, 2);
    expect(q!.turnoverRate).toBeCloseTo(0.24, 2);
    expect(q!.sharesOutstanding).toBe(1250081601);
    expect(q!.week52High).toBe(1539.98);
    expect(q!.week52Low).toBe(1151.01);
    expect(q!.quoteTime).toContain('2026-08-14');
  });

  it('解析平安银行(sz000001)与宁德时代(sz300750)', () => {
    const pa = parseTencentAshareQuote(quoteLine('sz000001'), '000001')!;
    expect(pa.name).toBe('平安银行');
    expect(pa.price).toBe(11.11);
    expect(pa.changePct).toBeCloseTo(-1.24, 2);

    const nd = parseTencentAshareQuote(quoteLine('sz300750'), '300750')!;
    expect(nd.name).toBe('宁德时代');
    expect(nd.price).toBe(393.93);
    expect(nd.pe).toBeCloseTo(21.44, 2);
  });
});

describe('parseTencentKline（A 股前复权日K qfqday）', () => {
  it('解析茅台日K', () => {
    const json = JSON.parse(fixture('tencent.ashare.kline.txt')) as unknown;
    const k = parseTencentKline(json, 'sh600519');
    expect(k.length).toBe(5);
    const last = k[4]!;
    expect(last.open).toBe(1355.0);
    expect(last.close).toBe(1341.99);
    expect(last.high).toBe(1359.0);
    expect(last.low).toBe(1338.14);
    expect(last.volume).toBe(29853 * 100);
    expect(new Date(last.ts * 1000).toISOString().slice(0, 10)).toBe('2026-08-14');
  });
});
