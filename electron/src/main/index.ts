import { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import { resolve } from 'node:path';
import { createServices } from '../../../server/src/services.js';
import { TraceCollector } from '../../../server/src/trace/collector.js';
import { normalizeSymbol } from '../../../server/src/eval/market/normalize.js';

// 必须先于任何 getPath('userData')：保证打包后数据目录是 %APPDATA%/Finance Agents
app.setName('Finance Agents');

// 渲染层地址：dev 下由 scripts/run-electron-dev.mjs 注入 web 开发服务器；生产加载 web/dist
const rendererUrl = process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173';

/** 数据目录：打包后写 userData（%APPDATA%/Finance Agents）；开发用仓库根 server/.data */
function resolveDataDir(): string {
  if (app.isPackaged) return app.getPath('userData');
  // dev 下 main 产物在 electron/out/main → ../../../ 即仓库根；可用 DSA_DATA_DIR 覆盖
  return process.env['DSA_DATA_DIR'] || resolve(__dirname, '../../../server/.data');
}

const services = createServices({
  dataFile: resolve(resolveDataDir(), 'app-state.json'),
  traceFile: resolve(resolveDataDir(), 'traces.jsonl'),
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    autoHideMenuBar: true,
    title: 'Finance Agents',
    icon: resolve(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: resolve(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 托盘常驻：✕ 隐藏到托盘（仅真正退出才 close）
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  // 打包后加载内置 renderer/index.html（build-desktop 把 web/dist 拷成 electron/renderer）；dev 加载 web 开发服务器
  if (app.isPackaged) {
    win.loadFile(resolve(__dirname, '../../renderer/index.html'));
  } else {
    win.loadURL(rendererUrl);
  }
  mainWindow = win;
  return win;
}

function createTray(): void {
  tray = new Tray(nativeImage.createFromPath(resolve(__dirname, '../../resources/icon.png')));
  tray.setToolTip('Finance Agents');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => showMainWindow() },
      { type: 'separator' },
      { label: '退出', click: () => { isQuitting = true; app.quit(); } },
    ]),
  );
  tray.on('double-click', () => showMainWindow());
}

function showMainWindow(): void {
  if (!mainWindow) {
    mainWindow = createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** 自动更新（M8-4）：仅打包实例生效。autoDownload=true 让发现新版后自动后台下载，下载完弹窗提示重启安装 */
function setupAutoUpdate(): void {
  // 关键：若 autoDownload=false，checkForUpdatesAndNotify 只检查不下载也不提示（用户无感知）
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => console.log(`[updater] 发现新版本 ${info.version}，开始后台下载`));
  autoUpdater.on('update-not-available', () => console.log('[updater] 已是最新版本'));
  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[updater] 新版本 ${info.version} 已下载，弹窗提示重启安装`);
    const opts: Electron.MessageBoxOptions = {
      type: 'info',
      title: '发现新版本',
      message: `新版本 ${info.version} 已下载完成。`,
      detail: '重启应用即可完成更新。是否现在重启安装？',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
      cancelId: 1,
    };
    const ask = async () => {
      const { response } = mainWindow ? await dialog.showMessageBox(mainWindow, opts) : await dialog.showMessageBox(opts);
      if (response === 0) autoUpdater.quitAndInstall();
    };
    void ask();
  });
  autoUpdater.on('error', (err) => console.error('[updater] 检查失败', err?.message ?? err));
  autoUpdater.checkForUpdatesAndNotify().catch((err) => console.error('[updater] check error', err?.message ?? err));
}

/** 注册 IPC handler（M8-2）：渲染层 window.api → invoke(channel) → 这里调用 transport 无关的 services */
function registerIpc(): void {
  const { market, store, models, sessions, traces, report } = services;

  ipcMain.handle('market:quote', (_e, symbol: string) => market.getQuote(symbol));
  ipcMain.handle('market:quotes', (_e, symbols: string[]) => market.getQuotes(symbols));
  ipcMain.handle('market:financials', (_e, symbol: string) => market.getFinancials(symbol));
  ipcMain.handle('market:news', (_e, symbol: string, limit?: number) => market.getNews(symbol, limit));
  ipcMain.handle('market:kline', (_e, symbol: string, count?: number) => market.getKline(symbol, 'day', count));
  ipcMain.handle('market:search', (_e, q: string) => {
    const norm = normalizeSymbol(q);
    if (!norm) return { found: false };
    return market.getQuote(norm.symbol).then((quote) =>
      quote ? { found: true, symbol: quote.symbol, code: quote.code, name: quote.name, price: quote.price, changePct: quote.changePct } : { found: false, symbol: norm.symbol },
    );
  });

  ipcMain.handle('watchlist:list', () => store.getWatchlist());
  ipcMain.handle('watchlist:add', (_e, symbol: string) => {
    const list = store.getWatchlist();
    const norm = normalizeSymbol(symbol);
    if (!norm) throw new Error(`invalid symbol: ${symbol}`);
    if (!list.includes(norm.symbol)) list.push(norm.symbol);
    store.setWatchlist(list);
    return list;
  });
  ipcMain.handle('watchlist:remove', (_e, symbol: string) => {
    const list = store.getWatchlist().filter((s) => s.toUpperCase() !== String(symbol).toUpperCase());
    store.setWatchlist(list);
    return list;
  });

  ipcMain.handle('sessions:list', () => sessions.list());
  ipcMain.handle('sessions:create', () => sessions.create());
  ipcMain.handle('sessions:remove', (_e, id: string) => sessions.delete(id));

  ipcMain.handle('model-config:get', () => {
    const cfg = models.getConfig();
    return { provider: cfg.provider, baseUrl: cfg.baseUrl, model: cfg.model, hasKey: Boolean(cfg.apiKey) };
  });
  ipcMain.handle('model-config:save', (_e, body: { provider?: string; model?: string; baseUrl?: string; apiKey?: string }) => {
    const model = String(body?.model ?? '').trim();
    if (!model) throw new Error('model is required');
    const provider = body?.provider === 'openai' ? 'openai' : 'custom-openai';
    models.setConfig({ provider, model, baseUrl: String(body?.baseUrl ?? '').trim(), apiKey: String(body?.apiKey ?? '').trim() });
    sessions.invalidateAgents();
    return { ok: true, model, provider };
  });

  ipcMain.handle('traces:list', (_e, query?: { sessionId?: string; outcome?: string; limit?: number }) => {
    const outcome = query?.outcome === 'error' || query?.outcome === 'ok' ? query.outcome : undefined;
    return traces.list({ sessionId: query?.sessionId, outcome, limit: query?.limit });
  });
  ipcMain.handle('traces:get', (_e, id: string) => {
    const t = traces.get(id);
    if (!t) throw new Error('trace not found');
    return t;
  });
  ipcMain.handle('traces:feedback', (_e, id: string, rating: number, reason?: string, reasons?: string[]) => {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('rating must be integer 1-5');
    return { ok: traces.setFeedback(id, { rating, reason, reasons }) };
  });

  // ---- M9 每日报告推送（复用同一 ReportService） ----
  ipcMain.handle('report:settings:get', () => report.view());
  ipcMain.handle('report:settings:save', (_e, body: Record<string, unknown>) => {
    report.saveSettings({
      watchlist: Array.isArray(body.watchlist) ? (body.watchlist as string[]) : [],
      model: {
        provider: (body.model as { provider?: string } | undefined)?.provider === 'openai' ? 'openai' : 'custom-openai',
        baseUrl: String((body.model as { baseUrl?: string } | undefined)?.baseUrl ?? '').trim(),
        model: String((body.model as { model?: string } | undefined)?.model ?? '').trim(),
        apiKey: String((body.model as { apiKey?: string } | undefined)?.apiKey ?? '').trim(),
      },
      feishuWebhookUrl: String(body.feishuWebhookUrl ?? '').trim(),
      pat: String(body.pat ?? '').trim(),
      githubRepo: String(body.githubRepo ?? '').trim(),
    });
    return report.view();
  });
  ipcMain.handle('report:cloud-state', () => report.cloudState());
  ipcMain.handle('report:sync', () => report.syncToCloud());
  ipcMain.handle('report:test-card', () => report.sendTestCard());
  ipcMain.handle('report:test-push', (_e, mode: 'full' | 'test', date?: string) =>
    report.dispatchTest({ mode: mode === 'full' ? 'full' : 'test', date: String(date ?? '').trim() || undefined }),
  );

  // 聊天流（M8-2）：invoke 启动，事件经 event.sender → webContents.send('agent:event') 推给渲染层
  ipcMain.handle(
    'agent:chat',
    async (event, payload: { sessionId: string; message: string; context?: { symbol?: string; name?: string; price?: number } }) => {
      const meta = sessions.get(payload.sessionId);
      if (!meta) throw new Error('session not found');
      const message = String(payload?.message ?? '').trim();
      if (!message) throw new Error('message is required');
      if (!models.configured()) throw new Error('请先在右上角配置模型 API（baseURL / model / API key）');

      const wc = event.sender;
      const agent = sessions.agent(meta.id, models, market);
      agent.setContext(payload.context);
      const collector = new TraceCollector({
        sessionId: meta.id,
        userMessage: message,
        modelId: models.getConfig().model,
        context: payload.context,
      });

      wc.send('agent:event', { type: 'chat_start', data: {} });
      try {
        await agent.prompt(message, (e) => {
          wc.send('agent:event', { type: 'agent_event', data: e });
          collector.onEvent(e);
        });
        sessions.bumpMsgCount(meta.id);
        const usage = agent.lastUsage();
        collector.finish();
        traces.append(collector.trace);
        wc.send('agent:event', { type: 'chat_end', data: { ok: true, msgCount: meta.msgCount, usage } });
      } catch (err) {
        collector.finish(err);
        traces.append(collector.trace);
        wc.send('agent:event', { type: 'error', data: { message: err instanceof Error ? err.message : 'unknown error' } });
      }
      return { ok: true };
    },
  );
}

/** M8-0 风险探针 */
async function probePiAgent(): Promise<void> {
  const t0 = Date.now();
  try {
    const { createModels, fauxProvider, fauxAssistantMessage } = await import('@earendil-works/pi-ai');
    const faux = fauxProvider();
    faux.setResponses([fauxAssistantMessage('probe ok')]);
    const models = createModels();
    models.setProvider(faux.provider);
    const model = models.getModel(faux.provider.id, faux.getModel()!.id);
    if (!model) throw new Error('faux model not found');
    const stream = models.streamSimple(model, {
      systemPrompt: 'probe',
      messages: [{ role: 'user', content: 'hi', timestamp: Date.now() }],
    });
    for await (const _e of stream) {
      /* 排空 */
    }
    console.log(`[probe] pi-ai stream in Electron main: OK (${Date.now() - t0}ms)`);
  } catch (err) {
    console.error('[probe] pi-ai in Electron main: FAILED', err);
    app.exit(1);
  }
}

/** M8-2 验证：ELECTRON_VERIFY_IPC=1 时，在渲染进程执行 window.api 调用，打回结果后退出 */
async function verifyIpc(win: BrowserWindow): Promise<void> {
  win.webContents.on('did-finish-load', async () => {
    try {
      const out = await win.webContents.executeJavaScript(
        `(async () => {
          const quote = await window.api.market.quote('600519');
          const sessions = await window.api.sessions.list();
          const traces = await window.api.traces.list({ limit: 1 });
          return { dataDir: '${resolveDataDir().replace(/\\\\/g, '/')}', quoteName: quote && quote.name, quotePrice: quote && quote.price, sessionsCount: sessions.length, tracesCount: traces.length };
        })()`,
      );
      console.log('[verify-ipc]', JSON.stringify(out));
    } catch (err) {
      console.error('[verify-ipc] FAILED', err);
    }
    app.exit(0);
  });
}

// 单实例锁（M8-3） - setName 已在模块顶部执行，userData 应为 Finance Agents
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[electron] 检测到已有实例运行，退出（激活已有窗口）');
  app.quit();
} else {
  app.on('second-instance', () => {
    console.log('[electron] 收到第二实例请求，激活主窗口');
    showMainWindow();
  });
  app.whenReady().then(async () => {
    console.log(`[electron] dataDir: ${resolveDataDir()}`);
    await probePiAgent();
    registerIpc();
    createWindow();
    createTray();
    if (app.isPackaged) setupAutoUpdate();
    if (process.env['ELECTRON_VERIFY_IPC'] === '1' && mainWindow) await verifyIpc(mainWindow);
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  // 托盘模式下窗口"关闭"即隐藏，不触发 window-all-closed 退出
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && isQuitting) app.quit();
  });
}