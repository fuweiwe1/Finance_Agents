import { useNews } from '../../hooks/usePolling';
import { fmtTime } from '../../lib/format';

export function NewsTab({ symbol }: { symbol: string }) {
  const news = useNews(symbol, 20);

  if (news === null) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="py-6 text-center text-sm text-slate-400">加载中…</p>
      </div>
    );
  }

  if (!news.length) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="py-6 text-center text-sm text-slate-400">
          暂无新闻。配置 Finnhub API key 后可拉取公司新闻。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">News · {symbol}</h3>
      <ul className="divide-y divide-slate-100">
        {news.map((n) => (
          <li key={n.id ?? n.url ?? n.title} className="py-2.5">
            <a href={n.url} target="_blank" rel="noreferrer" className="group block">
              <h4 className="text-sm font-medium text-slate-800 group-hover:text-blue-600">{n.title}</h4>
              {n.summary && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.summary}</p>}
              <span className="mt-1 block text-[11px] text-slate-400">
                {n.source} · {fmtTime(n.time)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
