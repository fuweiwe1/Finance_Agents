import 'dotenv/config';
import { createApp } from './app.js';
import { FileStore } from './store.js';
import { TraceStore } from './trace/store.js';
import { config } from './config.js';

const store = new FileStore(config.dataFile);
const traces = new TraceStore(config.traceFile);
const app = createApp({ store, traces });

console.log(`[server] listening on http://localhost:${config.port}  (A股 · 腾讯/新浪)`);
console.log(`[server] traces: ${config.traceFile}`);
app.listen(config.port);
