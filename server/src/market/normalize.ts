/**
 * A 股代码归一化：把用户输入（600519 / sh600519 / 贵州茅台的数字代码）统一成
 * symbol + 各 Provider 需要的代码形式。仅支持沪深北 A 股。
 */

export type Exchange = 'sh' | 'sz' | 'bj';

export interface NormalizedSymbol {
  symbol: string; // '600519'
  code: string; // 'sh600519'（交易所限定，腾讯/新浪同用）
  tencent: string; // 'sh600519'
  sina: string; // 'sh600519'
  exchange: Exchange;
}

const EXCHANGE_PREFIX = /^(sh|sz|bj)/;
const CODE = /^[0-9]{6}$/;

function exchangeOf(code: string): Exchange | null {
  if (/^(60|68|900)/.test(code)) return 'sh'; // 沪主板/科创板/B股
  if (/^(00|30|20)/.test(code)) return 'sz'; // 深主板/创业板/B股
  if (/^(43|83|87|88|92)/.test(code)) return 'bj'; // 北交所
  return null;
}

export const EXCHANGE_LABEL: Record<Exchange, string> = { sh: '沪', sz: '深', bj: '北' };

export function normalizeSymbol(input: string): NormalizedSymbol | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;

  let exchange: Exchange | null = null;
  if (EXCHANGE_PREFIX.test(s)) {
    const prefix = s.slice(0, 2);
    if (prefix === 'sh' || prefix === 'sz' || prefix === 'bj') {
      exchange = prefix;
      s = s.slice(2);
    }
  }

  if (!CODE.test(s)) return null;
  exchange = exchange ?? exchangeOf(s);
  if (!exchange) return null;

  const code = `${exchange}${s}`;
  return { symbol: s, code, tencent: code, sina: code, exchange };
}

export function isValidSymbol(input: string): boolean {
  return normalizeSymbol(input) !== null;
}
