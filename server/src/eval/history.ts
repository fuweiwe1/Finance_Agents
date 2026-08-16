import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface CaseResult {
  caseId: string;
  pass: boolean;
  latencyMs: number;
}

export interface EvalRunSummary {
  ts: string;
  model: string;
  total: number;
  passed: number;
  avgLatencyMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  perCase: CaseResult[];
}

export interface RunComparison {
  passDelta: number;
  latencyDeltaMs: number;
  costDelta: number;
  regressed: string[]; // 上次通过这次失败
  improved: string[]; // 上次失败这次通过
}

export function appendRun(file: string, summary: EvalRunSummary): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, JSON.stringify(summary) + '\n', 'utf8');
  } catch (err) {
    console.warn('[eval-history] append failed:', (err as Error).message);
  }
}

export function readRuns(file: string): EvalRunSummary[] {
  try {
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as EvalRunSummary);
  } catch {
    return [];
  }
}

/** 与上一次运行对比：pass/耗时/成本变化 + 回归/改善用例（纯函数，可测） */
export function compareWithPrevious(cur: EvalRunSummary, prev: EvalRunSummary): RunComparison {
  return {
    passDelta: cur.passed - prev.passed,
    latencyDeltaMs: cur.avgLatencyMs - prev.avgLatencyMs,
    costDelta: cur.totalCost - prev.totalCost,
    regressed: cur.perCase
      .filter((c) => !c.pass && prev.perCase.find((p) => p.caseId === c.caseId)?.pass)
      .map((c) => c.caseId),
    improved: cur.perCase
      .filter((c) => c.pass && prev.perCase.find((p) => p.caseId === c.caseId)?.pass === false)
      .map((c) => c.caseId),
  };
}
