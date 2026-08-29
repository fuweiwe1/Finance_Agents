/**
 * A 股交易日判定：远程日历接口 + 兜底。
 * 优先 timor.tech 年度假节日历（区分法定假日与调休上班日——
 * 周末若为「调休上班」(holiday=false) 视为交易日）；失败降级 bitefu 单日接口；再失败按周一至周五。
 * 所有失败路径都 pass 而非 fail（宁可周五跑，不能周一漏发），但返回稳定性提示。
 *
 * CI/本机 timor 可能不可达 → 由调用方用 `hasTradingBarOnDate` 做行情核验
 * （收盘后当天若无日 K bar → 非交易日，节假日/周末正确跳过）。
 */
import type { CompositeProvider } from '../eval/market/composite.js';

export interface TradingDayResult {
  isTradingDay: boolean;
  source: 'timor' | 'bitefu' | 'weekday-fallback';
}

const TIMOR_TIMEOUT_MS = 6000;
const BITEFU_TIMEOUT_MS = 5000;

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

interface HostOptions {
  fetchImpl?: typeof fetch;
}

async function viaTimor(date: Date, fetchImpl: typeof fetch): Promise<boolean | null> {
  const res = await fetchImpl(`https://timor.tech/api/holiday/year/${date.getFullYear()}`, {
    signal: AbortSignal.timeout(TIMOR_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    code?: number;
    holiday?: Record<string, { holiday?: boolean; name?: string } | undefined>;
  };
  if (json?.holiday == null) return null;
  const entry = json.holiday[ymd(date)];
  if (entry === undefined) return null; // 无记录：交给调用方按周末/兜底处理
  return entry.holiday !== true; // holiday:true → 假停止；false（调休上班）→ 交易日
}

async function viaBitefu(date: Date, fetchImpl: typeof fetch): Promise<boolean | null> {
  const res = await fetchImpl(`https://tool.bitefu.net/jiari/?d=${ymd(date)}`, {
    signal: AbortSignal.timeout(BITEFU_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const txt = await res.text();
  try {
    const parsed = JSON.parse(txt) as { workday?: unknown };
    const w = parsed?.workday;
    // 只认明确的「工作=1」；「0」不许用于断言非交易日（宁漏勿误跳），返回 null 交给兜底
    if (typeof w === 'number' && w === 1) return true;
    if (w === true) return true;
  } catch {
    /* 非 JSON 响应（如裸 "0"）→ 未知 */
  }
  return null;
}

export async function isTradingDay(date: Date, opts: HostOptions = {}): Promise<TradingDayResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;

  // 先试权威节假日接口（含调休语义）
  try {
    const r = await viaTimor(date, fetchImpl);
    if (r !== null) return { isTradingDay: r, source: 'timor' };
  } catch {
    /* fallthrough */
  }

  // 再试单日接口
  try {
    const r = await viaBitefu(date, fetchImpl);
    if (r !== null) return { isTradingDay: r, source: 'bitefu' };
  } catch {
    /* fallthrough */
  }

  return { isTradingDay: !isWeekend(date), source: 'weekday-fallback' };
}

/** 收盘后核验：当天是否存在日 K bar（有 → 交易日；节假日/周末无 bar → 非交易日）。 */
export async function hasTradingBarOnDate(
  date: Date,
  market: Pick<CompositeProvider, 'getKline'>,
  opts: { symbol?: string } = {},
): Promise<boolean> {
  try {
    const bars = await market.getKline(opts.symbol ?? '600519', 'day', 5);
    if (!bars.length) return true; // 行情取不到，按工作日放行
    const last = bars[bars.length - 1]!;
    const barYmd = new Date(last.ts * 1000).toISOString().slice(0, 10); // 腾讯日K以 UTC 零点存，即交易日标签
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return barYmd === `${y}-${m}-${d}`;
  } catch {
    return true; // 网络异常时按工作日放行（宁漏勿误跳）
  }
}