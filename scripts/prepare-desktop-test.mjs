// 为 Electron E2E 准备产物：build web(→web/dist) → 拷到 electron/renderer → electron-vite build(main+preload)
// 用法：node scripts/prepare-desktop-test.mjs
import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const rendererDest = resolve(root, 'electron/renderer');

console.log('[prepare] build web renderer...');
execSync('npm run build -w web', { cwd: root, stdio: 'inherit' });

console.log('[prepare] 拷贝 web/dist → electron/renderer');
rmSync(rendererDest, { recursive: true, force: true });
cpSync(resolve(root, 'web/dist'), rendererDest, { recursive: true });

console.log('[prepare] build electron main+preload...');
execSync('npx electron-vite build', { cwd: resolve(root, 'electron'), stdio: 'inherit' });
console.log('[prepare] OK');