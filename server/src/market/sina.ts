import { MarketDataError, type MarketQuote } from './types.js';
import { normalizeSymbol } from './normalize.js';
import { getMarketSession } from './marketSession.js';
import type { MarketDataProvider } from './provider.js';

/**
 * 新浪 A 股行情（hq.sinajs.cn）——腾讯失败时的兜底源，免 key。
 * 字段为逗号分隔，索引映射经 sh600519 真实响应验证：
 *   0 名称  1 今开  2 昨收  3 现价  4 最高  5 最低
 *   8 成交量(股)  9 成交额(元)  30 日期  31 时间
 */
export function parseSinaAshareQuote(raw: string, symbol: string): MarketQuote | null {
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

  const price = num(3);
  if (price === undefined || price <= 0) return null;

  const prevClose = num(2) ?? price;
  const change = price - prevClose;
  const changePct = prevClose > 0 ? (price / prevClose - 1) * 100 : 0;

  return {
    symbol,
    code: `${symbol}`,
    name: fields[0] || symbol,
    price,
    change,
    changePct,
    open: num(1) ?? price,
    high: num(4) ?? price,
    low: num(5) ?? price,
    prevClose,
    volume: num(8) ?? 0, // 股
    currency: 'CNY',
    quoteTime: fields[30] && fields[31] ? `${fields[30]} ${fields[31]}` : '',
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
    return parseSinaAshareQuote(text, norm.symbol);
  }
}
