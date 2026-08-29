import type { FileStore } from '../store.js';
import { FeishuPushChannel } from '../push/feishu.js';
import type { PushCard } from '../push/channel.js';
import {
  dispatchWorkflow,
  latestWorkflowRun,
  probeReportCloudState,
  setVariable,
  type RepoRef,
  type SecretMeta,
  type WorkflowRunInfo,
} from './github.js';
import {
  DEFAULT_GITHUB_REPO,
  EMPTY_REPORT_SETTINGS,
  toReportSettingsView,
  type ReportSettings,
  type ReportSettingsView,
} from './settings.js';

/** 指导字符串：写飞书 webhook 到 GitHub 的说明（设置页展示）。 */
export const MANUAL_SECRET_GUIDE = `模型 key 与飞书 webhook 因 GitHub Secrets API 需要加密（本地无法安装加密封装库），请到仓库网页添加两个 Secret：
  Settings → Secrets and variables → Actions → New repository secret：
  · 名称 REPORT_MODEL_KEY，值 = 报告模型 API key
  · 名称 FEISHU_WEBHOOK_URL，值 = 飞书机器人 webhook 完整 URL`;

export interface SyncResult {
  ok: boolean;
  variables: { name: string; value: string }[];
  missingSecrets: string[];
  actionsWriteOk: boolean;
  error?: string;
  guide?: string;
}

export interface CloudStateResult {
  actionsWriteOk: boolean;
  error?: string;
  variables: Record<string, string | undefined>;
  secretsReady: { modelKey: boolean; webhookUrl: boolean };
  lastRun?: WorkflowRunInfo | null;
  reportSettingsView: ReportSettingsView;
}

export class ReportService {
  constructor(private readonly store: FileStore) {}

  getSettings(): ReportSettings {
    return { ...EMPTY_REPORT_SETTINGS, ...this.store.getReportSettings() };
  }

  saveSettings(cfg: ReportSettings): void {
    const prev = this.getSettings();
    // 留空 = 保持原值（key/webhook/PAT 不在前端回显，未填时不得误清空）
    const keepPrev = (incoming: string, old: string) => (incoming.trim() ? incoming.trim() : old);
    const next: ReportSettings = {
      watchlist: Array.isArray(cfg.watchlist) ? cfg.watchlist : [],
      model: {
        ...cfg.model,
        apiKey: keepPrev(cfg.model.apiKey ?? '', prev.model.apiKey ?? ''),
      },
      feishuWebhookUrl: keepPrev(cfg.feishuWebhookUrl ?? '', prev.feishuWebhookUrl ?? ''),
      pat: keepPrev(cfg.pat ?? '', prev.pat ?? ''),
      githubRepo: keepPrev(cfg.githubRepo ?? '', prev.githubRepo ?? DEFAULT_GITHUB_REPO),
      lastSyncedAt: prev.lastSyncedAt,
    };
    this.store.setReportSettings(next);
  }

  view(): ReportSettingsView {
    return toReportSettingsView(this.getSettings());
  }

  private repoRef(): RepoRef {
    const s = this.getSettings();
    if (!s.pat) throw new Error('未配置 PAT');
    return { token: s.pat, repo: s.githubRepo || DEFAULT_GITHUB_REPO };
  }

  /** 把非敏感配置写到仓库变量；key/webhook 为 Secret（手动），这里只探测缺失项。 */
  async syncToCloud(): Promise<SyncResult> {
    const s = this.getSettings();
    const ref = this.repoRef();
    const probe = await probeReportCloudState(ref);
    if (!probe.actionsWriteOk) {
      return {
        ok: false,
        variables: [],
        missingSecrets: [],
        actionsWriteOk: false,
        error: probe.error,
        guide: 'PAT 需要仓库级「Actions」权限：Settings → Developer settings → Fine-grained tokens → 编辑 → Repository permissions → Actions → Read and write。',
      };
    }

    const variables: SyncResult['variables'] = [];
    const kv: [string, string][] = [
      ['REPORT_WATCHLIST', s.watchlist.join(',')],
      ['REPORT_MODEL_PROVIDER', s.model.provider],
      ['REPORT_MODEL_BASE_URL', s.model.baseUrl],
      ['REPORT_MODEL_NAME', s.model.model],
    ];
    for (const [name, value] of kv) {
      await setVariable(ref, name, value);
      variables.push({ name, value });
    }

    const missingSecrets: string[] = [];
    const ready = probe.secretsReady;
    if (!ready.modelKey) missingSecrets.push('REPORT_MODEL_KEY');
    if (!ready.webhookUrl) missingSecrets.push('FEISHU_WEBHOOK_URL');

    this.store.setReportSettings({ ...s, lastSyncedAt: new Date().toISOString() });

    return {
      ok: missingSecrets.length === 0,
      variables,
      missingSecrets,
      actionsWriteOk: true,
      guide: missingSecrets.length ? `云端运行还需要两个 Secret。${MANUAL_SECRET_GUIDE}` : undefined,
    };
  }

  async cloudState(): Promise<CloudStateResult> {
    const s = this.getSettings();
    let result: Awaited<ReturnType<typeof probeReportCloudState>>;
    try {
      const ref = this.repoRef();
      result = await probeReportCloudState(ref);
    } catch (err) {
      result = { actionsWriteOk: false, error: err instanceof Error ? err.message : String(err), variables: {}, secretsReady: { modelKey: false, webhookUrl: false } };
    }
    let lastRun: WorkflowRunInfo | null = null;
    if (result.actionsWriteOk && s.pat) {
      lastRun = await latestWorkflowRun({ token: s.pat, repo: s.githubRepo }, 'daily-report.yml').catch(() => null);
    }
    return {
      actionsWriteOk: result.actionsWriteOk,
      error: result.error,
      variables: result.variables,
      secretsReady: result.secretsReady,
      lastRun,
      reportSettingsView: toReportSettingsView(s),
    };
  }

  async dispatchTest(inputs: { mode?: string; date?: string } = {}): Promise<{ ok: boolean; guide?: string }> {
    const ref = this.repoRef();
    await dispatchWorkflow(ref, 'daily-report.yml', {
      mode: inputs.mode ?? 'test',
      date: inputs.date ?? '',
    });
    return { ok: true };
  }

  /** 本机直接发一张测试卡片（不经 workflow，马上可见）。 */
  async sendTestCard(): Promise<{ ok: boolean; error?: string }> {
    const s = this.getSettings();
    if (!s.feishuWebhookUrl) return { ok: false, error: '未配置飞书 webhook URL' };
    const card: PushCard = {
      title: '📡 M9 推送测试卡',
      color: 'blue',
      body: [
        '这是一张**连通性测试卡片**，用于验证日程推送到飞书的通道。',
        '若你能看到本条消息，webhook 已就绪。',
        '日期：' + new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        '⚠️ 以上为模型观点，不构成投资建议。',
      ],
    };
    const res = await new FeishuPushChannel({ webhookUrl: s.feishuWebhookUrl }).send([card]);
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }
}

export type { SecretMeta };