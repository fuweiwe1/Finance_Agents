import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './web/e2e',
  timeout: 45_000,
  fullyParallel: false,
  retries: 0,
  globalSetup: './playwright.global-setup.ts',
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    // E2E 用独立端口(web 4173 / api 3101) + 隔离数据/追踪文件，与开发环境(5173/3001)完全隔离，
    // 不杀任何进程、不影响用户真实数据；localhost 让浏览器绕过系统代理。
    command:
      'set "PORT=3101" && set "API_PORT=3101" && set "DATA_FILE=.data/e2e-state.json" && set "TRACE_FILE=.data/e2e-traces.jsonl" && concurrently -n server,web -c blue,magenta "npm run dev -w server" "npm run dev -w web -- --port 4173"',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
