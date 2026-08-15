import { MarketDataError, type NewsItem } from './types.js';

/**
 * 东方财富新闻搜索（免 key，国内可达）——按股票名搜索相关新闻。
 * jsonp 接口：search-api-web.eastmoney.com/search/jsonp?cb=cb&param=...
 */
const SEARCH_URL = 'https://search-api-web.eastmoney.com/search/jsonp';

interface EastMoneyArticle {
  date?: string; // "2026-08-15 16:51:11"
  code?: string;
  title?: string; // 含 <em> 高亮标签
  content?: string; // 含 HTML 标签
  url?: string;
  mediaName?: string;
}

export async function fetchNewsByName(name: string, limit = 10): Promise<NewsItem[]> {
  const param = JSON.stringify({
    uid: '',
    keyword: name,
    type: ['cmsArticleWebOld'],
    client: 'web',
    clientType: 'web',
    clientVersion: 'curr',
    param: {
      cmsArticleWebOld: {
        searchScope: 'default',
        sort: 'time',
        pageIndex: 1,
        pageSize: limit,
        preTag: '<em>',
        postTag: '</em>',
      },
    },
  });

  const res = await fetch(`${SEARCH_URL}?cb=cb&param=${encodeURIComponent(param)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new MarketDataError(`HTTP ${res.status}`, 'eastmoney', 'network');
  const text = await res.text();

  const m = text.match(/cb\((.*)\)\s*$/s);
  if (!m) throw new MarketDataError('unexpected response shape', 'eastmoney', 'parse');
  let data: { result?: { cmsArticleWebOld?: EastMoneyArticle[] } };
  try {
    data = JSON.parse(m[1] ?? '') as typeof data;
  } catch {
    throw new MarketDataError('invalid jsonp payload', 'eastmoney', 'parse');
  }

  const items = data.result?.cmsArticleWebOld ?? [];
  return items.slice(0, limit).map((n) => ({
    id: n.code,
    symbol: name,
    title: stripTags(n.title ?? ''),
    summary: stripTags(n.content ?? '').slice(0, 200),
    source: n.mediaName,
    url: n.url,
    time: toIso(n.date),
  }));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** "2026-08-15 16:51:11"（北京时间）→ ISO */
function toIso(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr.replace(' ', 'T')}+08:00`);
  return Number.isNaN(d.getTime()) ? dateStr : d.toISOString();
}
