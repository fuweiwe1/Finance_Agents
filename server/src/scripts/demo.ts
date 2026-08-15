/**
 * 数据层演示：拉取 TSLA/AAPL/NVDA 真实行情 + 估值 + 新闻 + K线。
 * 运行：npm run demo
 */
import { CompositeProvider } from '../market/composite.js';
import { config } from '../config.js';

async function main() {
  const market = new CompositeProvider({ finnhubApiKey: config.finnhubApiKey });
  console.log(`[demo] finnhub key: ${config.hasFinnhub ? '已配置' : '未配置(估值/新闻/图表将降级)'}`);

  for (const s of ['TSLA', 'AAPL', 'NVDA']) {
    console.log(`\n=== ${s} ===`);
    const q = await market.getQuote(s);
    if (!q) {
      console.log('  (无效代码或无数据)');
      continue;
    }
    console.log(`  名称 ${q.name} (${q.code})  现价 ${q.price}  涨跌 ${q.change} (${q.changePct}%)`);
    console.log(`  开 ${q.open}  高 ${q.high}  低 ${q.low}  前收 ${q.prevClose}  量 ${q.volume}`);
    console.log(`  市值 $${fmtCap(q.marketCap)}  流通 $${fmtCap(q.marketCapFloat)}  52周 ${q.week52High}/${q.week52Low}`);
    console.log(`  股本 ${q.sharesOutstanding?.toLocaleString()}  时段 ${q.session}  盘后 ${q.afterHoursPrice ?? '—'} (${q.afterHoursChangePct?.toFixed(2) ?? '—'}%)`);

    const f = await market.getFinancials(s);
    console.log(
      `  估值(${f?.source}): PE ${f?.pe ?? '—'}  PB ${f?.pb ?? '—'}  换手 ${f?.turnoverRate?.toFixed(2) ?? '—'}%  EPS ${f?.eps ?? '—'}  股息 ${f?.dividendYield ?? '—'}%`,
    );

    const news = await market.getNews(s, 3);
    console.log(`  新闻 ${news.length} 条` + (news[0] ? `: ${news[0].title}` : ''));

    const k = await market.getKline(s, 'day', 5);
    console.log(`  日K ${k.length} 根, 最近收盘 ${k.at(-1)?.close ?? '—'}`);
  }
}

function fmtCap(cap?: number): string {
  if (cap === undefined) return '—';
  if (cap >= 1e12) return `${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `${(cap / 1e9).toFixed(1)}B`;
  return `${(cap / 1e6).toFixed(0)}M`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
