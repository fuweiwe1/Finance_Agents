import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const app = createApp();
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
