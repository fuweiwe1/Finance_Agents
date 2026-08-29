/**
 * M9 云端状态查看：读本地设置里的 PAT → 打印云端配置健康度 + 最近一次 workflow run 的
 * 结论与关键日志行（不落 PAT 字面量到命令行）。
 */
import { FileStore } from '../store.js';
import { config } from '../config.js';
import { ReportService } from '../report/service.js';

async function main(): Promise<void> {
  const store = new FileStore(config.dataFile);
  const service = new ReportService(store);
  const state = await service.cloudState();

  console.log(JSON.stringify(
    {
      actionsWriteOk: state.actionsWriteOk,
      error: state.error,
      secretsReady: state.secretsReady,
      variables: state.variables,
      lastRun: state.lastRun,
    },
    null,
    2,
  ));

  // 若最近运行已完成，抓 job 日志里 dailyReport 的关键行（确认跳过/推送）
  const s = service.getSettings();
  const run = state.lastRun;
  if (s.pat && run && run.status === 'completed') {
    try {
      const repo = s.githubRepo;
      const tok = s.pat;
      const base = 'https://api.github.com';
      const h = { Authorization: `Bearer ${tok}`, 'User-Agent': 'finance-agents-m9', Accept: 'application/vnd.github+json' };
      const jobsRes = await fetch(`${base}/repos/${repo}/actions/runs/${run.id}/jobs`, { headers: h, signal: AbortSignal.timeout(15000) });
      const jobsJson = (await jobsRes.json()) as { jobs?: { id: number }[] };
      const jobId = jobsJson?.jobs?.[0]?.id;
      if (jobId) {
        const logRes = await fetch(`${base}/repos/${repo}/actions/jobs/${jobId}/logs`, {
          headers: h,
          signal: AbortSignal.timeout(30000),
          redirect: 'follow',
        });
        if (logRes.ok) {
          const text = await logRes.text();
          console.log('\n===== 最近运行关键日志 =====');
          for (const line of text.split('\n')) {
            if (line.includes('[dailyReport]') || line.includes('[sendTestCard]')) console.log(line);
          }
        }
      }
    } catch (err) {
      console.warn('\n[statusCloud] 日志获取失败:', (err as Error).message);
    }
  } else {
    console.log('\n（无已完成运行或未配置 PAT）');
  }
}

main().catch((e) => {
  console.error('[statusCloud] 失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});