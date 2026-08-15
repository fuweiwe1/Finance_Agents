import { MarketDataError, type KlineBar, type MarketQuote } from './types.js';
import { normalizeSymbol } from './normalize.js';
import { getMarketSession } from './marketSession.js';
import type { MarketDataProvider } from './provider.js';

/**
 * 腾讯行情（qt.gtimg.cn）——免 key、国内可达、A 股实时。字段为 `~` 分隔、无官方文档，
 * 索引映射经 sh600519/sz000001/sz300750 真实响应验证（88 字段）：
 *   0 市场(1=沪,51=深)  1 名称  2 代码  3 现价  4 昨收  5 今开  6 成交量(手)
 *   30 时间(yyyyMMddHHmmss)  31 涨跌额  32 涨跌幅%  33 最高  34 最低
 *   36 成交量(手)  37 成交额(万元)  38 换手率%  39 市盈率TTM
 *   43 振幅%  44 流通市值(亿)  45 总市值(亿)  46 市净率PB
 *   47 涨停  48 跌停  49 量比  51 均价  52 动态PE  53 静态PE
 *   67 一年高  68 一年低  72 总股本(股)  73 流通股本(股)  82 币种(CNY)
 */
const F = {
  market: 0,
  name: 1,
  code: 2,
  price: 3,
  prevClose: 4,
  open: 5,
  volumeLots: 6,
  time: 30,
  change: 31,
  changePct: 32,
  high: 33,
  low: 34,
  amountWan: 37,
  turnoverRate: 38,
  peTtm: 39,
  floatMarketCapYi: 44,
  totalMarketCapYi: 45,
  pb: 46,
  yearHigh: 67,
  yearLow: 68,
  totalShares: 72,
  currency: 82,
} as const;

const MIN_FIELDS = 88;

export function parseTencentAshareQuote(raw: string, symbol: string): MarketQuote | null {
  const m = raw.match(/="(.*)"\s*;?\s*$/);
  if (!m) throw new MarketDataError('unexpected response shape', 'tencent', 'parse');
  const body = m[1];
  if (!body) throw new MarketDataError('unexpected response shape', 'tencent', 'parse');
  const fields = body.split('~');
  if (fields.length < MIN_FIELDS) {
    throw new MarketDataError(`too few fields (${fields.length})`, 'tencent', 'parse');
  }

  const num = (i: number): number | undefined => {
    const v = fields[i];
    if (v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const price = num(F.price);
  if (price === undefined || price <= 0) return null; // 未上市/停牌

  const prevClose = num(F.prevClose);
  const change = num(F.change) ?? (prevClose !== undefined ? price - prevClose : 0);
  const changePct = num(F.changePct) ?? (prevClose && prevClose > 0 ? (price / prevClose - 1) * 100 : 0);
  const totalCapYi = num(F.totalMarketCapYi);
  const shares = num(F.totalShares);
  const pe = num(F.peTtm);
  const pb = num(F.pb);
  const eps = pe && pe > 0 && price > 0 ? price / pe : undefined; // 由 TTM PE 推导

  return {
    symbol,
    code: fields[F.code] || `${symbol}`,
    name: fields[F.name] || symbol,
    price,
    change,
    changePct,
    open: num(F.open) ?? price,
    high: num(F.high) ?? price,
    low: num(F.low) ?? price,
    prevClose: prevClose ?? price,
    volume: (num(F.volumeLots) ?? 0) * 100, // 手 → 股
    currency: fields[F.currency] || 'CNY',
    quoteTime: formatTime(fields[F.time] ?? ''),
    marketCap: totalCapYi !== undefined ? totalCapYi * 1e8 : undefined, // 亿 → 元
    marketCapFloat: num(F.floatMarketCapYi) !== undefined ? (num(F.floatMarketCapYi) as number) * 1e8 : undefined,
    week52High: num(F.yearHigh), // 一年高
    week52Low: num(F.yearLow), // 一年低
    sharesOutstanding: shares,
    session: getMarketSession(),
    pe,
    pb,
    turnoverRate: num(F.turnoverRate),
    eps,
  };
}

/** '20260814161443' → '2026-08-14 16:14:43' */
function formatTime(raw: string): string {
  if (!/^\d{14}$/.test(raw)) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`;
}

export function parseTencentKline(json: unknown, tencentCode: string): KlineBar[] {
  const root = json as {
    data?: Record<string, Record<string, unknown> | undefined>;
  };
  const node = root?.data?.[tencentCode];
  // A 股前复权日K在 qfqday，未复权在 day，后复权在 hfqday
  const rows = (node?.['qfqday'] ?? node?.['day'] ?? node?.['hfqday']) as string[][] | undefined;
  if (!Array.isArray(rows)) throw new MarketDataError('kline data missing', 'tencent', 'parse');

  const bars: KlineBar[] = [];
  for (const r of rows) {
    // [日期, open, close, high, low, volume(手)]；日期按 UTC 零点存，图表标签即交易日
    const [date, o, c, h, l, v] = r;
    const open = Number(o);
    const close = Number(c);
    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
    bars.push({
      ts: Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000),
      open,
      high: Number(h) || close,
      low: Number(l) || close,
      close,
      volume: (Number(v) || 0) * 100, // 手 → 股
    });
  }
  return bars;
}

export class TencentProvider implements MarketDataProvider {
  readonly name = 'tencent';
  private readonly decoder = new TextDecoder('gbk');

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    const norm = normalizeSymbol(symbol);
    if (!norm) throw new MarketDataError(`invalid symbol: ${symbol}`, 'tencent', 'invalid_symbol');

    const res = await fetch(`https://qt.gtimg.cn/q=${norm.tencent}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new MarketDataError(`HTTP ${res.status}`, 'tencent', 'network');
    const text = this.decoder.decode(await res.arrayBuffer());
    return parseTencentAshareQuote(text, norm.symbol);
  }

  async getKline(symbol: string, interval = 'day', count = 120): Promise<KlineBar[]> {
    const norm = normalizeSymbol(symbol);
    if (!norm) throw new MarketDataError(`invalid symbol: ${symbol}`, 'tencent', 'invalid_symbol');

    const res = await fetch(
      `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${norm.tencent},${interval},,,${count},qfq`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new MarketDataError(`HTTP ${res.status}`, 'tencent', 'network');
    const json = (await res.json()) as unknown;
    return parseTencentKline(json, norm.tencent);
  }
}
