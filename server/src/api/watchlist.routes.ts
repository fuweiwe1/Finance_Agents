import { Router } from 'express';
import { FileStore } from '../store.js';
import { normalizeSymbol } from '../eval/market/normalize.js';

/** 自选股：内存数组 + FileStore 持久化（重启不丢） */
export function watchlistRoutes(store: FileStore): Router {
  const r = Router();
  const list: string[] = [...store.getWatchlist()];

  const persist = () => store.setWatchlist(list);

  r.get('/', (_req, res) => res.json(list));

  r.post('/', (req, res) => {
    const symbol = String((req.body as { symbol?: unknown } | undefined)?.symbol ?? '');
    const norm = normalizeSymbol(symbol);
    if (!norm) {
      res.status(400).json({ error: `invalid symbol: ${symbol}`, code: 'invalid_symbol' });
      return;
    }
    if (!list.includes(norm.symbol)) list.push(norm.symbol);
    persist();
    res.json(list);
  });

  r.delete('/:symbol', (req, res) => {
    const idx = list.indexOf(String(req.params.symbol).toUpperCase());
    if (idx >= 0) list.splice(idx, 1);
    persist();
    res.json(list);
  });

  return r;
}
