import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

/** E2E 前清理隔离数据文件，保证每次从全新状态开始（不影响用户真实 .data） */
export default function globalSetup(): void {
  const dir = resolve(process.cwd(), 'server', '.data');
  for (const f of ['e2e-state.json', 'e2e-state.json.tmp']) {
    rmSync(resolve(dir, f), { force: true });
  }
}
