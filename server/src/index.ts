import 'dotenv/config';
import { createApp } from './app.js';
import { FileStore } from './store.js';
import { config } from './config.js';

const store = new FileStore(config.dataFile);
const app = createApp({ store });

console.log(`[server] listening on http://localhost:${config.port}  (A股 · 腾讯/新浪)`);
app.listen(config.port);
