/**
 * 评测历史趋势汇总：读取 .data/eval-history.jsonl，打印每次运行的 pass rate/耗时/tokens/成本。
 * 运行：npm run eval:summary
 */
import { dirname, resolve } from 'node:path';
import { readRuns } from '../eval/history.js';
import { config } from '../config.js';

function main(): void {
  const historyFile = resolve(dirname(config.dataFile), 'eval-history.jsonl');
  const runs = readRuns(historyFile);
  if (!runs.length) {
    console.log('暂无评测历史。先运行 `npm run eval:agent` 至少一次。');
    return;
  }
  console.log(`===== 评测历史趋势（${runs.length} 次）=====`);
  console.log('#  | 时间              | 模型              | PASS    | 平均耗时 | tokens(in→out) | 成本');
  runs.forEach((r, i) => {
    const line = `${String(i + 1).padStart(2)} | ${r.ts.slice(0, 16)}  | ${(r.model ?? '').padEnd(17)} | ${String(r.passed).padStart(2)}/${r.total} | ${(r.avgLatencyMs / 1000).toFixed(1).padStart(6)}s | ${String(r.totalTokensIn).padStart(6)}→${String(r.totalTokensOut).padEnd(6)} | $${r.totalCost.toFixed(4)}`;
    console.log(line);
  });
  // 首末对比
  const first = runs[0];
  const last = runs[runs.length - 1];
  if (first && last && first !== last) {
    console.log('\n首末对比:');
    console.log(`  PASS ${first.passed}/${first.total} → ${last.passed}/${last.total}`);
    console.log(`  平均耗时 ${(first.avgLatencyMs / 1000).toFixed(1)}s → ${(last.avgLatencyMs / 1000).toFixed(1)}s`);
    console.log(`  成本 $${first.totalCost.toFixed(4)} → $${last.totalCost.toFixed(4)}`);
  }
}

main();
