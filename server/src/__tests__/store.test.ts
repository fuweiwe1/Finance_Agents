import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { FileStore } from '../store.js';

const dirs: string[] = [];
function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'fa-store-'));
  dirs.push(dir);
  return join(dir, 'app-state.json');
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('FileStore（服务端持久化）', () => {
  it('默认自选 + 写盘后可重新读取', () => {
    const file = tempFile();
    const s = new FileStore(file);
    expect(s.getWatchlist()).toEqual(['600519', '000001', '300750']);

    s.setWatchlist(['002594', '300750']);
    const s2 = new FileStore(file);
    expect(s2.getWatchlist()).toEqual(['002594', '300750']);
    expect(existsSync(file)).toBe(true);
  });

  it('会话元数据持久化', () => {
    const file = tempFile();
    const s = new FileStore(file);
    s.setSessions([
      { id: 'abc', title: 'New Session', msgCount: 3, createdAt: '2026-08-15T00:00:00.000Z' },
    ]);
    const s2 = new FileStore(file);
    expect(s2.getSessions()).toHaveLength(1);
    expect(s2.getSessions()[0]!.msgCount).toBe(3);
  });

  it('模型配置持久化', () => {
    const file = tempFile();
    const s = new FileStore(file);
    expect(s.getModelConfig()).toBeUndefined();
    s.setModelConfig({
      provider: 'custom-openai',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen3:32b',
      apiKey: 'sk-test',
    });
    const s2 = new FileStore(file);
    expect(s2.getModelConfig()?.model).toBe('qwen3:32b');
    expect(s2.getModelConfig()?.apiKey).toBe('sk-test');
  });

  it('file 为 null 时仅内存、不写盘', () => {
    const s = new FileStore(null);
    s.setWatchlist(['X']);
    expect(s.getWatchlist()).toEqual(['X']);
    // 无文件可断言，仅验证不抛错
  });

  it('损坏文件回退默认', () => {
    const file = tempFile();
    writeFileSync(file, '{broken json', 'utf8');
    const s = new FileStore(file);
    expect(s.getWatchlist()).toEqual(['600519', '000001', '300750']);
  });
});
