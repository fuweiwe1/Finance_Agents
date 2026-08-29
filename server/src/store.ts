import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ModelConfig } from './agent/models.js';
import type { SessionMeta } from './agent/sessions.js';
import type { ReportSettings } from './report/settings.js';

export interface PersistedState {
  watchlist?: string[];
  sessions?: SessionMeta[];
  modelConfig?: ModelConfig;
  reportSettings?: ReportSettings;
}

/**
 * 服务端 JSON 文件持久化（小数据量：同步写 + 临时文件原子替换）。
 * `file` 为 null 时仅内存（测试/默认隔离）；生产在 index.ts 注入真实路径 `.data/app-state.json`。
 */
export class FileStore {
  private data: PersistedState;

  constructor(private readonly file: string | null) {
    this.data = this.file ? load(this.file) : {};
  }

  getWatchlist(): string[] {
    return this.data.watchlist ?? ['600519', '000001', '300750']; // 茅台/平安/宁德
  }
  setWatchlist(list: string[]): void {
    this.data.watchlist = list;
    this.persist();
  }

  getSessions(): SessionMeta[] {
    return this.data.sessions ?? [];
  }
  setSessions(sessions: SessionMeta[]): void {
    this.data.sessions = sessions;
    this.persist();
  }

  getModelConfig(): ModelConfig | undefined {
    return this.data.modelConfig;
  }
  setModelConfig(cfg: ModelConfig): void {
    this.data.modelConfig = cfg;
    this.persist();
  }

  getReportSettings(): ReportSettings | undefined {
    return this.data.reportSettings;
  }
  setReportSettings(s: ReportSettings): void {
    this.data.reportSettings = s;
    this.persist();
  }

  private persist(): void {
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      renameSync(tmp, this.file);
    } catch (err) {
      console.warn('[store] persist failed:', (err as Error).message);
    }
  }
}

function load(file: string): PersistedState {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as PersistedState;
  } catch {
    return {};
  }
}
