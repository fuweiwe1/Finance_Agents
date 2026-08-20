import { Router } from 'express';
import type { CompositeProvider } from '../eval/market/composite.js';
import { normalizeSymbol } from '../eval/market/normalize.js';

export function marketRoutes(market: CompositeProvider): Router {
  const r = Router();

  r.get('/quote', async (req, res) => {
    const symbol = String(req.query.symbol ?? '');
    const norm = normalizeSymbol(symbol);
    if (!norm) {
      res.status(400).json({ error: `invalid symbol: ${symbol}`, code: 'invalid_symbol' });
      return;
    }
    const q = await market.getQuote(norm.symbol);
    if (!q) {
      res.status(404).json({ error: `no data for ${norm.symbol}`, code: 'not_found' });
      return;
    }
    res.json(q);
  });

  r.get('/quotes', async (req, res) => {
    const raw = String(req.query.symbols ?? '');
    const symbols = raw.split(',').map((s) => s.trim()).filter(Boolean);
    res.json(await market.getQuotes(symbols));
  });

  r.get('/financials', async (req, res) => {
    const symbol = String(req.query.symbol ?? '');
    const norm = normalizeSymbol(symbol);
    if (!norm) {
      res.status(400).json({ error: `invalid symbol: ${symbol}`, code: 'invalid_symbol' });
      return;
    }
    const f = await market.getFinancials(norm.symbol);
    if (!f) {
      res.status(404).json({ error: `no data for ${norm.symbol}`, code: 'not_found' });
      return;
    }
    res.json(f);
  });

  r.get('/news', async (req, res) => {
    const symbol = String(req.query.symbol ?? '');
    const norm = normalizeSymbol(symbol);
    if (!norm) {
      res.status(400).json({ error: `invalid symbol: ${symbol}`, code: 'invalid_symbol' });
      return;
    }
    const limit = Math.min(Math.max(Number(req.query.limit ?? 10) || 10, 1), 30);
    res.json(await market.getNews(norm.symbol, limit));
  });

  r.get('/kline', async (req, res) => {
    const symbol = String(req.query.symbol ?? '');
    const norm = normalizeSymbol(symbol);
    if (!norm) {
      res.status(400).json({ error: `invalid symbol: ${symbol}`, code: 'invalid_symbol' });
      return;
    }
    const interval = String(req.query.interval ?? 'day');
    const count = Math.min(Math.max(Number(req.query.count ?? 120) || 120, 10), 500);
    res.json(await market.getKline(norm.symbol, interval, count));
  });

  r.get('/search', async (req, res) => {
    const symbol = String(req.query.q ?? '');
    const norm = normalizeSymbol(symbol);
    if (!norm) {
      res.json({ found: false });
      return;
    }
    const q = await market.getQuote(norm.symbol).catch(() => null);
    if (!q) {
      res.json({ found: false, symbol: norm.symbol });
      return;
    }
    res.json({ found: true, symbol: q.symbol, code: q.code, name: q.name, price: q.price, changePct: q.changePct });
  });

  return r;
}
