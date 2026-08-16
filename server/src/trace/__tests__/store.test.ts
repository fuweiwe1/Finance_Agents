import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { TraceStore } from '../store.js';
import type { AgentTrace } from '../types.js';

const dirs: string[] = [];
function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'fa-trace-'));
  dirs.push(dir);
  return join(dir, 'traces.jsonl');
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeTrace(id: string, startedAt: number): AgentTrace {
  return { id, sessionId: 's', userMessage: 'q', startedAt, endedAt: startedAt + 100, totalMs: 100, turns: [], outcome: 'ok' };
}

describe('TraceStore（JSONL）', () => {
  it('append 后 list/get 可读，新的在前', () => {
    const f = tempFile();
    const s = new TraceStore(f);
    s.append(makeTrace('a', 1000));
    s.append(makeTrace('b', 2000));
    expect(s.list().map((t) => t.id)).toEqual(['b', 'a']);
    expect(s.get('a')?.id).toBe('a');
    expect(s.get('missing')).toBeUndefined();
    expect(existsSync(f)).toBe(true);
  });

  it('按 session/outcome 过滤 + 分页', () => {
    const f = tempFile();
    const s = new TraceStore(f);
    s.append({ ...makeTrace('a', 1000), sessionId: 's1', outcome: 'ok' });
    s.append({ ...makeTrace('b', 2000), sessionId: 's2', outcome: 'error' });
    expect(s.list({ sessionId: 's1' })).toHaveLength(1);
    expect(s.list({ outcome: 'error' })[0]!.id).toBe('b');
    expect(s.list({ limit: 1 })).toHaveLength(1);
  });

  it('setFeedback 写回文件', () => {
    const f = tempFile();
    const s = new TraceStore(f);
    s.append(makeTrace('a', 1000));
    expect(s.setFeedback('a', { rating: 1, reason: '错' })).toBe(true);
    const s2 = new TraceStore(f);
    expect(s2.get('a')?.feedback).toEqual({ rating: 1, reason: '错' });
    expect(s.setFeedback('x', { rating: 1 })).toBe(false);
  });

  it('file 为 null（测试隔离）不写盘', () => {
    const s = new TraceStore(null);
    s.append(makeTrace('a', 1));
    expect(s.list()).toEqual([]);
  });
});
