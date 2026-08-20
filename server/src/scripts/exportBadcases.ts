/**
 * 从真实对话 traces 里按低分反馈导出 bad case，合并进 bad-cases.jsonl。
 * 判定：评分 ≤ min-rating，且 1-2 分必收、3 分起需带原因/标签（默认 3）。
 * 运行：npm run export:badcases -- --min-rating=2
 */
import { dirname, resolve } from 'node:path';
import { config } from '../config.js';
import { collectLowRatingTraces, mergeBadCases } from '../eval/badcases.js';

function argNumber(name: string, def: number): number {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!a) return def;
  const n = Number(a.split('=')[1]);
  return Number.isFinite(n) ? n : def;
}

const minRating = argNumber('min-rating', 3);
const dataDir = dirname(config.dataFile);
const tracesFile = resolve(dataDir, 'traces.jsonl');
const badFile = resolve(dataDir, 'bad-cases.jsonl');

const found = collectLowRatingTraces(tracesFile, minRating);
const added = mergeBadCases(badFile, found);
console.log(`低分反馈 ${found.length} 条（评分≤${minRating}，1-2分必收/3分需原因）`);
console.log(`新增 bad case ${added} 条 → ${badFile}`);