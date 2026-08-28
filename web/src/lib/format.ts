/** 数字/百分比/市值/股本/成交量格式化（缺失统一显示 —） */

export function fmtPrice(n?: number | null, digits = 2): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(n?: number | null, withSign = true): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  const sign = withSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtCap(n?: number | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

export function fmtShares(n?: number | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString('en-US');
}

export function fmtVolume(n?: number | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

/** A 股成交量（股 → 万手）：1万手 = 100万股 */
export function fmtVolumeCn(shares?: number | null): string {
  if (shares === undefined || shares === null || !Number.isFinite(shares) || shares <= 0) return '—';
  const wanLots = shares / 1e6; // 股 → 万手
  if (wanLots >= 1e4) return `${(wanLots / 1e4).toFixed(2)}亿手`;
  return `${wanLots.toFixed(2)}万手`;
}

/** 市场市值（元 → 亿/万亿） */
export function fmtCapCn(yuan?: number | null): string {
  if (yuan === undefined || yuan === null || !Number.isFinite(yuan)) return '—';
  if (yuan >= 1e12) return `${(yuan / 1e12).toFixed(2)}万亿`;
  if (yuan >= 1e8) return `${(yuan / 1e8).toFixed(2)}亿`;
  return `${(yuan / 1e4).toFixed(0)}万`;
}

/** 由交易所代码(如 sh600519)得出沪/深/北标签 */
export function exchangeLabel(code?: string): string {
  if (!code) return '';
  const p = code.slice(0, 2);
  if (p === 'sh') return '沪';
  if (p === 'sz') return '深';
  if (p === 'bj') return '北';
  return '';
}

export function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** unix 毫秒时间戳 → "MM-DD HH:mm:ss" */
export function fmtTs(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const SESSION_LABEL: Record<string, string> = {
  pre: '集合竞价',
  regular: '交易中',
  post: '盘后',
  closed: '已收盘',
};

/** 涨跌颜色：涨红跌绿（A股习惯） */
export function trendColor(n?: number | null): string {
  if (n === undefined || n === null || !Number.isFinite(n) || n === 0) return 'text-ink-soft';
  return n > 0 ? 'text-up' : 'text-down';
}
