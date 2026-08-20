import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { collectLowRatingTraces, loadBadCases, mergeBadCases, readBadCases } from '../badcases.js';
import type { AgentTrace } from '../../trace/types.js';

const dirs: string[] = [];
function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'fa-bc-'));
  dirs.push(dir);
  return join(dir, 'bad-cases.jsonl');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function trace(id: string, message: string, feedback?: { rating: number; reasons?: string[]; reason?: string }): AgentTrace {
  return {
    id,
    sessionId: 's',
    userMessage: message,
    startedAt: 0,
    endedAt: 1000,
    totalMs: 1000,
    turns: [],
    outcome: 'ok',
    feedback,
  };
}

describe('bad case 吸收与导出', () => {
  it('loadBadCases：从诚实数据派生用例，去重 + 上限', () => {
    const f = tempFile();
    const lines = [
      JSON.stringify({ caseId: 'a', ts: '', trace: trace('t1', '茅台现在多少钱？') }),
      JSON.stringify({ caseId: 'b', ts: '', trace: trace('t2', '茅台现在多少钱？') }), // 重复消息
      JSON.stringify({ caseId: 'c', ts: '', trace: trace('t3', '平安银行PE？') }),
    ].join('\n') + '\n';
    writeFileSync(f, lines, 'utf8');
    const cases = loadBadCases(f, 10);
    expect(cases).toHaveLength(2); // 去重后
    expect(cases[0]!.message).toBe('茅台现在多少钱？');
    expect(cases[0]!.id).toContain('bad-');
  });

  it('collectLowRatingTraces：≤2 必收、3 分需带原因、高分不收', () => {
    const tracesFile = join(tmpdir(), `${Date.now()}-traces.jsonl`);
    const lines = [
      JSON.stringify(trace('t1', 'q1', { rating: 1 })), // 必收
      JSON.stringify(trace('t2', 'q2', { rating: 2, reasons: ['数字错误'] })), // 必收
      JSON.stringify(trace('t3', 'q3', { rating: 3, reasons: ['答非所问'] })), // 3分带原因 → 收
      JSON.stringify(trace('t4', 'q4', { rating: 3 })), // 3分无原因 → 不收
      JSON.stringify(trace('t5', 'q5', { rating: 5 })), // 高分 → 不收
    ].join('\n') + '\n';
    writeFileSync(tracesFile, lines, 'utf8');
    const got = collectLowRatingTraces(tracesFile, 3);
    expect(got.map((b) => b.trace.id)).toEqual(['t1', 't2', 't3']);
  });

  it('mergeBadCases：按 trace.id 去重追加', () => {
    const f = tempFile();
    mergeBadCases(f, [{ caseId: 'x', ts: '', trace: trace('t1', 'q1', { rating: 1 }) }]);
    expect(readBadCases(f)).toHaveLength(1);
    // 重复 id 不重复加
    const added = mergeBadCases(f, [{ caseId: 'y', ts: '', trace: trace('t1', 'q1', { rating: 1 }) }]);
    expect(added).toBe(0);
    expect(readBadCases(f)).toHaveLength(1);
  });
});
