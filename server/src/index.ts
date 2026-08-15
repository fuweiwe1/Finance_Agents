import 'dotenv/config';
import { createApp } from './app.js';
import { FileStore } from './store.js';
import { config } from './config.js';

const store = new FileStore(config.dataFile);
const app = createApp({ store });

app.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
});
