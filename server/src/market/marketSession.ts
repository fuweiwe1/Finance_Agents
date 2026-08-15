import type { MarketSession } from './types.js';

const NY_TZ = 'America/New_York';

/**
 * 按美东时间判断当前市场时段。
 * 常规 9:30-16:00，盘前 4:00-9:30，盘后 16:00-20:00，其余为收盘。
 * 注：未处理美股节假日（节日可能被当作普通工作日），属可接受的近似。
 */
export function getMarketSession(now: Date = new Date()): MarketSession {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = get('weekday');
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));

  if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return 'regular';
  if (minutes >= 16 * 60 && minutes < 20 * 60) return 'post';
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return 'pre';
  return 'closed';
}

export const SESSION_LABEL: Record<MarketSession, string> = {
  pre: 'Pre-Market',
  regular: 'Regular Market',
  post: 'Post-Market',
  closed: 'Closed',
};
