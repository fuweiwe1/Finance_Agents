import { describe, it, expect } from 'vitest';
import { normalizeSymbol, isValidSymbol } from '../normalize.js';

describe('normalizeSymbol', () => {
  it('uppercases plain tickers', () => {
    expect(normalizeSymbol('tsla')).toEqual({
      symbol: 'TSLA',
      code: 'TSLA.US',
      tencent: 'usTSLA',
      sina: 'gb_tsla',
    });
  });

  it('handles exchange suffixes', () => {
    expect(normalizeSymbol('TSLA.US')?.symbol).toBe('TSLA');
    expect(normalizeSymbol('AAPL.NASDAQ')?.symbol).toBe('AAPL');
    expect(normalizeSymbol('NVDA.OQ')?.symbol).toBe('NVDA');
    expect(normalizeSymbol('msft.nyse')?.symbol).toBe('MSFT');
  });

  it('strips tencent lowercase us prefix', () => {
    expect(normalizeSymbol('usTSLA')?.symbol).toBe('TSLA');
    expect(normalizeSymbol('usaapl')?.symbol).toBe('AAPL');
  });

  it('does NOT corrupt real tickers starting with uppercase US', () => {
    // "USEG"（U.S. Energy）是真实美股，绝不能剥成 "EG"
    expect(normalizeSymbol('USEG')?.symbol).toBe('USEG');
  });

  it('rejects invalid symbols', () => {
    expect(normalizeSymbol('')).toBeNull();
    expect(normalizeSymbol('ABCDEFG')).toBeNull(); // 7 位，超出美股 1-5 位规则
    expect(normalizeSymbol('12345')).toBeNull();
    expect(normalizeSymbol('你好')).toBeNull();
    expect(normalizeSymbol('TSLA!!')).toBeNull();
  });

  it('isValidSymbol', () => {
    expect(isValidSymbol('TSLA')).toBe(true);
    expect(isValidSymbol('v')).toBe(true); // 单字母 ticker（如 Visa）合法
    expect(isValidSymbol('INVALID!!')).toBe(false);
    expect(isValidSymbol('')).toBe(false);
  });
});
