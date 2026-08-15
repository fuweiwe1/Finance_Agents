import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * E2E 前清理隔离数据文件，保证从全新状态开始（不影响用户真实 .data）。
 * 注意：请在运行 test:e2e 前确保没有残留的 `npm run dev`（否则新服务无法绑定端口）。
 */
export default function globalSetup(): void {
  const dir = resolve(process.cwd(), 'server', '.data');
  for (const f of ['e2e-state.json', 'e2e-state.json.tmp']) {
    rmSync(resolve(dir, f), { force: true });
  }
}
