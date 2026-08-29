/**
 * M9 每日决策仪表盘 · 无头运行入口（本地干跑 & GitHub Actions 云端共用）。
 *
 * 运行模式：
 *   本地干跑：  npx tsx src/scripts/dailyReport.ts --dry --watchlist 600519 --date 2026-08-28
 *   云端：      由 .github/workflows/daily-report.yml 以 env 注入驱动（见下）。
 *
 * 环境变量（云端必填，本地可选）：
 *   REPORT_WATCHLIST      报告清单，逗号分隔代码
 *   REPORT_MODEL_*        独立报告模型 provider/baseUrl/model/key（缺省回退本地聊天模型）
 *   FEISHU_WEBHOOK_URL    飞书 webhook（--dry 时不发；云端来自 Secret）
 *   REPORT_DATE           指定日期 YYYY-MM-DD（默认北京时间今天；测节假日/指定日）
 *   REPORT_DRY            1 → 只在控制台打印卡片，不推送
 *   GH_TOKEN / GH_REPO    写回 REPORT_LAST_STATUS 变量（云端 runner 注入 github.token）
 */
import { FileStore } from '../store.js';
import { config } from '../config.js';
import { ModelManager, buildModels, type ModelConfig } from '../agent/models.js';
import { CompositeProvider } from '../eval/market/composite.js';
import { isTradingDay, hasTradingBarOnDate } from '../report/tradingDay.js';
import { runReports } from '../report/runner.js';
import { buildOverviewCard, buildDashboardCards, type OverviewEntry } from '../report/assembler.js';
import { FeishuPushChannel } from '../push/feishu.js';

interface CliArgs {
  dry: boolean;
  watchlist: string[];
  date?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { dry: false, watchlist: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--dry') out.dry = true;
    else if (a === '--watchlist') out.watchlist = String(argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--date') out.date = String(argv[++i] ?? '');
    else if (a.startsWith('--watchlist=')) out.watchlist = a.slice('--watchlist='.length).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--date=')) out.date = a.slice('--date='.length);
  }
  return out;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/** 北京时间今天的 YYYY-MM-DD */
function beijingYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function buildReportModel(): ModelConfig {
  const provider = (env('REPORT_MODEL_PROVIDER') ?? 'custom-openai') as 'custom-openai' | 'openai';
  return {
    provider,
    baseUrl: env('REPORT_MODEL_BASE_URL') ?? '',
    model: env('REPORT_MODEL_NAME') ?? '',
    apiKey: env('REPORT_MODEL_KEY') ?? '',
  };
}

function resolveModels(): ModelManager {
  const reportCfg = buildReportModel();
  if (reportCfg.model && reportCfg.apiKey) {
    return new ModelManager({ models: buildModels(reportCfg), config: reportCfg });
  }
  // 本地干跑：回退聊天模型（app-state.json 已有配置）
  const store = new FileStore(config.dataFile);
  const mm = new ModelManager({ store });
  if (!mm.configured()) {
    throw new Error('未配置模型：本地请先在界面配置聊天模型，或设置 REPORT_MODEL_NAME/REPORT_MODEL_KEY 环境变量。');
  }
  return mm;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dry = args.dry || env('REPORT_DRY') === '1';

  const watchlist = args.watchlist.length
    ? args.watchlist
    : (env('REPORT_WATCHLIST')?.split(',').map((s) => s.trim()).filter(Boolean) ?? []);
  if (!watchlist.length) throw new Error('REPORT_WATCHLIST 为空');

  const ymd = args.date ?? env('REPORT_DATE') ?? beijingYmd();
  const day = new Date(`${ymd}T00:00:00+08:00`);

  const market = new CompositeProvider();

  // 交易日门：日历优先，兜底用行情核验（节假日无当日 K 线 → 跳过）
  const td = await isTradingDay(day);
  let isTrading = td.isTradingDay;
  let gateSource: string = td.source;
  if (isTrading && td.source === 'weekday-fallback') {
    isTrading = await hasTradingBarOnDate(day, market);
    gateSource = isTrading ? 'market-bar' : 'market-bar:no-bar';
  }
  console.log(`[dailyReport] 日期 ${ymd} · 交易日判定: ${isTrading} (${gateSource}) · 清单 ${watchlist.length} 只 · dry=${dry}`);
  if (!isTrading) {
    console.log('[dailyReport] 非交易日，跳过。');
    process.exit(0);
  }

  const models = resolveModels();
  console.log(`[dailyReport] 模型 ${models.getConfig().model}`);

  const results = await runReports(models, market, watchlist, {
    concurrency: 4,
    onLog: (line) => console.log(line),
  });

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log(`[dailyReport] 成功 ${ok.length}/${results.length}，失败 ${failed.length}`);

  const entries: OverviewEntry[] = [];
  for (const r of ok) entries.push({ symbol: r.symbol, report: r.report! });
  // 失败个股在概览卡用行内占位
  const overview = buildOverviewCard(entries);
  if (failed.length) {
    overview.body.push(`⚠️ ${failed.length} 只生成失败：${failed.map((f) => `${f.symbol}(${f.error ?? '未知'})`).join('，')}`);
  }

  const cards = [overview];
  for (const r of ok) cards.push(...buildDashboardCards(r.report!, r.symbol));

  if (dry) {
    console.log('\n===== 概览卡 =====');
    console.log(JSON.stringify(overview, null, 2));
    console.log(`\n===== 仪表盘卡（${ok.length} 只 → ${cards.length - 1} 张）=====`);
    for (const r of ok) console.log(`\n--- ${r.symbol} ---\n${JSON.stringify(buildDashboardCards(r.report!, r.symbol), null, 2)}`);
    console.log('\n[dailyReport] dry 模式：未推送。');
    return;
  }

  const webhookUrl = env('FEISHU_WEBHOOK_URL');
  if (!webhookUrl) throw new Error('FEISHU_WEBHOOK_URL 未设置');
  const channel = new FeishuPushChannel({ webhookUrl });
  const push = await channel.send(cards);
  if (!push.ok) throw new Error(`飞书推送失败: ${push.error}`);

  console.log(`[dailyReport] 已推送 ${cards.length} 张卡片 → 飞书 ✓`);
  // 运行状态不在此写 GitHub 变量（GITHUB_TOKEN 无该权限）；由应用侧读取最新 workflow run 展示。
}

main().catch((e) => {
  console.error('[dailyReport] 失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});