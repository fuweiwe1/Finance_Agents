import { MarketDataError, type MarketQuote } from './types.js';
import { normalizeSymbol } from './normalize.js';
import { getMarketSession } from './marketSession.js';
import type { MarketDataProvider } from './provider.js';

/**
 * 新浪美股行情（hq.sinajs.cn）——腾讯解析失败时的兜底源，免 key。
 * 字段为逗号分隔，索引映射经真实响应验证：
 *   0 中文名  1 现价  2 涨跌幅%  3 时间(北京)  4 涨跌额  5 今开  6 最高  7 最低
 *   8 52周高  9 52周低  10 成交量  12 总市值(USD)  19 总股本(股)
 *   21 盘后价  22 盘后涨跌额  23 盘后涨跌幅%  26 昨收
 */
export function parseSinaQuote(raw: string, symbol: string): MarketQuote | null {
  const m = raw.match(/="(.*)"\s*;?\s*$/);
  if (!m) throw new MarketDataError('unexpected response shape', 'sina', 'parse');
  const body = m[1];
  if (!body) throw new MarketDataError('unexpected response shape', 'sina', 'parse');
  const fields = body.split(',');
  const num = (i: number): number | undefined => {
    const v = fields[i];
    if (v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const price = num(1);
  if (price === undefined || price <= 0) return null;

  const prevClose = num(26) ?? price;
  const change = num(4) ?? price - prevClose;
  const changePct = num(2) ?? (prevClose > 0 ? (price / prevClose - 1) * 100 : 0);
  const afterHours = num(21);
  const afterHoursChangePct = num(23);

  return {
    symbol,
    code: `${symbol}.US`,
    name: fields[0] || symbol,
    price,
    change,
    changePct,
    open: num(5) ?? price,
    high: num(6) ?? price,
    low: num(7) ?? price,
    prevClose,
    volume: num(10) ?? 0,
    currency: 'USD',
    quoteTime: fields[3] || '',
    marketCap: num(12),
    week52High: num(8),
    week52Low: num(9),
    sharesOutstanding: num(19),
    afterHoursPrice: afterHours,
    afterHoursChangePct,
    session: getMarketSession(),
  };
}

export class SinaProvider implements MarketDataProvider {
  readonly name = 'sina';
  private readonly decoder = new TextDecoder('gbk');

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    const norm = normalizeSymbol(symbol);
    if (!norm) throw new MarketDataError(`invalid symbol: ${symbol}`, 'sina', 'invalid_symbol');

    const res = await fetch(`https://hq.sinajs.cn/list=${norm.sina}`, {
      headers: { Referer: 'https://finance.sina.com.cn' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new MarketDataError(`HTTP ${res.status}`, 'sina', 'network');
    const text = this.decoder.decode(await res.arrayBuffer());
    return parseSinaQuote(text, norm.symbol);
  }
}
