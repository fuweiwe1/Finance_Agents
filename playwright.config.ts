import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './web/e2e',
  timeout: 45_000,
  fullyParallel: false,
  retries: 0,
  globalSetup: './playwright.global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    // E2E 用隔离数据文件 + 始终自起全新服务（localhost：浏览器对 localhost 绕过系统代理）
    command: 'set "DATA_FILE=.data/e2e-state.json" && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
