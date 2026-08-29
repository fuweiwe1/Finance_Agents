import { useCallback, useEffect, useState } from 'react';
import { api, type ReportCloudState, type ReportSettingsView, type ReportSyncResult } from '../../lib/api';

const DEFAULT_REPO = 'fuweiwe1/Finance_Agents';

/** M9 每日报告推送设置面板（激活侧栏 Settings 入口）。 */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<ReportSettingsView | null>(null);
  const [cloud, setCloud] = useState<ReportCloudState | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [addQ, setAddQ] = useState('');
  const [provider, setProvider] = useState<'custom-openai' | 'openai'>('custom-openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [webhook, setWebhook] = useState('');
  const [pat, setPat] = useState('');
  const [githubRepo, setGithubRepo] = useState(DEFAULT_REPO);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const v = await api.report.settings();
      setView(v);
      setWatchlist(v.watchlist);
      setProvider(v.model.provider === 'openai' ? 'openai' : 'custom-openai');
      setBaseUrl(v.model.baseUrl);
      setModel(v.model.model);
      setGithubRepo(v.githubRepo || DEFAULT_REPO);
      const c = await api.report.cloudState().catch(() => null);
      setCloud(c);
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : '加载设置失败' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flash = (kind: 'ok' | 'err', text: string) => setMsg({ kind, text });

  const addStock = async () => {
    const q = addQ.trim();
    if (!q) return;
    try {
      const found = await api.search(q);
      if (!found.found || !found.symbol) return flash('err', `未找到 "${q}"`);
      const sym: string = found.symbol;
      if (watchlist.includes(sym)) return flash('ok', `${sym} 已在清单`);
      setWatchlist((w) => [...w, sym]);
      setAddQ('');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : '添加失败');
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const v = await api.report.saveSettings({
        watchlist,
        model: { provider, baseUrl, model, apiKey },
        feishuWebhookUrl: webhook,
        pat,
        githubRepo,
      });
      setView(v);
      setApiKey('');
      setWebhook('');
      setPat('');
      flash('ok', '已保存到本地设置');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    try {
      const r: ReportSyncResult = await api.report.sync();
      if (r.actionsWriteOk && variablesChanged(r)) flash('ok', `已同步 ${r.variables.length} 个变量。${r.missingSecrets.length ? `仍缺 Secrets：${r.missingSecrets.join('、')}` : 'Secrets 就绪 ✓'}`);
      else {
        flash('err', r.error ?? '同步失败');
        if (r.guide) flash('err', r.guide);
      }
      const c = await api.report.cloudState().catch(() => null);
      setCloud(c);
    } catch (err) {
      flash('err', err instanceof Error ? err.message : '同步失败');
    } finally {
      setBusy(false);
    }
  };

  const sendTestCard = async () => {
    const r = await api.report.testCard();
    flash(r.ok ? 'ok' : 'err', r.ok ? '测试卡片已发送 ✓' : `发送失败：${r.error ?? ''}`);
  };

  const trigger = async (mode: 'test' | 'full') => {
    setBusy(true);
    try {
      const r = await api.report.testPush(mode);
      flash(r.ok ? 'ok' : 'err', r.ok ? `已触发云端 workflow（${mode}）` : `触发失败：${r.guide ?? ''}`);
    } catch (err) {
      flash('err', err instanceof Error ? err.message : '触发失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-accent/25 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-[92vw] max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-24px_rgba(35,32,27,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">⚙️ 每日决策日报推送（M9）</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-ink-soft transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-surface-soft"
          >
            ✕ 关闭
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          {/* 报告模型 */}
          <section className="rounded-xl border border-line p-3">
            <h3 className="eyebrow mb-2">报告模型（云端生成用，独立于聊天模型）</h3>
            <div className="flex gap-1">
              {(['custom-openai', 'openai'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`flex-1 rounded px-2 py-1 text-xs transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    provider === p ? 'bg-accent text-white' : 'bg-surface-soft text-ink-soft hover:bg-line/60'
                  }`}
                >
                  {p === 'custom-openai' ? 'OpenAI 兼容' : 'OpenAI 官方'}
                </button>
              ))}
            </div>
            <div className="mt-1.5 space-y-1.5">
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="baseURL（如 https://api.deepseek.com/v1）" className="input-sm w-full" />
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model（如 deepseek-chat）" className="input-sm w-full" />
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
                placeholder={view?.model.hasKey ? 'API key（已设置 · 留空保持不变）' : 'API key'}
                className="input-sm w-full"
              />
            </div>
          </section>

          {/* 报告清单 */}
          <section className="rounded-xl border border-line p-3">
            <h3 className="eyebrow mb-2">报告清单（独立于侧栏自选股）</h3>
            <div className="mb-1.5 flex gap-1">
              <input
                value={addQ}
                onChange={(e) => setAddQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addStock();
                }}
                placeholder="输入股票代码"
                className="input-sm w-full"
              />
              <button onClick={() => void addStock()} className="btn-primary shrink-0">
                ＋
              </button>
            </div>
            {watchlist.length ? (
              <ul className="space-y-0.5">
                {watchlist.map((s) => (
                  <li key={s} className="flex items-center justify-between rounded-md px-2 py-1 text-xs text-ink-soft hover:bg-surface-soft">
                    <span>{s}</span>
                    <button
                      onClick={() => setWatchlist((w) => w.filter((x) => x !== s))}
                      className="rounded p-0.5 text-line-strong hover:bg-surface-soft hover:text-up"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-faint">暂无报告清单，每交易日 20:00 对清单逐只生成决策仪表盘。</p>
            )}
          </section>

          {/* 飞书与 GitHub */}
          <section className="rounded-xl border border-line p-3">
            <h3 className="eyebrow mb-2">飞书 & GitHub 云端</h3>
            <div className="space-y-1.5">
              <input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder={view?.hasWebhookUrl ? '飞书 webhook（已设置 · 留空保持不变）' : '飞书群机器人 webhook URL'} className="input-sm w-full" />
              <input value={pat} onChange={(e) => setPat(e.target.value)} type="password" placeholder={view?.hasPat ? 'GitHub fine-grained PAT（已设置 · 留空保持不变）' : 'GitHub fine-grained PAT（Actions: Read and write）'} className="input-sm w-full" />
              <input value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} placeholder="GitHub 仓库 owner/name" className="input-sm w-full" />
            </div>
          </section>

          {/* 云端状态 */}
          <section className="rounded-xl border border-line p-3">
            <h3 className="eyebrow mb-2">云端配置状态</h3>
            {!cloud ? (
              <p className="text-xs text-ink-faint">加载中…</p>
            ) : (
              <div className="space-y-1 text-xs">
                <p className="flex items-center gap-2">
                  {cloud.actionsWriteOk ? '✅ PAT 权限正常（Actions 读写）' : `❌ ${cloud.error ?? 'PAT 无 Actions 权限'}`}
                </p>
                <p>
                  Secrets 就绪：模型 key {cloud.secretsReady.modelKey ? '✅' : '❌'} · 飞书 webhook {cloud.secretsReady.webhookUrl ? '✅' : '❌'}
                </p>
                {cloud.variables.REPORT_WATCHLIST !== undefined && (
                  <p>
                    云端清单：<span className="text-ink">{cloud.variables.REPORT_WATCHLIST}</span>
                  </p>
                )}
                {cloud.lastRun && (
                  <p className="text-ink-soft">
                    最近云端运行：{cloud.lastRun.conclusion ?? cloud.lastRun.status} · {new Date(cloud.lastRun.createdAt).toLocaleString('zh-CN')}
                    {cloud.lastRun.conclusion === 'failure' && (
                      <a href={cloud.lastRun.htmlUrl} target="_blank" rel="noreferrer" className="ml-1 underline">
                        查看日志
                      </a>
                    )}
                  </p>
                )}
                {!cloud.lastRun && cloud.actionsWriteOk && <p className="text-ink-faint">云端暂无运行记录（点击上方「应用到云端」并触发测试后出现）。</p>}
                {!cloud.secretsReady.modelKey && (
                  <p className="text-up">
                    在仓库 Settings → Secrets and variables → Actions 添加 Secret <b>REPORT_MODEL_KEY</b>（报告模型 API key）
                  </p>
                )}
                {!cloud.secretsReady.webhookUrl && (
                  <p className="text-up">
                    添加 Secret <b>FEISHU_WEBHOOK_URL</b>（飞书 webhook 完整 URL）
                  </p>
                )}
              </div>
            )}
          </section>

          {msg && <p className={`text-xs ${msg.kind === 'ok' ? 'text-status' : 'text-up'}`}>{msg.text}</p>}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => void save()} disabled={busy} className="btn-primary">
              {busy ? '处理中…' : '保存设置'}
            </button>
            <button onClick={() => void sync()} disabled={busy} className="btn-primary">
              应用到云端
            </button>
            <button onClick={() => void sendTestCard()} disabled={busy} className="btn-ghost">
              📡 发送测试卡片
            </button>
            <button onClick={() => void trigger('test')} disabled={busy} className="btn-ghost">
              云端测试
            </button>
            <button onClick={() => void trigger('full')} disabled={busy} className="btn-ghost">
              立即正式报告
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function variablesChanged(r: ReportSyncResult): boolean {
  return r.actionsWriteOk === true;
}