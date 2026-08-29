import { DEFAULT_MODEL_CONFIG, type ModelConfig } from '../agent/models.js';

/** 报告推送设置（本地 FileStore 镜像 + GitHub 变量/Secrets 真源）。 */
export interface ReportSettings {
  /** 报告清单（独立于侧栏自选股） */
  watchlist: string[];
  /** 独立报告模型 */
  model: ModelConfig;
  /** 飞书群机器人 webhook URL（无签名） */
  feishuWebhookUrl: string;
  /** fine-grained PAT（仅存本地，绝不入库/上传） */
  pat: string;
  /** 目标 GitHub 仓库 owner/name（默认用户自持仓库） */
  githubRepo: string;
  /** 最近一次「应用到云端」同步时间 */
  lastSyncedAt?: string;
}

export const DEFAULT_GITHUB_REPO = 'fuweiwe1/Finance_Agents';

export const EMPTY_REPORT_SETTINGS: ReportSettings = {
  watchlist: [],
  model: { ...DEFAULT_MODEL_CONFIG },
  feishuWebhookUrl: '',
  pat: '',
  githubRepo: DEFAULT_GITHUB_REPO,
};

/** 返回给前端的视图：敏感项只暴露「是否已设置」。 */
export interface ReportSettingsView {
  watchlist: string[];
  model: { provider: string; baseUrl: string; model: string; hasKey: boolean };
  hasWebhookUrl: boolean;
  hasPat: boolean;
  githubRepo: string;
  lastSyncedAt?: string;
}

export function toReportSettingsView(s: ReportSettings): ReportSettingsView {
  return {
    watchlist: [...s.watchlist],
    model: {
      provider: s.model.provider,
      baseUrl: s.model.baseUrl,
      model: s.model.model,
      hasKey: Boolean(s.model.apiKey),
    },
    hasWebhookUrl: Boolean(s.feishuWebhookUrl),
    hasPat: Boolean(s.pat),
    githubRepo: s.githubRepo || DEFAULT_GITHUB_REPO,
    lastSyncedAt: s.lastSyncedAt,
  };
}