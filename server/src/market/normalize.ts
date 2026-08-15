/**
 * 股票代码归一化：把各种用户输入（tsla / TSLA / TSLA.US / TSLA.OQ / TSLA.NASDAQ / usTSLA）
 * 统一成内部 symbol + 各 Provider 需要的代码形式。
 */

export interface NormalizedSymbol {
  symbol: string; // "TSLA"
  code: string; // "TSLA.US"
  tencent: string; // "usTSLA"
  sina: string; // "gb_tsla"
}

const EXCHANGE_SUFFIX = /\.(US|NASDAQ|NYSE|OQ|N|A|B)$/i;
const TICKER = /^[A-Z][A-Z0-9.-]{0,9}$/i;

export function normalizeSymbol(input: string): NormalizedSymbol | null {
  let s = input.trim();
  if (!s) return null;

  // 腾讯格式的 "usTSLA"/"usaapl"（小写 us 前缀）→ 剥成 "TSLA"。
  // 大小写敏感：真实美股 ticker 如 "USEG"（U.S. Energy）是大写 US 开头，不能剥。
  if (s.startsWith('us') && s.slice(2).match(TICKER)) {
    s = s.slice(2);
  }
  s = s.replace(EXCHANGE_SUFFIX, '');
  const symbol = s.toUpperCase();
  if (!TICKER.test(symbol)) return null;
  if (!/^[A-Z]{1,5}$/.test(symbol)) return null; // 美股 ticker 1-5 位字母

  return {
    symbol,
    code: `${symbol}.US`,
    tencent: `us${symbol}`,
    sina: `gb_${symbol.toLowerCase()}`,
  };
}

/** 判断是否合法的美股代码（用于前端搜索/添加前的快速校验） */
export function isValidSymbol(input: string): boolean {
  return normalizeSymbol(input) !== null;
}
