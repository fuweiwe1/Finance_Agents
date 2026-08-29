/**
 * M9 应用到云端（CLI）：把本地设置里的非敏感配置写入仓库变量，并探测 Secrets 就绪度。
 * 用法：REPORT_PAT=<pat> [REPORT_WEBHOOK_URL=<url>] [REPORT_WATCHLIST=a,b] [REPORT_MODEL_*] npx tsx src/scripts/syncCloud.ts
 * 可选 --dispatch <mode> [--date YYYY-MM-DD] 触发云端 workflow。
 */
import { FileStore } from '../store.js';
import { config } from '../config.js';
import { ReportService } from '../report/service.js';
import type { ReportSettings } from '../report/settings.js';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

async function main(): Promise<void> {
  const store = new FileStore(config.dataFile);
  const service = new ReportService(store);
  const prev = service.getSettings();

  const pat = env('REPORT_PAT') ?? prev.pat;
  const webhook = env('REPORT_WEBHOOK_URL') ?? prev.feishuWebhookUrl;
  const watchlist = env('REPORT_WATCHLIST')?.split(',').map((s) => s.trim()).filter(Boolean) ?? prev.watchlist;
  const model = {
    provider: (env('REPORT_MODEL_PROVIDER') ?? prev.model.provider) as 'custom-openai' | 'openai',
    baseUrl: env('REPORT_MODEL_BASE_URL') ?? prev.model.baseUrl,
    model: env('REPORT_MODEL_NAME') ?? prev.model.model,
    apiKey: env('REPORT_MODEL_KEY') ?? prev.model.apiKey,
  };
  // 报告模型未单独配置 → 回退聊天模型
  const chat = store.getModelConfig();
  if (!model.model) {
    if (chat?.model) {
      model.provider = (chat.provider ?? 'custom-openai') as 'custom-openai' | 'openai';
      model.baseUrl = chat.baseUrl ?? '';
      model.model = chat.model;
      model.apiKey = chat.apiKey ?? '';
    } else {
      throw new Error('未配置报告模型（设置面板或 REPORT_MODEL_* env），也无聊天模型可回退');
    }
  }

  const next: ReportSettings = {
    watchlist,
    model,
    feishuWebhookUrl: webhook,
    pat,
    githubRepo: prev.githubRepo,
    lastSyncedAt: prev.lastSyncedAt,
  };
  service.saveSettings(next);

  const result = await service.syncToCloud();
  console.log(JSON.stringify(
    { ok: result.ok, actionsWriteOk: result.actionsWriteOk, variables: result.variables, missingSecrets: result.missingSecrets, error: result.error, guide: result.guide },
    null,
    2,
  ));

  const dispatch = process.argv.indexOf('--dispatch');
  if (dispatch >= 0) {
    const mode = process.argv[dispatch + 1] === 'full' ? 'full' : 'test';
    const dateIdx = process.argv.indexOf('--date');
    const date = dateIdx >= 0 ? process.argv[dateIdx + 1] ?? '' : '';
    const r = await service.dispatchTest({ mode, date });
    console.log(`已触发云端 workflow：mode=${mode}${date ? ` date=${date}` : ''} → ${r.ok ? 'ok' : '失败'}`);
  }
}

main().catch((e) => {
  console.error('[syncCloud] 失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});