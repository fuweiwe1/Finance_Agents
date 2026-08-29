import { contextBridge, ipcRenderer } from 'electron';

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

// 渲染层可用的完整 API 桥（M8-2）：window.api.<命名空间>.<方法>
// 聊天流走事件：agent.chat() 启动后，主进程经 webContents.send('agent:event') 推事件包 { type, data }
contextBridge.exposeInMainWorld('api', {
  market: {
    quote: (symbol: string) => invoke('market:quote', symbol),
    quotes: (symbols: string[]) => invoke('market:quotes', symbols),
    financials: (symbol: string) => invoke('market:financials', symbol),
    news: (symbol: string, limit?: number) => invoke('market:news', symbol, limit),
    kline: (symbol: string, count?: number) => invoke('market:kline', symbol, count),
    search: (q: string) => invoke('market:search', q),
  },
  watchlist: {
    list: () => invoke('watchlist:list'),
    add: (symbol: string) => invoke('watchlist:add', symbol),
    remove: (symbol: string) => invoke('watchlist:remove', symbol),
  },
  sessions: {
    list: () => invoke('sessions:list'),
    create: () => invoke('sessions:create'),
    remove: (id: string) => invoke('sessions:remove', id),
  },
  modelConfig: {
    get: () => invoke('model-config:get'),
    save: (cfg: Record<string, unknown>) => invoke('model-config:save', cfg),
  },
  agent: {
    chat: (payload: { sessionId: string; message: string; context?: { symbol?: string; name?: string; price?: number } }) =>
      invoke('agent:chat', payload),
    onEvent: (cb: (packet: { type: string; data: unknown }) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, packet: { type: string; data: unknown }): void => cb(packet);
      ipcRenderer.on('agent:event', listener);
      return () => ipcRenderer.removeListener('agent:event', listener);
    },
  },
  traces: {
    list: (query?: { sessionId?: string; outcome?: string; limit?: number }) => invoke('traces:list', query),
    get: (id: string) => invoke('traces:get', id),
    feedback: (id: string, rating: number, reason?: string, reasons?: string[]) =>
      invoke('traces:feedback', id, rating, reason, reasons),
  },
  report: {
    settings: {
      get: () => invoke('report:settings:get'),
      save: (cfg: Record<string, unknown>) => invoke('report:settings:save', cfg),
    },
    cloudState: () => invoke('report:cloud-state'),
    sync: () => invoke('report:sync'),
    testCard: () => invoke('report:test-card'),
    testPush: (mode: 'full' | 'test', date?: string) => invoke('report:test-push', mode, date),
  },
});