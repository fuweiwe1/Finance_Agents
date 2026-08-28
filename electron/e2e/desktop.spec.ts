import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { _electron as electron, test, expect } from '@playwright/test';

// electron/ 无 type:module → Playwright 按 CJS 编译，用 __dirname（本文件在 electron/e2e/）
const electronDir = resolve(__dirname, '..');

test.describe('Electron 桌面端 (T3)', () => {
  let app: Awaited<ReturnType<typeof electron.launch>> | null = null;
  let tempData = '';

  test.beforeEach(async () => {
    tempData = mkdtempSync(join(tmpdir(), 'fa-e2e-'));
  });

  test.afterEach(async () => {
    await app?.close().catch(() => undefined);
    app = null;
    rmSync(tempData, { recursive: true, force: true });
  });

  test('窗口打开 + window.api IPC 全链路（真实数据 + 未配置模型拒绝路径）', async () => {
    app = await electron.launch({
      args: ['.'],
      cwd: electronDir,
      env: {
        ...(process.env as Record<string, string>),
        ELECTRON_RENDERER_URL: pathToFileURL(join(electronDir, 'renderer/index.html')).href,
        DSA_DATA_DIR: tempData, // 隔离数据目录，不污染真实 %APPDATA%
      } as Record<string, string>,
    });

    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeVisible({ timeout: 20_000 });

    // preload 桥 + IPC → services → 真实行情
    const quote = await page.evaluate(() => window.api.market.quote('600519'));
    expect(quote).not.toBeNull();
    expect(quote!.name).toBe('贵州茅台');
    expect(quote!.price).toBeGreaterThan(0);

    // 会话/自选 IPC
    const sessions = await page.evaluate(() => window.api.sessions.list());
    expect(Array.isArray(sessions)).toBe(true);
    const created = await page.evaluate(() => window.api.sessions.create());
    expect(created.id).toBeTruthy();

    // 未配置模型 → agent.chat 依契约拒绝"请先配置模型 API"
    const chatErr = await page.evaluate(
      (sid: string) =>
        window.api.agent.chat({ sessionId: sid, message: 'hi' }).then(
          () => 'no-error',
          (e: unknown) => String((e as Error).message ?? e),
        ),
      created.id,
    );
    expect(chatErr).toContain('配置模型');

    // traces/自选 IPC 亦可达
    const traces = await page.evaluate(() => window.api.traces.list({ limit: 5 }));
    expect(Array.isArray(traces)).toBe(true);
    const quotes = await page.evaluate(() => window.api.market.quotes(['600519', '000001']));
    expect(quotes.length).toBeGreaterThan(0);
  });
});