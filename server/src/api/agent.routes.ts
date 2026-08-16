import { Router } from 'express';
import type { ModelManager } from '../agent/models.js';
import type { CompositeProvider } from '../market/composite.js';
import { SessionStore } from '../agent/sessions.js';
import { TraceCollector } from '../trace/collector.js';
import type { TraceStore } from '../trace/store.js';

export function agentRoutes(
  models: ModelManager,
  market: CompositeProvider,
  sessions: SessionStore,
  traces: TraceStore,
): Router {
  const r = Router();

  // ---- 模型配置（key 只存后端内存，不回传前端） ----
  r.get('/model-config', (_req, res) => {
    const cfg = models.getConfig();
    res.json({ provider: cfg.provider, baseUrl: cfg.baseUrl, model: cfg.model, hasKey: Boolean(cfg.apiKey) });
  });

  r.post('/model-config', (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    const provider = body?.provider === 'openai' ? 'openai' : 'custom-openai';
    const model = String(body?.model ?? '').trim();
    const baseUrl = String(body?.baseUrl ?? '').trim();
    const apiKey = String(body?.apiKey ?? '').trim();
    if (!model) {
      res.status(400).json({ error: 'model is required', code: 'bad_request' });
      return;
    }
    models.setConfig({ provider, model, baseUrl, apiKey });
    sessions.invalidateAgents();
    res.json({ ok: true, model, provider });
  });

  // ---- 会话 CRUD ----
  r.get('/sessions', (_req, res) => res.json(sessions.list()));

  r.post('/sessions', (_req, res) => res.status(201).json(sessions.create()));

  r.delete('/sessions/:id', (req, res) => {
    const ok = sessions.delete(req.params.id);
    res.status(ok ? 200 : 404).json({ ok });
  });

  // ---- 对话（SSE 流式） ----
  r.post('/sessions/:id/chat', async (req, res) => {
    const meta = sessions.get(req.params.id);
    if (!meta) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    const body = (req.body ?? {}) as { message?: unknown; context?: Record<string, unknown> };
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }
    if (!models.configured()) {
      res.status(400).json({ error: '请先在右上角配置模型 API（baseURL / model / API key）', code: 'model_not_configured' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const ctx =
      body.context && typeof body.context === 'object'
        ? {
            symbol: String(body.context.symbol ?? ''),
            name: String(body.context.name ?? ''),
            price: Number(body.context.price) || undefined,
          }
        : undefined;

    const agent = sessions.agent(meta.id, models, market);
    agent.setContext(ctx);
    const collector = new TraceCollector({
      sessionId: meta.id,
      userMessage: message,
      modelId: models.getConfig().model,
      context: ctx,
    });
    send('chat_start', {});
    try {
      await agent.prompt(message, (e) => {
        send('agent_event', e);
        collector.onEvent(e);
      });
      sessions.bumpMsgCount(meta.id);
      const usage = agent.lastUsage();
      collector.finish();
      send('chat_end', { ok: true, msgCount: meta.msgCount, usage });
    } catch (err) {
      console.error('[agent] chat error:', err);
      collector.finish(err);
      send('error', { message: err instanceof Error ? err.message : 'unknown error' });
    } finally {
      traces.append(collector.trace);
      res.end();
    }
  });

  return r;
}
