import { describe, it, expect } from 'vitest';
import { FileStore } from '../store.js';
import { ModelManager } from './models.js';

describe('ModelManager 持久化恢复（重启后无需重新配置即可对话）', () => {
  it('从 store 恢复配置并立即构建 Models 集合', () => {
    const store = new FileStore(null);
    const mm = new ModelManager({ store });
    mm.setConfig({ provider: 'custom-openai', baseUrl: 'http://localhost:11434/v1', model: 'qwen3:32b', apiKey: 'sk-test' });

    // 模拟重启：用同一 store 新建 ModelManager
    const mm2 = new ModelManager({ store });
    expect(mm2.configured()).toBe(true);
    expect(mm2.getModel()).not.toBeNull(); // 关键：集合已构建，getModel 非空
    expect(mm2.getConfig().model).toBe('qwen3:32b');
  });

  it('无配置时 configured 为 false、getModel 为 null', () => {
    const store = new FileStore(null);
    const mm = new ModelManager({ store });
    expect(mm.configured()).toBe(false);
    expect(mm.getModel()).toBeNull();
  });

  it('setConfig 后持久化到 store', () => {
    const store = new FileStore(null);
    const mm = new ModelManager({ store });
    mm.setConfig({ provider: 'openai', baseUrl: '', model: 'gpt-4o-mini', apiKey: 'k' });
    expect(store.getModelConfig()?.model).toBe('gpt-4o-mini');
  });
});
