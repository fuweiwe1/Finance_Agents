import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { TraceStore } from '../trace/store.js';
import type { AgentTrace } from '../trace/types.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeTrace(id: string, startedAt: number): AgentTrace {
  return { id, sessionId: 's', userMessage: 'q', startedAt, endedAt: startedAt + 100, totalMs: 100, turns: [], outcome: 'ok' };
}

function tempStore(): TraceStore {
  const dir = mkdtempSync(join(tmpdir(), 'fa-tr-'));
  dirs.push(dir);
  return new TraceStore(join(dir, 'traces.jsonl'));
}

describe('Traces API', () => {
  it('list（新的在前）/ get / feedback', async () => {
    const store = tempStore();
    store.append(makeTrace('a', 1000));
    store.append(makeTrace('b', 2000));
    const app = createApp({ traces: store });

    const list = await request(app).get('/api/traces');
    expect(list.status).toBe(200);
    expect(list.body.map((t: { id: string }) => t.id)).toEqual(['b', 'a']);

    const one = await request(app).get('/api/traces/a');
    expect(one.status).toBe(200);
    expect(one.body.id).toBe('a');

    const fb = await request(app).post('/api/traces/a/feedback').send({ rating: 1, reason: '幻觉' });
    expect(fb.status).toBe(200);
    expect(fb.body.ok).toBe(true);
    expect(store.get('a')?.feedback?.rating).toBe(1);

    const missing = await request(app).post('/api/traces/x/feedback').send({ rating: 1 });
    expect(missing.status).toBe(404);

    const bad = await request(app).post('/api/traces/a/feedback').send({ rating: 9 });
    expect(bad.status).toBe(400);
  });

  it('过滤 outcome + sessionId + 分页', async () => {
    const store = tempStore();
    store.append({ ...makeTrace('ok1', 1000), sessionId: 's1', outcome: 'ok' });
    store.append({ ...makeTrace('err1', 2000), sessionId: 's2', outcome: 'error' });
    const app = createApp({ traces: store });

    const errs = await request(app).get('/api/traces').query({ outcome: 'error' });
    expect(errs.body.map((t: { id: string }) => t.id)).toEqual(['err1']);

    const bySession = await request(app).get('/api/traces').query({ sessionId: 's1' });
    expect(bySession.body.map((t: { id: string }) => t.id)).toEqual(['ok1']);
  });
});
