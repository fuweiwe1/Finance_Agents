import express from 'express';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { CompositeProvider } from './market/composite.js';
import { ModelManager } from './agent/models.js';
import { SessionStore } from './agent/sessions.js';
import { marketRoutes } from './api/market.routes.js';
import { watchlistRoutes } from './api/watchlist.routes.js';
import { agentRoutes } from './api/agent.routes.js';
import { config } from './config.js';

export interface AppServices {
  market?: CompositeProvider;
  models?: ModelManager;
  sessions?: SessionStore;
}

export function createApp(services: AppServices = {}): express.Express {
  const market = services.market ?? new CompositeProvider({ finnhubApiKey: config.finnhubApiKey });
  const models = services.models ?? new ModelManager();
  const sessions = services.sessions ?? new SessionStore();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'finance-agents-server', time: new Date().toISOString() });
  });

  app.use('/api/market', marketRoutes(market));
  app.use('/api/watchlist', watchlistRoutes());
  app.use('/api/agent', agentRoutes(models, market, sessions));

  // 统一错误处理（Express 5 会自动把 async 路由的 reject 转发到这里）
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] error:', err);
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: message, code: 'internal' });
  });

  return app;
}
