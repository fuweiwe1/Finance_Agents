import { useNews } from '../../hooks/usePolling';
import { fmtTime } from '../../lib/format';

export function NewsTab({ symbol }: { symbol: string }) {
  const news = useNews(symbol, 20);

  if (news === null) {
    return (
      <div className="card p-4">
        <p className="py-6 text-center text-sm text-ink-faint">加载中…</p>
      </div>
    );
  }

  if (!news.length) {
    return (
      <div className="card p-4">
        <p className="py-6 text-center text-sm text-ink-faint">暂无相关新闻。</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="eyebrow mb-2">News · {symbol}</h3>
      <ul className="divide-y divide-line/70">
        {news.map((n) => (
          <li key={n.id ?? n.url ?? n.title} className="py-2.5">
            <a href={n.url} target="_blank" rel="noreferrer" className="group block">
              <h4 className="text-sm font-medium text-ink transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:text-accent">{n.title}</h4>
              {n.summary && <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{n.summary}</p>}
              <span className="mt-1 block text-[11px] text-ink-faint">
                {n.source} · {fmtTime(n.time)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
