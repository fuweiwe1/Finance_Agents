import { Router } from 'express';
import { TraceStore } from '../trace/store.js';

export function tracesRoutes(store: TraceStore): Router {
  const r = Router();

  r.get('/', (req, res) => {
    const q = req.query.outcome;
    res.json(
      store.list({
        sessionId: req.query.sessionId ? String(req.query.sessionId) : undefined,
        outcome: q === 'error' || q === 'ok' ? q : undefined,
        limit: Math.min(Math.max(Number(req.query.limit ?? 50) || 50, 1), 200),
        offset: Math.max(Number(req.query.offset ?? 0) || 0, 0),
      }),
    );
  });

  r.get('/:id', (req, res) => {
    const t = store.get(req.params.id);
    if (!t) {
      res.status(404).json({ error: 'trace not found', code: 'not_found' });
      return;
    }
    res.json(t);
  });

  r.post('/:id/feedback', (req, res) => {
    const body = (req.body ?? {}) as { rating?: unknown; reason?: unknown; reasons?: unknown };
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'rating must be integer 1-5', code: 'bad_request' });
      return;
    }
    const reasons = Array.isArray(body.reasons)
      ? body.reasons.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 10)
      : undefined;
    const ok = store.setFeedback(req.params.id, {
      rating,
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined,
      reasons,
    });
    if (!ok) {
      res.status(404).json({ error: 'trace not found', code: 'not_found' });
      return;
    }
    res.json({ ok: true });
  });

  return r;
}
