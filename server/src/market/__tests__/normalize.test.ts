import { describe, it, expect } from 'vitest';
import { normalizeSymbol, isValidSymbol } from '../normalize.js';

describe('normalizeSymbol（A 股）', () => {
  it('沪市 600/601/688 开头', () => {
    expect(normalizeSymbol('600519')).toEqual({
      symbol: '600519',
      code: 'sh600519',
      tencent: 'sh600519',
      sina: 'sh600519',
      exchange: 'sh',
    });
    expect(normalizeSymbol('688981')?.exchange).toBe('sh');
  });

  it('深市 000/002/300 开头', () => {
    expect(normalizeSymbol('000001')?.exchange).toBe('sz');
    expect(normalizeSymbol('002594')?.exchange).toBe('sz');
    expect(normalizeSymbol('300750')?.exchange).toBe('sz');
  });

  it('北交所 43/83/87 开头', () => {
    expect(normalizeSymbol('830799')?.exchange).toBe('bj');
    expect(normalizeSymbol('430047')?.exchange).toBe('bj');
  });

  it('接受 sh/sz/bj 前缀', () => {
    expect(normalizeSymbol('sh600519')?.symbol).toBe('600519');
    expect(normalizeSymbol('SZ000001')?.exchange).toBe('sz');
    expect(normalizeSymbol('BJ830799')?.exchange).toBe('bj');
  });

  it('拒绝非法输入', () => {
    expect(normalizeSymbol('')).toBeNull();
    expect(normalizeSymbol('60051')).toBeNull(); // 5 位
    expect(normalizeSymbol('abcdef')).toBeNull();
    expect(normalizeSymbol('999999')).toBeNull(); // 无对应交易所
    expect(normalizeSymbol('TSLA')).toBeNull(); // 美股不在支持范围
  });

  it('isValidSymbol', () => {
    expect(isValidSymbol('600519')).toBe(true);
    expect(isValidSymbol('000001')).toBe(true);
    expect(isValidSymbol('TSLA')).toBe(false);
  });
});
