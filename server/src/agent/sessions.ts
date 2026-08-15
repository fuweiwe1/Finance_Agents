import type { FileStore } from '../store.js';
import type { ModelManager } from './models.js';
import type { CompositeProvider } from '../market/composite.js';
import { SessionAgent } from './sessionAgent.js';

export interface SessionMeta {
  id: string;
  title: string;
  msgCount: number;
  createdAt: string;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** 会话内存存储 + 每会话 Agent 生命周期管理（模型配置变更时整体失效）；元数据可持久化 */
export class SessionStore {
  private sessions = new Map<string, SessionMeta>();
  private agents = new Map<string, SessionAgent>();

  constructor(private readonly store?: FileStore) {
    for (const m of store?.getSessions() ?? []) this.sessions.set(m.id, m);
  }

  create(title = 'New Session'): SessionMeta {
    const meta: SessionMeta = {
      id: genId(),
      title,
      msgCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(meta.id, meta);
    this.persist();
    return meta;
  }

  list(): SessionMeta[] {
    return [...this.sessions.values()];
  }

  get(id: string): SessionMeta | undefined {
    return this.sessions.get(id);
  }

  delete(id: string): boolean {
    this.agents.delete(id);
    const ok = this.sessions.delete(id);
    if (ok) this.persist();
    return ok;
  }

  bumpMsgCount(id: string): void {
    const s = this.sessions.get(id);
    if (s) {
      s.msgCount += 1;
      this.persist();
    }
  }

  agent(id: string, models: ModelManager, market: CompositeProvider): SessionAgent {
    let a = this.agents.get(id);
    if (!a) {
      a = new SessionAgent(models, market);
      this.agents.set(id, a);
    }
    return a;
  }

  /** 模型配置变更时调用：丢弃所有会话 Agent，下次请求用新模型重建 */
  invalidateAgents(): void {
    this.agents.clear();
  }

  private persist(): void {
    this.store?.setSessions([...this.sessions.values()]);
  }
}
