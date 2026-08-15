import { create } from 'zustand';
import { api, type ModelConfigInfo, type SessionMeta } from '../lib/api';

interface AppState {
  watchlist: string[];
  selected: string;
  sessions: SessionMeta[];
  activeSessionId: string | null;
  modelConfig: ModelConfigInfo | null;
  init: () => Promise<void>;
  select: (symbol: string) => void;
  addToWatchlist: (symbol: string) => Promise<void>;
  removeFromWatchlist: (symbol: string) => Promise<void>;
  createSession: () => Promise<void>;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  setModelConfig: (cfg: ModelConfigInfo) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  watchlist: [],
  selected: 'TSLA',
  sessions: [],
  activeSessionId: null,
  modelConfig: null,

  init: async () => {
    const [watchlist, sessions, modelConfig] = await Promise.all([
      api.watchlist.list().catch((): string[] => []),
      api.sessions.list().catch((): SessionMeta[] => []),
      api.modelConfig.get().catch((): ModelConfigInfo | null => null),
    ]);
    let nextSessions = sessions;
    let active = get().activeSessionId;
    if (!nextSessions.length) {
      const created = await api.sessions.create().catch(() => null);
      if (created) nextSessions = [created];
    }
    if (!active || !nextSessions.some((s) => s.id === active)) {
      active = nextSessions[0]?.id ?? null;
    }
    const current = get().selected;
    const selected =
      current && watchlist.includes(current) ? current : (watchlist[0] ?? 'TSLA');
    set({
      watchlist,
      sessions: nextSessions,
      activeSessionId: active,
      modelConfig,
      selected,
    });
  },

  select: (symbol) => set({ selected: symbol }),

  addToWatchlist: async (symbol) => {
    const list = await api.watchlist.add(symbol);
    set({ watchlist: list });
  },

  removeFromWatchlist: async (symbol) => {
    const list = await api.watchlist.remove(symbol);
    set({ watchlist: list });
  },

  createSession: async () => {
    const created = await api.sessions.create();
    set({ sessions: [...get().sessions, created], activeSessionId: created.id });
  },

  selectSession: (id) => set({ activeSessionId: id }),

  deleteSession: async (id) => {
    await api.sessions.remove(id);
    const sessions = get().sessions.filter((s) => s.id !== id);
    const activeSessionId = get().activeSessionId === id ? sessions[0]?.id ?? null : get().activeSessionId;
    set({ sessions, activeSessionId });
  },

  setModelConfig: (cfg) => set({ modelConfig: cfg }),
}));
