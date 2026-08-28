import 'dotenv/config';
import { createApp } from './app.js';
import { createServices } from './services.js';
import { config } from './config.js';

// 单一组合根：Express 与未来的 Electron IPC 复用同一 createServices
const services = createServices({ dataFile: config.dataFile, traceFile: config.traceFile });
const app = createApp(services);

console.log(`[server] listening on http://localhost:${config.port}  (A股 · 腾讯/新浪)`);
console.log(`[server] traces: ${config.traceFile}`);
app.listen(config.port);