import { MarketDataError, type KlineBar, type MarketQuote } from './types.js';
import { normalizeSymbol } from './normalize.js';
import { getMarketSession } from './marketSession.js';
import type { MarketDataProvider } from './provider.js';

/**
 * 腾讯行情（qt.gtimg.cn）——免 key、国内可达、美股实时。
 *
 * 字段为 `~` 分隔、无官方文档，索引映射经 TSLA/AAPL/NVDA 真实响应交叉验证：
 *   0 市场(200=美股)  1 中文名  2 代码(如 TSLA.OQ)  3 现价  4 昨收  5 今开  6 成交量
 *   30 行情时间(美东) 31 涨跌额 32 涨跌幅%  33 最高  34 最低  35 币种
 *   44 流通市值(亿USD) 45 总市值(亿USD)  46 英文全名  48 52周高  49 52周低
 *   62 总股本(股)     67 盘后价
 * 其中 3 为常规时段收盘价，67 为盘后最新价。
 */
const F = {
  market: 0,
  name: 1,
  code: 2,
  price: 3,
  prevClose: 4,
  open: 5,
  volume: 6,
  time: 30,
  change: 31,
  changePct: 32,
  high: 33,
  low: 34,
  currency: 35,
  floatMarketCap: 44,
  totalMarketCap: 45,
  nameEn: 46,
  week52High: 48,
  week52Low: 49,
  totalShares: 62,
  afterHoursPrice: 67,
} as const;

const MIN_FIELDS = 68;

export function parseTencentQuote(raw: string, symbol: string): MarketQuote | null {
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
  if (price === undefined || price <= 0) return null; // 无效代码 / 未上市

  const prevClose = num(F.prevClose);
  const change = num(F.change) ?? (prevClose !== undefined ? price - prevClose : 0);
  const changePct = num(F.changePct) ?? (prevClose && prevClose > 0 ? (price / prevClose - 1) * 100 : 0);
  const marketCap = num(F.totalMarketCap);
  const afterHours = num(F.afterHoursPrice);
  const afterHoursChangePct = afterHours !== undefined && price > 0 ? ((afterHours - price) / price) * 100 : undefined;

  return {
    symbol,
    code: fields[F.code] || `${symbol}.US`,
    name: fields[F.name] || fields[F.nameEn] || symbol,
    price,
    change,
    changePct,
    open: num(F.open) ?? price,
    high: num(F.high) ?? price,
    low: num(F.low) ?? price,
    prevClose: prevClose ?? price,
    volume: num(F.volume) ?? 0,
    currency: fields[F.currency] || 'USD',
    quoteTime: fields[F.time] || '',
    marketCap: marketCap !== undefined ? marketCap * 1e8 : undefined,
    marketCapFloat: num(F.floatMarketCap) !== undefined ? (num(F.floatMarketCap) as number) * 1e8 : undefined,
    week52High: num(F.week52High),
    week52Low: num(F.week52Low),
    sharesOutstanding: num(F.totalShares),
    afterHoursPrice: afterHours,
    afterHoursChangePct,
    session: getMarketSession(),
  };
}

export function parseTencentKline(json: unknown, tencentCode: string): KlineBar[] {
  const root = json as {
    data?: Record<string, { day?: string[][]; [k: string]: unknown }>;
  };
  const node = root?.data?.[tencentCode];
  const rows = node?.day ?? node?.['day'];
  if (!Array.isArray(rows)) throw new MarketDataError('kline data missing', 'tencent', 'parse');

  const bars: KlineBar[] = [];
  for (const r of rows) {
    // [日期, open, close, high, low, volume]
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
      volume: Number(v) || 0,
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
    return parseTencentQuote(text, norm.symbol);
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
