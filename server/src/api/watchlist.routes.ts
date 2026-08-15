import { Router } from 'express';
import { normalizeSymbol } from '../market/normalize.js';

const DEFAULT_WATCHLIST = ['TSLA', 'AAPL', 'NVDA'];

/** 自选股内存存储（进程内；前端另有 localStorage 镜像做展示） */
export function watchlistRoutes(): Router {
  const r = Router();
  const list: string[] = [...DEFAULT_WATCHLIST];

  r.get('/', (_req, res) => res.json(list));

  r.post('/', (req, res) => {
    const symbol = String((req.body as { symbol?: unknown } | undefined)?.symbol ?? '');
    const norm = normalizeSymbol(symbol);
    if (!norm) {
      res.status(400).json({ error: `invalid symbol: ${symbol}`, code: 'invalid_symbol' });
      return;
    }
    if (!list.includes(norm.symbol)) list.push(norm.symbol);
    res.json(list);
  });

  r.delete('/:symbol', (req, res) => {
    const idx = list.indexOf(String(req.params.symbol).toUpperCase());
    if (idx >= 0) list.splice(idx, 1);
    res.json(list);
  });

  return r;
}
