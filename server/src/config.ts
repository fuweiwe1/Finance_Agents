import 'dotenv/config';
import { resolve } from 'node:path';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  finnhubApiKey: process.env.FINNHUB_API_KEY ?? '',
  hasFinnhub: Boolean(process.env.FINNHUB_API_KEY),
  /** 持久化文件（自选/会话/模型配置）。生产在 index.ts 注入；测试用 null（内存） */
  dataFile: process.env.DATA_FILE ?? resolve(process.cwd(), '.data', 'app-state.json'),
};
