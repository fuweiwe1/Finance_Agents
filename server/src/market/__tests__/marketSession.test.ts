import { describe, it, expect } from 'vitest';
import { getMarketSession } from '../marketSession.js';

describe('getMarketSession（北京时间 A 股时段）', () => {
  // 2026-08-14 周五，2026-08-15 周六
  it('连续竞价 9:30-11:30 / 13:00-15:00', () => {
    expect(getMarketSession(new Date('2026-08-14T10:00:00+08:00'))).toBe('regular');
    expect(getMarketSession(new Date('2026-08-14T11:29:00+08:00'))).toBe('regular');
    expect(getMarketSession(new Date('2026-08-14T13:30:00+08:00'))).toBe('regular');
    expect(getMarketSession(new Date('2026-08-14T14:59:00+08:00'))).toBe('regular');
  });

  it('集合竞价 9:15-9:30', () => {
    expect(getMarketSession(new Date('2026-08-14T09:20:00+08:00'))).toBe('pre');
  });

  it('午休/盘后/周末收盘', () => {
    expect(getMarketSession(new Date('2026-08-14T12:00:00+08:00'))).toBe('closed');
    expect(getMarketSession(new Date('2026-08-14T15:01:00+08:00'))).toBe('closed');
    expect(getMarketSession(new Date('2026-08-14T08:00:00+08:00'))).toBe('closed');
    expect(getMarketSession(new Date('2026-08-15T10:00:00+08:00'))).toBe('closed'); // 周六
  });
});
