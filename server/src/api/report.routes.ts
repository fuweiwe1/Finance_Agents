import { Router } from 'express';
import type { ReportService } from '../report/service.js';

export function reportRoutes(report: ReportService): Router {
  const r = Router();

  // 设置（敏感项只回显「是否已设置」）
  r.get('/settings', (_req, res) => res.json(report.view()));

  r.put('/settings', (req, res) => {
    const body = (req.body ?? {}) as {
      watchlist?: string[];
      model?: { provider?: string; baseUrl?: string; model?: string; apiKey?: string };
      feishuWebhookUrl?: string;
      pat?: string;
      githubRepo?: string;
    };
    report.saveSettings({
      watchlist: Array.isArray(body.watchlist) ? body.watchlist : [],
      model: {
        provider: body.model?.provider === 'openai' ? 'openai' : 'custom-openai',
        baseUrl: String(body.model?.baseUrl ?? '').trim(),
        model: String(body.model?.model ?? '').trim(),
        apiKey: String(body.model?.apiKey ?? '').trim(),
      },
      feishuWebhookUrl: String(body.feishuWebhookUrl ?? '').trim(),
      pat: String(body.pat ?? '').trim(),
      githubRepo: String(body.githubRepo ?? '').trim(),
    });
    res.json(report.view());
  });

  // 云端配置健康度（PAT 权限 + 变量/Secrets 就绪度）
  r.get('/cloud-state', async (_req, res) => res.json(await report.cloudState()));

  // 应用到云端：写变量 + 报告缺失 Secrets
  r.post('/sync', async (_req, res) => res.json(await report.syncToCloud()));

  // 本机直发一张测试卡片（不经 workflow，立即可见）
  r.post('/test-card', async (_req, res) => res.json(await report.sendTestCard()));

  // 触发云端 workflow（mode=test/full, date 可选）
  r.post('/test-push', async (req, res) => {
    const body = (req.body ?? {}) as { mode?: string; date?: string };
    const mode = body.mode === 'full' ? 'full' : 'test';
    res.json(await report.dispatchTest({ mode, date: String(body.date ?? '').trim() }));
  });

  return r;
}