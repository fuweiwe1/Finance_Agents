import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseSinaAshareQuote } from '../sina.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('parseSinaAshareQuote（新浪 A 股兜底）', () => {
  it('解析贵州茅台', () => {
    const q = parseSinaAshareQuote(fixture('sina.ashare.quote.txt'), '600519');
    expect(q).not.toBeNull();
    expect(q!.name).toBe('贵州茅台');
    expect(q!.price).toBe(1341.99);
    expect(q!.open).toBe(1355.0);
    expect(q!.prevClose).toBe(1355.29);
    expect(q!.high).toBe(1359.0);
    expect(q!.low).toBe(1338.14);
    expect(q!.volume).toBe(2985315); // 股
    expect(q!.changePct).toBeCloseTo(-0.98, 1);
  });
});
