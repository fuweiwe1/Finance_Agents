/**
 * 通用 TTL 缓存 + single-flight：
 * - 命中期内返回缓存值；
 * - 并发请求同一 key 只触发一次加载（single-flight）；
 * - 加载抛错不缓存、清空 inflight，下次调用重试。
 */
export class TTLCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  private inflight = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const run = (async () => {
      const value = await load();
      if (value !== null && value !== undefined) {
        this.store.set(key, { value, expires: Date.now() + this.ttlMs });
      }
      return value;
    })();
    // 用 finally 包装的 promise 作为唯一被 await 的对象，避免孤儿 rejected promise 触发 unhandled rejection
    const tracked = run.finally(() => this.inflight.delete(key));
    this.inflight.set(key, tracked);
    return tracked;
  }

  invalidate(key?: string): void {
    if (key === undefined) {
      this.store.clear();
      this.inflight.clear();
      return;
    }
    this.store.delete(key);
    this.inflight.delete(key);
  }
}
