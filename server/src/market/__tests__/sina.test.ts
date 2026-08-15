import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseSinaQuote } from '../sina.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('parseSinaQuote（新浪兜底解析）', () => {
  it('解析 TSLA 真实响应', () => {
    const q = parseSinaQuote(fixture('sina.tsla.txt'), 'TSLA');
    expect(q).not.toBeNull();
    expect(q!.name).toBe('特斯拉');
    expect(q!.price).toBe(342.27);
    expect(q!.open).toBe(342.33);
    expect(q!.high).toBe(351.26);
    expect(q!.low).toBe(335.3306);
    expect(q!.prevClose).toBe(339.96);
    expect(q!.change).toBeCloseTo(2.31, 2);
    expect(q!.marketCap).toBeCloseTo(1351811586544, 0);
    expect(q!.week52High).toBe(498.83);
    expect(q!.week52Low).toBe(297.38);
    expect(q!.afterHoursPrice).toBe(341.63);
    expect(q!.afterHoursChangePct).toBe(-0.64);
  });
});
