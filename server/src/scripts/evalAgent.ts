/**
 * Agent 评测 runner：用已配置的真实模型批量重放 EVAL_CASES，
 * 检查工具调用正确性/数字一致性/免责声明/违禁词，输出 PASS/FAIL 报告；
 * 失败用例导出到 server/.data/bad-cases.jsonl 供迭代。
 * 运行：npm run eval:agent
 */
import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FileStore } from '../store.js';
import { ModelManager } from '../agent/models.js';
import { CompositeProvider } from '../eval/market/composite.js';
import { EVAL_CASES } from '../eval/cases.js';
import { runCase } from '../eval/runner.js';
import { appendRun, compareWithPrevious, readRuns, type EvalRunSummary } from '../eval/history.js';
import { loadBadCases } from '../eval/badcases.js';
import { config } from '../config.js';

async function main(): Promise<void> {
  const store = new FileStore(config.dataFile);
  const models = new ModelManager({ store });
  if (!models.configured()) {
    console.error('❌ 未配置模型 API。请先在界面右上角配置模型后重试。');
    process.exit(1);
  }
  const market = new CompositeProvider();

  // 吸收历史 bad case（去重 + 上限），让评测覆盖真实踩过的坑
  const badFile = resolve(dirname(config.dataFile), 'bad-cases.jsonl');
  const badCases = loadBadCases(badFile, 15);
  const allCases = [...EVAL_CASES, ...badCases];
  console.log(`[eval] 模型 ${models.getConfig().model} · ${allCases.length} 个用例${badCases.length ? `（含 ${badCases.length} 条历史 bad case）` : ''}`);

  const results = [];
  for (const c of allCases) {
    process.stdout.write(`▶ ${c.id}: ${c.message} ... `);
    const r = await runCase(models, market, c);
    results.push(r);
    console.log(r.pass ? '✅ PASS' : '❌ FAIL');
    for (const ch of r.checks) {
      if (!ch.pass) console.log(`    ✗ ${ch.name}${ch.detail ? ` — ${ch.detail}` : ''}`);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const avgLatency = results.reduce((a, r) => a + r.latencyMs, 0) / results.length;
  const totalTokensIn = results.reduce((a, r) => a + r.trace.turns.reduce((x, t) => x + (t.inputTokens ?? 0), 0), 0);
  const totalTokensOut = results.reduce((a, r) => a + r.trace.turns.reduce((x, t) => x + (t.outputTokens ?? 0), 0), 0);
  const totalCost = results.reduce((a, r) => a + r.trace.turns.reduce((x, t) => x + (t.cost ?? 0), 0), 0);
  console.log('\n===== 评测汇总 =====');
  console.log(`PASS ${passed}/${results.length}  ${passed === results.length ? '🎉' : ''}`);
  console.log(`平均耗时 ${(avgLatency / 1000).toFixed(1)}s · tokens ${totalTokensIn}→${totalTokensOut} · 成本 $${totalCost.toFixed(4)}`);

  const bads = results.filter((r) => !r.pass);
  if (bads.length) {
    const out = resolve(dirname(config.dataFile), 'bad-cases.jsonl');
    appendFileSync(
      out,
      bads.map((b) => JSON.stringify({ caseId: b.caseId, ts: new Date().toISOString(), trace: b.trace })).join('\n') +
        '\n',
      'utf8',
    );
    console.log(`已导出 ${bads.length} 条 bad case → ${out}`);
  }

  // 记录历史 + 对比上次（迭代回归对比）
  const summary: EvalRunSummary = {
    ts: new Date().toISOString(),
    model: models.getConfig().model,
    total: results.length,
    passed,
    avgLatencyMs: avgLatency,
    totalTokensIn,
    totalTokensOut,
    totalCost,
    perCase: results.map((r) => ({ caseId: r.caseId, pass: r.pass, latencyMs: r.latencyMs })),
  };
  const historyFile = resolve(dirname(config.dataFile), 'eval-history.jsonl');
  const runs = readRuns(historyFile);
  const prev = runs[runs.length - 1];
  appendRun(historyFile, summary);
  if (prev) {
    const cmp = compareWithPrevious(summary, prev);
    const arrow = (d: number) => (d > 0 ? '▲' : d < 0 ? '▼' : '＝');
    console.log('\n===== 对比上次 =====');
    console.log(`PASS ${passed}/${results.length} ${arrow(cmp.passDelta)} (上次 ${prev.passed}/${prev.total})`);
    console.log(`平均耗时 ${(avgLatency / 1000).toFixed(1)}s ${arrow(-cmp.latencyDeltaMs)} (上次 ${(prev.avgLatencyMs / 1000).toFixed(1)}s)`);
    console.log(`成本 $${totalCost.toFixed(4)} ${arrow(-cmp.costDelta)} (上次 $${prev.totalCost.toFixed(4)})`);
    if (cmp.regressed.length) console.log(`⚠️ 回归: ${cmp.regressed.join(', ')}`);
    if (cmp.improved.length) console.log(`✅ 改善: ${cmp.improved.join(', ')}`);
    console.log(`历史 ${runs.length} 次 → ${historyFile}`);
  }

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
