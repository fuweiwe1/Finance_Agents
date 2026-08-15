import { createModels, createProvider, type Model, type Models } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import type { StreamFn } from '@earendil-works/pi-agent-core';
import type { FileStore } from '../store.js';

export type ModelProvider = 'custom-openai' | 'openai';

export interface ModelConfig {
  provider: ModelProvider;
  baseUrl: string; // OpenAI 兼容端点，如 https://api.openai.com/v1 或自建中转/Ollama
  model: string;
  apiKey: string; // 仅存后端内存，绝不进浏览器/前端
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'custom-openai',
  baseUrl: '',
  model: '',
  apiKey: '',
};

export function isModelConfigured(cfg: ModelConfig): boolean {
  return Boolean(cfg.model && cfg.apiKey);
}

function resolveBaseUrl(cfg: ModelConfig): string {
  const url = (cfg.baseUrl || (cfg.provider === 'openai' ? 'https://api.openai.com/v1' : '')).trim();
  return url.replace(/\/+$/, '');
}

function buildModels(cfg: ModelConfig): Models {
  const models = createModels();
  const baseUrl = resolveBaseUrl(cfg);
  const modelDef = {
    id: cfg.model,
    name: cfg.model,
    api: 'openai-completions' as const,
    provider: cfg.provider,
    baseUrl,
    reasoning: false,
    input: ['text'] as ('text' | 'image')[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  };
  const provider = createProvider({
    id: cfg.provider,
    name: cfg.model,
    baseUrl,
    auth: {
      apiKey: {
        name: cfg.provider,
        resolve: async () => (cfg.apiKey ? { auth: { apiKey: cfg.apiKey } } : { auth: {} }),
      },
    },
    models: [modelDef],
    api: openAICompletionsApi(),
  });
  models.setProvider(provider);
  return models;
}

/**
 * 持有当前模型配置 + 对应 pi-ai Models 集合。
 * 配置变更时重建集合；调用方应同时让会话 Agent 重建（agent 里持有模型引用）。
 */
export class ModelManager {
  private config: ModelConfig = { ...DEFAULT_MODEL_CONFIG };
  private models: Models | null = null;
  private readonly store?: FileStore;

  /**
   * 测试/持久化注入：
   * - `models` 传入预构建集合（如 fauxProvider）绕过真实 provider；
   * - `store` 提供后：无注入 models 时从 store 恢复配置并**立即构建 Models 集合**（否则重启后
   *   UI 显示"已配置"但 getModel() 为 null，对话报"模型未配置"）；setConfig 时持久化。
   */
  constructor(opts: { models?: Models; config?: Partial<ModelConfig>; store?: FileStore } = {}) {
    this.store = opts.store;
    if (opts.models) {
      this.models = opts.models;
      if (opts.config) this.config = { ...this.config, ...opts.config };
    } else if (opts.store) {
      const saved = opts.store.getModelConfig();
      if (saved) {
        this.config = { ...saved };
        this.models = buildModels(this.config);
      }
    }
  }

  getConfig(): ModelConfig {
    return { ...this.config };
  }

  configured(): boolean {
    return isModelConfigured(this.config);
  }

  setConfig(cfg: ModelConfig): void {
    this.config = { ...cfg };
    this.models = buildModels(this.config);
    this.store?.setModelConfig(this.config);
  }

  getModel(): Model<any> | null {
    if (!this.models) return null;
    try {
      return this.models.getModel(this.config.provider, this.config.model) ?? null;
    } catch {
      return null;
    }
  }

  /** 绑定 Models.streamSimple 作为 agent-core 的 StreamFn */
  streamFn(): StreamFn {
    if (!this.models) throw new Error('model not configured');
    return this.models.streamSimple.bind(this.models) as StreamFn;
  }
}
