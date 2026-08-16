import { create } from 'zustand';
import { api, type AgentTrace } from '../lib/api';

interface TracesState {
  traces: AgentTrace[];
  selected: AgentTrace | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  select: (id: string) => Promise<void>;
  rate: (id: string, rating: number, reason?: string) => Promise<void>;
}

export const useTracesStore = create<TracesState>((set, get) => ({
  traces: [],
  selected: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const traces = await api.traces.list({ limit: 50 });
      set({ traces, loading: false });
      // 刷新后保持选中同步（若被删除则清空）
      const sel = get().selected;
      set({ selected: sel ? (traces.find((t) => t.id === sel.id) ?? null) : null });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '加载失败' });
    }
  },

  select: async (id) => {
    try {
      const t = await api.traces.get(id);
      set({ selected: t });
    } catch {
      /* 详情拉取失败则保持当前 */
    }
  },

  rate: async (id, rating, reason) => {
    await api.traces.feedback(id, rating, reason);
    const feedback = { rating, reason };
    const traces = get().traces.map((t) => (t.id === id ? { ...t, feedback } : t));
    const selected = get().selected;
    set({
      traces,
      selected: selected?.id === id ? { ...selected, feedback } : selected,
    });
  },
}));
