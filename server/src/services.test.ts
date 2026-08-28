import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { createServices } from './services.js';
import { FileStore } from './store.js';
import { TraceStore } from './trace/store.js';
import { CompositeProvider } from './eval/market/composite.js';
import { ModelManager } from './agent/models.js';
import { SessionStore } from './agent/sessions.js';
import { parseTencentAshareQuote } from './eval/market/tencent.js';
import { readFileSync } from 'node:fs';
import type { TencentProvider } from './eval/market/tencent.js';
import type { SinaProvider } from './eval/market/sina.js';
import type { AgentTrace } from './trace/types.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'fa-svc-'));
  dirs.push(d);
  return d;
}

const fixture = (name: string) => readFileSync(new URL(`./eval/market/__tests__/fixtures/${name}`, import.meta.url), 'utf8');
const quoteLine = (code: string) =>
  fixture('tencent.ashare.quote.txt').split('\n').find((l) => l.startsWith(`v_${code}=`))!;

function stubMarket(): CompositeProvider {
  const tencent = {
    name: 'tencent',
    getQuote: async () => parseTencentAshareQuote(quoteLine('sh600519'), '600519')!,
    getKline: async () => [],
  } as unknown as TencentProvider;
  const sina = { name: 'sina', getQuote: async () => null } as unknown as SinaProvider;
  return new CompositeProvider({}, { tencent, sina });
}

function makeTrace(id: string): AgentTrace {
  return { id, sessionId: 's', userMessage: 'q', startedAt: 0, endedAt: 1, totalMs: 1, turns: [], outcome: 'ok' };
}

describe('createServices（传输无关业务组合根，无 Express）', () => {
  it('默认组合各组件就位', () => {
    const s = createServices();
    expect(s.store).toBeInstanceOf(FileStore);
    expect(s.traces).toBeInstanceOf(TraceStore);
    expect(s.market).toBeInstanceOf(CompositeProvider);
    expect(s.models).toBeInstanceOf(ModelManager);
    expect(s.sessions).toBeInstanceOf(SessionStore);
  });

  it('注入桩可直接用业务层（不经 HTTP）', async () => {
    const s = createServices({ market: stubMarket() });
    const q = await s.market.getQuote('600519');
    expect(q).not.toBeNull();
    expect(q!.name).toBe('贵州茅台');
    expect(q!.price).toBeGreaterThan(0);
  });

  it('注入 dataFile/traceFile 后持久化落盘（供 Electron userData 复用）', () => {
    const dir = tempDir();
    const s = createServices({
      dataFile: join(dir, 'app-state.json'),
      traceFile: join(dir, 'traces.jsonl'),
    });
    s.store.setWatchlist(['600519', '000001']);
    s.traces.append(makeTrace('t1'));
    expect(s.store.getWatchlist()).toEqual(['600519', '000001']);
    expect(s.traces.get('t1')?.id).toBe('t1');
  });

  it('注入 store 时 models/sessions 自动接线到同一 store', () => {
    const dir = tempDir();
    const store = new FileStore(join(dir, 'app.json'));
    store.setModelConfig({ provider: 'custom-openai', baseUrl: 'http://x', model: 'm', apiKey: 'k' });
    const s = createServices({ store });
    expect(s.models.configured()).toBe(true); // 复用传入 store 的模型配置
    expect(s.sessions.list()).toEqual([]); // 同一 store，会话空
  });
});