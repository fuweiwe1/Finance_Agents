import { describe, it, expect } from 'vitest';
import { isTradingDay } from '../tradingDay.js';

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