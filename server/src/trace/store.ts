import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgentTrace, TraceFeedback } from './types.js';

export interface TraceQuery {
  sessionId?: string;
  outcome?: 'ok' | 'error';
  limit?: number;
  offset?: number;
}

/**
 * Trace 持久化：JSONL 追加日志（一行一条）。file 为 null 时仅内存（测试/默认隔离），
 * 生产在 index.ts 注入 `server/.data/traces.jsonl`。
 */
export class TraceStore {
  constructor(private readonly file: string | null) {}

  append(trace: AgentTrace): void {
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      appendFileSync(this.file, JSON.stringify(trace) + '\n', 'utf8');
    } catch (err) {
      console.warn('[traces] append failed:', (err as Error).message);
    }
  }

  list(query: TraceQuery = {}): AgentTrace[] {
    const all = this.readAll().filter(
      (t) =>
        (!query.sessionId || t.sessionId === query.sessionId) &&
        (!query.outcome || t.outcome === query.outcome),
    );
    all.sort((a, b) => b.startedAt - a.startedAt); // 新的在前
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return all.slice(offset, offset + limit);
  }

  get(id: string): AgentTrace | undefined {
    return this.readAll().find((t) => t.id === id);
  }

  setFeedback(id: string, feedback: TraceFeedback): boolean {
    if (!this.file) return false;
    const all = this.readAll();
    const idx = all.findIndex((t) => t.id === id);
    if (idx < 0) return false;
    all[idx] = { ...all[idx]!, feedback };
    try {
      writeFileSync(this.file, all.map((t) => JSON.stringify(t)).join('\n') + '\n', 'utf8');
      return true;
    } catch (err) {
      console.warn('[traces] feedback failed:', (err as Error).message);
      return false;
    }
  }

  private readAll(): AgentTrace[] {
    if (!this.file) return [];
    try {
      const text = readFileSync(this.file, 'utf8');
      return text
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as AgentTrace);
    } catch {
      return [];
    }
  }
}
