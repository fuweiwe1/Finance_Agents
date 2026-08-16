import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 显式加载仓库根目录 .env（server/src/config.ts → ../../ = 仓库根），
// 避免 dotenv 默认只读 process.cwd()（npm workspace 下 cwd=server/）导致读不到根目录 .env。
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
dotenv.config({ path: resolve(repoRoot, '.env') });
// 兼容 cwd 下的 server/.env
dotenv.config({ path: resolve(process.cwd(), '.env') });

export const config = {
  port: Number(process.env.PORT ?? 3001),
  /** 持久化文件（自选/会话/模型配置）。生产在 index.ts 注入；测试用 null（内存） */
  dataFile: process.env.DATA_FILE ?? resolve(process.cwd(), '.data', 'app-state.json'),
  /** Agent trace 落盘（JSONL）。生产在 index.ts 注入；测试用 null */
  traceFile: process.env.TRACE_FILE ?? resolve(process.cwd(), '.data', 'traces.jsonl'),
};
