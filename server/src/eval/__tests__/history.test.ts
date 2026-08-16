import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { appendRun, compareWithPrevious, readRuns, type EvalRunSummary } from '../history.js';

const dirs: string[] = [];
function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'fa-eval-h-'));
  dirs.push(dir);
  return join(dir, 'eval-history.jsonl');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeRun(over: Partial<EvalRunSummary>): EvalRunSummary {
  return {
    ts: '2026-08-16T00:00:00.000Z',
    model: 'deepseek-v4-flash',
    total: 5,
    passed: 5,
    avgLatencyMs: 5000,
    totalTokensIn: 1000,
    totalTokensOut: 800,
    totalCost: 0.01,
    perCase: [
      { caseId: 'a', pass: true, latencyMs: 4000 },
      { caseId: 'b', pass: true, latencyMs: 6000 },
    ],
    ...over,
  };
}

describe('eval 历史（EvalRunSummary）', () => {
  it('appendRun 后 readRuns 可读回', () => {
    const f = tempFile();
    appendRun(f, makeRun({}));
    appendRun(f, makeRun({ ts: '2026-08-16T01:00:00.000Z' }));
    const runs = readRuns(f);
    expect(runs).toHaveLength(2);
    expect(runs[1]!.ts).toContain('01:00');
    expect(existsSync(f)).toBe(true);
  });

  it('损坏/不存在文件返回空', () => {
    expect(readRuns(join(tmpdir(), 'missing-eval-history.jsonl'))).toEqual([]);
  });

  it('compareWithPrevious：pass/耗时/成本变化 + 回归/改善', () => {
    const prev = makeRun({
      passed: 4,
      avgLatencyMs: 6000,
      totalCost: 0.02,
      perCase: [
        { caseId: 'a', pass: true, latencyMs: 4000 },
        { caseId: 'b', pass: false, latencyMs: 6000 },
      ],
    });
    const cur = makeRun({
      passed: 4,
      avgLatencyMs: 5000,
      totalCost: 0.01,
      perCase: [
        { caseId: 'a', pass: false, latencyMs: 4000 }, // 回归
        { caseId: 'b', pass: true, latencyMs: 6000 }, // 改善
      ],
    });
    const cmp = compareWithPrevious(cur, prev);
    expect(cmp.passDelta).toBe(0);
    expect(cmp.latencyDeltaMs).toBe(-1000); // 更快
    expect(cmp.costDelta).toBe(-0.01);
    expect(cmp.regressed).toEqual(['a']);
    expect(cmp.improved).toEqual(['b']);
  });
});
