import express from 'express';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { createServices, type ServicesOptions } from './services.js';
import { marketRoutes } from './api/market.routes.js';
import { watchlistRoutes } from './api/watchlist.routes.js';
import { agentRoutes } from './api/agent.routes.js';
import { tracesRoutes } from './api/traces.routes.js';

/** 兼容旧签名：等价 ServicesOptions */
export type AppServices = ServicesOptions;

export function createApp(services: AppServices = {}): express.Express {
  // 组合根：传输无关业务层（Express 只是薄适配，Electron IPC 复用同一 createServices）
  const { store, traces, market, models, sessions } = createServices(services);

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'finance-agents-server', time: new Date().toISOString() });
  });

  app.use('/api/market', marketRoutes(market));
  app.use('/api/watchlist', watchlistRoutes(store));
  app.use('/api/agent', agentRoutes(models, market, sessions, traces));
  app.use('/api/traces', tracesRoutes(traces));

  // 统一错误处理（Express 5 会自动把 async 路由的 reject 转发到这里）
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] error:', err);
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: message, code: 'internal' });
  });

  return app;
}