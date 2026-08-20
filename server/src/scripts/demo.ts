/**
 * 数据层演示：拉取 A 股真实行情 + 财务 + K线。
 * 运行：npm run demo
 */
import { CompositeProvider } from '../eval/market/composite.js';

async function main() {
  const market = new CompositeProvider();
  console.log('[demo] A 股 · 腾讯(主) + 新浪(兜底)');

  for (const s of ['600519', '000001', '300750']) {
    console.log(`\n=== ${s} ===`);
    const q = await market.getQuote(s);
    if (!q) {
      console.log('  (无效代码或无数据)');
      continue;
    }
    console.log(
      `  名称 ${q.name} (${q.code})  现价 ${q.price}  涨跌 ${q.change} (${q.changePct}%)`,
    );
    console.log(`  开 ${q.open}  高 ${q.high}  低 ${q.low}  前收 ${q.prevClose}  量 ${(q.volume / 1e6).toFixed(2)}万手`);
    console.log(`  市值 ${(q.marketCap ?? 0) / 1e8}亿  一年高/低 ${q.week52High}/${q.week52Low}  股本 ${(q.sharesOutstanding ?? 0) / 1e8}亿股`);

    const f = await market.getFinancials(s);
    console.log(
      `  估值: PE ${f?.pe ?? '—'}  PB ${f?.pb ?? '—'}  换手 ${f?.turnoverRate?.toFixed(2) ?? '—'}%  EPS ${f?.eps?.toFixed(2) ?? '—'}`,
    );

    const news = await market.getNews(s, 3);
    if (news.length) {
      console.log(`  新闻 ${news.length} 条:`);
      for (const n of news) console.log(`    - [${n.source}] ${n.title}`);
    } else {
      console.log('  新闻 0 条');
    }

    const k = await market.getKline(s, 'day', 5);
    const last = k.at(-1);
    console.log(`  日K ${k.length} 根, 最近收盘 ${last?.close ?? '—'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
