// 桌面开发编排：先确保 web dev server(http://localhost:5173) 就绪，再启动 electron-vite dev
// 渲染层通过 ELECTRON_RENDERER_URL 指向 web dev server，最大化复用浏览器版。
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../..');
const electronDir = resolve(repoRoot, 'electron');
const rendererUrl = 'http://localhost:5173';

async function isUp(url, timeoutMs = 2000) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch {
    return false;
  }
}

function waitFor(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolvePromise, reject) => {
    const tick = async () => {
      if (await isUp(url, 1500)) return resolvePromise();
      if (Date.now() - start > timeoutMs) return reject(new Error(`wait ${url} timeout`));
      setTimeout(tick, 600);
    };
    void tick();
  });
}

let web = null;

async function main() {
  if (!(await isUp(rendererUrl))) {
    web = spawn('npm', ['run', 'dev'], { cwd: repoRoot, stdio: 'inherit', shell: true });
  }
  await waitFor(rendererUrl, 60000);

  const electron = spawn('npx', ['electron-vite', 'dev'], {
    cwd: electronDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ELECTRON_RENDERER_URL: rendererUrl },
  });

  const shutdown = () => {
    electron.kill();
    web?.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  electron.on('exit', () => {
    web?.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  web?.kill();
  process.exit(1);
});