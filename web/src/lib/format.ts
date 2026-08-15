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

export const SESSION_LABEL: Record<string, string> = {
  pre: 'Pre-Market',
  regular: 'Regular Market',
  post: 'Post-Market',
  closed: 'Closed',
};

/** 涨跌颜色：涨红跌绿（A股习惯） */
export function trendColor(n?: number | null): string {
  if (n === undefined || n === null || !Number.isFinite(n) || n === 0) return 'text-slate-600';
  return n > 0 ? 'text-red-600' : 'text-emerald-600';
}
