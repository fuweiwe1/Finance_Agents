// 桌面打包编排：build web(→web/dist) → 拷贝到 electron/renderer → electron-vite → electron-builder --win
// 用法：npm run dist:win （在 electron-shell workspace 内）
import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const webDist = resolve(root, 'web/dist');
const rendererDest = resolve(root, 'electron/renderer');

console.log('[pack] build web renderer...');
execSync('npm run build -w web', { cwd: root, stdio: 'inherit' });

console.log('[pack] 拷贝 web/dist → electron/renderer');
rmSync(rendererDest, { recursive: true, force: true });
cpSync(webDist, rendererDest, { recursive: true });
console.log('[pack] renderer ready:', rendererDest);

console.log('[pack] build electron main+preload...');
execSync('npx electron-vite build', { cwd: resolve(root, 'electron'), stdio: 'inherit' });

console.log('[pack] electron-builder --win ...');
execSync('npx electron-builder --win', { cwd: resolve(root, 'electron'), stdio: 'inherit' });