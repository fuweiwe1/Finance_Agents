import 'dotenv/config';
import { createApp } from './app.js';
import { FileStore } from './store.js';
import { config } from './config.js';

const store = new FileStore(config.dataFile);
const app = createApp({ store });

console.log(`[server] listening on http://localhost:${config.port}`);
console.log(`[server] finnhub key: ${config.hasFinnhub ? '已配置' : '未配置（估值/新闻/图表将降级）'}`);
app.listen(config.port);
