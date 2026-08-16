import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

/** E2E 前清理隔离数据/追踪文件（不影响用户真实 .data）。E2E 使用独立端口，无需杀进程 */
export default function globalSetup(): void {
  const dir = resolve(process.cwd(), 'server', '.data');
  for (const f of ['e2e-state.json', 'e2e-state.json.tmp', 'e2e-traces.jsonl']) {
    rmSync(resolve(dir, f), { force: true });
  }
}
