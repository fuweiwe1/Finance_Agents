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
    <div className="shrink-0 border-b border-line p-2">
      {!open ? (
        <button
          onClick={openEditor}
          className="flex w-full items-center justify-between gap-2 rounded-lg bg-surface-soft px-3 py-2 text-xs transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-line/60"
        >
          <span className="truncate font-medium text-ink-soft">{cfg?.model ? `🤖 ${cfg.model}` : '🤖 配置模型 API'}</span>
          <span
            className={`chip ${
              cfg?.hasKey ? 'bg-status-soft text-status' : 'bg-pre-soft text-pre'
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
                className={`flex-1 rounded px-2 py-1 text-xs transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  provider === p ? 'bg-accent text-white' : 'bg-surface-soft text-ink-soft hover:bg-line/60'
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
            className="input-sm w-full"
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model（如 gpt-4o-mini）"
            className="input-sm w-full"
          />
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="API key（仅存后端内存）"
            className="input-sm w-full"
          />
          {msg && <p className="text-[11px] text-up">{msg}</p>}
          <div className="flex gap-1">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="flex-1 rounded-lg bg-accent px-2 py-1 text-xs font-medium text-white transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="btn-ghost flex-1"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
