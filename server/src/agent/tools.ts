import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { CompositeProvider } from '../market/composite.js';

/**
 * 生成 AgentTool 结果：content 给模型看，details 给 UI 展示。
 * 抛错由 agent 运行时捕获并回传 LLM，不要吞错。
 */
function toolResult(details: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(details) }],
    details,
  };
}

interface QuoteArgs {
  symbol?: string;
}
interface FinancialsArgs {
  symbol?: string;
}
interface NewsArgs {
  symbol?: string;
  limit?: number;
}
interface KlineArgs {
  symbol?: string;
  count?: number;
}

export function buildTools(market: CompositeProvider): AgentTool<any, any>[] {
  return [
    {
      name: 'get_quote',
      label: '实时报价',
      description: '获取A股实时报价：现价、涨跌幅、今开、最高、最低、昨收、成交量、一年高低、总市值等。',
      parameters: Type.Object({
        symbol: Type.String({ description: 'A股代码，如 600519 / 000001' }),
      }),
      execute: async (_toolCallId: string, params: unknown) => {
        const p = (params ?? {}) as QuoteArgs;
        const q = await market.getQuote(String(p.symbol ?? ''));
        if (!q) throw new Error('未找到该代码的报价');
        return toolResult({
          ok: true,
          symbol: q.symbol,
          name: q.name,
          price: q.price,
          change: q.change,
          changePct: q.changePct,
          open: q.open,
          high: q.high,
          low: q.low,
          prevClose: q.prevClose,
          volume: q.volume,
          week52High: q.week52High,
          week52Low: q.week52Low,
          marketCap: q.marketCap,
          afterHoursPrice: q.afterHoursPrice,
          session: q.session,
        });
      },
    },
    {
      name: 'get_financials',
      label: '基本面/估值',
      description: '获取A股基本面：PE、PB、换手率、总市值、EPS、股息率、总股本。',
      parameters: Type.Object({
        symbol: Type.String({ description: 'A股代码，如 600519' }),
      }),
      execute: async (_toolCallId: string, params: unknown) => {
        const p = (params ?? {}) as FinancialsArgs;
        const f = await market.getFinancials(String(p.symbol ?? ''));
        if (!f) throw new Error('未找到该代码的基本面数据');
        return toolResult({
          ok: true,
          symbol: f.symbol,
          pe: f.pe,
          pb: f.pb,
          turnoverRate: f.turnoverRate,
          marketCap: f.marketCap,
          eps: f.eps,
          dividendYield: f.dividendYield,
          sharesOutstanding: f.sharesOutstanding,
          source: f.source,
        });
      },
    },
    {
      name: 'get_news',
      label: '新闻',
      description: '获取A股最近新闻标题与摘要。',
      parameters: Type.Object({
        symbol: Type.String({ description: 'A股代码，如 600519' }),
        limit: Type.Optional(Type.Number({ description: '返回条数，默认 5，最多 10' })),
      }),
      execute: async (_toolCallId: string, params: unknown) => {
        const p = (params ?? {}) as NewsArgs;
        const limit = Math.min(Math.max(Number(p.limit ?? 5) || 5, 1), 10);
        const news = await market.getNews(String(p.symbol ?? ''), limit);
        if (!news.length) {
          return toolResult({ ok: true, news: [], reason: '暂无新闻（可能未配置 Finnhub key）' });
        }
        return toolResult({
          ok: true,
          news: news.map((n) => ({ title: n.title, source: n.source, time: n.time, url: n.url })),
        });
      },
    },
    {
      name: 'get_kline',
      label: '日K线',
      description: '获取A股最近日 K 线（open/high/low/close），用于判断近期走势。',
      parameters: Type.Object({
        symbol: Type.String({ description: 'A股代码，如 600519' }),
        count: Type.Optional(Type.Number({ description: 'K线根数，默认 30，最多 120' })),
      }),
      execute: async (_toolCallId: string, params: unknown) => {
        const p = (params ?? {}) as KlineArgs;
        const count = Math.min(Math.max(Number(p.count ?? 30) || 30, 10), 120);
        const k = await market.getKline(String(p.symbol ?? ''), 'day', count);
        if (!k.length) return toolResult({ ok: true, bars: [], reason: '暂无法获取K线' });
        // 压缩：只取最近 30 根关键 OHLC，避免塞满上下文
        const bars = k.slice(-30).map((b) => ({
          date: new Date(b.ts * 1000).toISOString().slice(0, 10),
          o: b.open,
          h: b.high,
          l: b.low,
          c: b.close,
        }));
        return toolResult({ ok: true, bars });
      },
    },
    {
      name: 'get_watchlist',
      label: '自选股',
      description: '获取用户自选股列表。',
      parameters: Type.Object({}),
      execute: async () => toolResult({ ok: true, note: '当前自选由界面维护，请直接询问具体股票代码或用 get_quote 查询' }),
    },
  ];
}
