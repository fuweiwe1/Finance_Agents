import { useState } from 'react';
import { useAppStore } from '../../state/useAppStore';
import { api, type ModelProvider } from '../../lib/api';

/** 顶部模型 API 配置条：Provider / baseURL / model / API key（key 只发后端，不回显） */
export function ModelConfigBar() {
  const cfg = useAppStore((s) => s.modelConfig);
  const setModelConfig = useAppStore((s) => s.setModelConfig);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ModelProvider>('custom-openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const openEditor = () => {
    setProvider(cfg?.provider ?? 'custom-openai');
    setBaseUrl(cfg?.baseUrl ?? '');
    setModel(cfg?.model ?? '');
    setApiKey('');
    setMsg('');
    setOpen(true);
  };

  const save = async () => {
    if (!model || !apiKey) {
      setMsg('model 与 API key 必填');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await api.modelConfig.save({ provider, baseUrl, model, apiKey });
      const info = await api.modelConfig.get();
      setModelConfig(info);
      setOpen(false);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shrink-0 border-b border-slate-200 p-2">
      {!open ? (
        <button
          onClick={openEditor}
          className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs transition-colors hover:bg-slate-100"
        >
          <span className="truncate font-medium text-slate-700">{cfg?.model ? `🤖 ${cfg.model}` : '🤖 配置模型 API'}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 ${
              cfg?.hasKey ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {cfg?.hasKey ? '已配置' : '未配置'}
          </span>
        </button>
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-1">
            {(['custom-openai', 'openai'] as ModelProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`flex-1 rounded px-2 py-1 text-xs ${
                  provider === p ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {p === 'custom-openai' ? 'OpenAI 兼容' : 'OpenAI 官方'}
              </button>
            ))}
          </div>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="baseURL（如 https://api.openai.com/v1 或 Ollama/vLLM 中转）"
            className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model（如 gpt-4o-mini）"
            className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
          />
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="API key（仅存后端内存）"
            className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
          />
          {msg && <p className="text-[11px] text-red-500">{msg}</p>}
          <div className="flex gap-1">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
