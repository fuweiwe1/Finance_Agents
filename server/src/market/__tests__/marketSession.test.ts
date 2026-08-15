import { describe, it, expect } from 'vitest';
import { getMarketSession } from '../marketSession.js';

describe('getMarketSession (美东时段)', () => {
  // 2026-08-13 为周四，2026-08-14 为周五，2026-08-15 为周六
  it('regular hours', () => {
    expect(getMarketSession(new Date('2026-08-14T13:30:00-04:00'))).toBe('regular');
    expect(getMarketSession(new Date('2026-08-13T09:30:00-04:00'))).toBe('regular');
    expect(getMarketSession(new Date('2026-08-13T15:59:00-04:00'))).toBe('regular');
  });

  it('pre-market 4:00-9:30', () => {
    expect(getMarketSession(new Date('2026-08-14T06:00:00-04:00'))).toBe('pre');
    expect(getMarketSession(new Date('2026-08-13T09:29:00-04:00'))).toBe('pre');
  });

  it('post-market 16:00-20:00', () => {
    expect(getMarketSession(new Date('2026-08-14T17:00:00-04:00'))).toBe('post');
    expect(getMarketSession(new Date('2026-08-13T16:00:00-04:00'))).toBe('post');
    expect(getMarketSession(new Date('2026-08-13T19:59:00-04:00'))).toBe('post');
  });

  it('closed overnight and weekend', () => {
    expect(getMarketSession(new Date('2026-08-14T22:00:00-04:00'))).toBe('closed');
    expect(getMarketSession(new Date('2026-08-14T03:00:00-04:00'))).toBe('closed');
    expect(getMarketSession(new Date('2026-08-15T10:00:00-04:00'))).toBe('closed'); // 周六
  });
});
