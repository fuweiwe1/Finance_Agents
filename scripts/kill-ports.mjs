// 清理占用开发端口的残留进程（Windows）：3001 后端 / 5173 前端
// 用法：npm run kill:dev
import { execSync } from 'node:child_process';

const PORTS = ['3001', '5173'];
let out = '';
try {
  out = execSync('netstat -ano', { encoding: 'utf8', windowsHide: true });
} catch {
  console.log('netstat 不可用');
  process.exit(0);
}

const killed = new Set();
for (const line of out.split('\n')) {
  if (!line.includes('LISTENING')) continue;
  if (!PORTS.some((p) => line.includes(`:${p}`))) continue;
  const parts = line.trim().split(/\s+/);
  const pid = parts[parts.length - 1];
  if (pid && pid !== '0' && !killed.has(pid)) {
    killed.add(pid);
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', windowsHide: true });
      console.log(`已清理端口占用进程 PID ${pid}`);
    } catch {
      /* 已退出 */
    }
  }
}
if (!killed.size) console.log('无残留进程占用 3001/5173');
