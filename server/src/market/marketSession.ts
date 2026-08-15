import type { MarketSession } from './types.js';

const CN_TZ = 'Asia/Shanghai';

/**
 * 按北京时间判断 A 股市场时段。
 * 集合竞价 9:15-9:30（盘前），连续竞价 9:30-11:30 / 13:00-15:00，其余收盘。
 * 注：未处理节假日，属可接受的近似。
 */
export function getMarketSession(now: Date = new Date()): MarketSession {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CN_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = get('weekday');
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));

  if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
  if (minutes >= 9 * 60 + 15 && minutes < 9 * 60 + 30) return 'pre'; // 集合竞价
  if ((minutes >= 9 * 60 + 30 && minutes < 11 * 60 + 30) || (minutes >= 13 * 60 && minutes < 15 * 60)) {
    return 'regular';
  }
  return 'closed';
}

export const SESSION_LABEL: Record<MarketSession, string> = {
  pre: '集合竞价',
  regular: '交易中',
  post: '盘后',
  closed: '已收盘',
};
