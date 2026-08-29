import { describe, it, expect } from 'vitest';
import { isTradingDay, hasTradingBarOnDate } from '../tradingDay.js';
import type { CompositeProvider } from '../../eval/market/composite.js';

function fakeFetch(route: (url: string) => Response | Promise<Response>): typeof fetch {
  return (async (input: unknown) => {
    const url = input instanceof URL ? input.toString() : String(input);
    return await route(url);
  }) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(ok ? JSON.stringify(body) : 'err', {
    status: ok ? 200 : 500,
    headers: { 'content-type': 'application/json' },
  });
}

describe('isTradingDay', () => {
  it('timor 权威接口：法定假日 → 非交易日', async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toContain('timor.tech');
      return Promise.resolve(
        jsonResponse({
          code: 0,
          holiday: { '2026-10-02': { holiday: true, name: '国庆' } },
        }),
      );
    });
    const r = await isTradingDay(new Date('2026-10-02T20:00:00+08:00'), { fetchImpl });
    expect(r.isTradingDay).toBe(false);
    expect(r.source).toBe('timor');
  });

  it('timor 权威接口：调休上班的周末 → 交易日', async () => {
    const fetchImpl = fakeFetch(() =>
      Promise.resolve(
        jsonResponse({
          code: 0,
          holiday: { '2026-10-10': { holiday: false, name: '调休' } },
        }),
      ),
    );
    // 2026-10-10 是周六
    const r = await isTradingDay(new Date('2026-10-10T12:00:00+08:00'), { fetchImpl });
    expect(new Date('2026-10-10T00:00:00+08:00').getDay()).toBe(6);
    expect(r.isTradingDay).toBe(true);
    expect(r.source).toBe('timor');
  });

  it('timor 无记录 + 工作日 → 交易日', async () => {
    const fetchImpl = fakeFetch(() =>
      Promise.resolve(jsonResponse({ code: 0, holiday: { '2026-01-01': { holiday: true, name: '元旦' } } })),
    );
    const r = await isTradingDay(new Date('2026-03-05T12:00:00+08:00'), { fetchImpl }); // 周四
    expect(r.isTradingDay).toBe(true);
  });

  it('timor 失败 → bitefu 单日接口', async () => {
    let calls = 0;
    const fetchImpl = fakeFetch((url) => {
      calls++;
      if (url.includes('timor.tech')) return Promise.resolve(jsonResponse(null, false));
      if (url.includes('bitefu')) return Promise.resolve(jsonResponse({ workday: 1 }));
      return Promise.resolve(jsonResponse({ ok: false }));
    });
    const r = await isTradingDay(new Date('2026-03-05T12:00:00+08:00'), { fetchImpl });
    expect(calls).toBe(2);
    expect(r.isTradingDay).toBe(true);
    expect(r.source).toBe('bitefu');
  });

  it('全部失败 + 周末 → 非交易日（兜底）', async () => {
    const fetchImpl = fakeFetch(() => Promise.reject(new Error('network down')));
    const r = await isTradingDay(new Date('2026-03-07T12:00:00+08:00'), { fetchImpl }); // 周六
    expect(r.isTradingDay).toBe(false);
    expect(r.source).toBe('weekday-fallback');
  });

  it('全部失败 + 工作日 → 交易日（兜底）', async () => {
    const fetchImpl = fakeFetch(() => Promise.reject(new Error('network down')));
    const r = await isTradingDay(new Date('2026-03-05T12:00:00+08:00'), { fetchImpl });
    expect(r.isTradingDay).toBe(true);
    expect(r.source).toBe('weekday-fallback');
  });
});

describe('hasTradingBarOnDate（行情核验）', () => {
  const bar = (ymd: string): { ts: number; open: number; high: number; low: number; close: number; volume: number } => ({
    ts: Math.floor(new Date(`${ymd}T00:00:00Z`).getTime() / 1000),
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1000,
  });

  const fakeMarket = (bars: unknown[] | (() => Promise<unknown[]>)) =>
    ({ getKline: typeof bars === 'function' ? bars : async () => bars }) as unknown as Pick<CompositeProvider, 'getKline'>;

  it('当日有 bar → 交易日', async () => {
    const m = fakeMarket([bar('2026-08-28')]);
    expect(await hasTradingBarOnDate(new Date('2026-08-28T20:00:00+08:00'), m)).toBe(true);
  });

  it('当日无 bar（如节假日）→ 非交易日', async () => {
    const m = fakeMarket([bar('2026-08-27'), bar('2026-08-28')]);
    expect(await hasTradingBarOnDate(new Date('2026-08-29T20:00:00+08:00'), m)).toBe(false); // 周六无当日 bar
  });

  it('行情空/异常 → 按工作日放行（宁漏勿误跳）', async () => {
    expect(await hasTradingBarOnDate(new Date('2026-03-05T20:00:00+08:00'), fakeMarket([]))).toBe(true);
    expect(await hasTradingBarOnDate(new Date('2026-03-05T20:00:00+08:00'), fakeMarket(async () => Promise.reject(new Error('down'))))).toBe(true);
  });
});