import { FileStore } from './store.js';
import { TraceStore } from './trace/store.js';
import { CompositeProvider } from './eval/market/composite.js';
import { ModelManager } from './agent/models.js';
import { SessionStore } from './agent/sessions.js';

/**
 * 传输无关的业务服务组合根：Express 路由 与 Electron 主进程 IPC 都可复用。
 * market / agent / trace / store 全部在这里实例化并接线，HTTP 层与桌面层只是薄适配。
 */
export interface Services {
  store: FileStore;
  traces: TraceStore;
  market: CompositeProvider;
  models: ModelManager;
  sessions: SessionStore;
}

/** 部分注入：缺省项用内存隔离的默认实现（测试友好）；dataFile/traceFile 用于生产持久化 */
export interface ServicesOptions {
  store?: FileStore;
  traces?: TraceStore;
  market?: CompositeProvider;
  models?: ModelManager;
  sessions?: SessionStore;
  dataFile?: string | null;
  traceFile?: string | null;
}

export function createServices(opts: ServicesOptions = {}): Services {
  const store = opts.store ?? new FileStore(opts.dataFile ?? null);
  const traces = opts.traces ?? new TraceStore(opts.traceFile ?? null);
  const market = opts.market ?? new CompositeProvider();
  const models = opts.models ?? new ModelManager({ store });
  const sessions = opts.sessions ?? new SessionStore(store);
  return { store, traces, market, models, sessions };
}