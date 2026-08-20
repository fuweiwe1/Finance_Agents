import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgentTrace } from '../trace/types.js';
import type { EvalCase } from './cases.js';

export interface BadCaseEntry {
  caseId: string;
  ts: string;
  trace: AgentTrace;
}

export function readBadCases(file: string): BadCaseEntry[] {
  try {
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as BadCaseEntry);
  } catch {
    return [];
  }
}

/** 从 bad-cases.jsonl 派生待考用例（按消息去重 + 上限），供 eval 吸收 */
export function loadBadCases(file: string, cap = 15): EvalCase[] {
  const seen = new Set<string>();
  const cases: EvalCase[] = [];
  for (const b of readBadCases(file)) {
    const msg = (b.trace.userMessage ?? '').trim();
    if (!msg || seen.has(msg)) continue;
    seen.add(msg);
    cases.push({
      id: `bad-${b.trace.sessionId || 'x'}-${b.trace.id}`,
      message: msg,
      context: b.trace.context,
      // 历史坑的轻量检查：必须正常完成 + 含免责 + 不得出现"仅支持美股"式拒绝
      mustInclude: [/不构成投资建议/],
      expectNot: [/仅支持美股|不支持A股|无法查询A股/],
    });
    if (cases.length >= cap) break;
  }
  return cases;
}

/**
 * 从 traces.jsonl 筛低分反馈，转成待合并的 bad case 条目。
 * 判定：评分 ≤ minRating，且 1-2 分必收（不需原因）、3 分起需带原因/标签。
 */
export function collectLowRatingTraces(tracesFile: string, minRating = 3): BadCaseEntry[] {
  const entries: BadCaseEntry[] = [];
  for (const t of readTraces(tracesFile)) {
    const fb = t.feedback;
    if (!fb || fb.rating === undefined) continue;
    const lowEnough = fb.rating <= minRating;
    const hasReason = Boolean(fb.reason?.trim() || (fb.reasons && fb.reasons.length));
    if (lowEnough && (fb.rating <= 2 || hasReason)) {
      entries.push({
        caseId: `user-${t.sessionId}-${t.id}`,
        ts: new Date(t.endedAt || t.startedAt || Date.now()).toISOString(),
        trace: t,
      });
    }
  }
  return entries;
}

/** 合并进 bad-cases.jsonl：按 trace.id 去重、追加；返回新增条数 */
export function mergeBadCases(badFile: string, newEntries: BadCaseEntry[]): number {
  if (!newEntries.length) return 0;
  const existingIds = new Set(readBadCases(badFile).map((b) => b.trace.id));
  const toAdd = newEntries.filter((b) => !existingIds.has(b.trace.id));
  if (!toAdd.length) return 0;
  try {
    mkdirSync(dirname(badFile), { recursive: true });
    appendFileSync(badFile, toAdd.map((b) => JSON.stringify(b)).join('\n') + '\n', 'utf8');
  } catch (err) {
    console.warn('[badcases] merge failed:', (err as Error).message);
    return 0;
  }
  return toAdd.length;
}

function readTraces(tracesFile: string): AgentTrace[] {
  try {
    return readFileSync(tracesFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AgentTrace);
  } catch {
    return [];
  }
}