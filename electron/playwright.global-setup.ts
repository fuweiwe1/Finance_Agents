import { execSync } from 'node:child_process';

/** E2E 前清掉残留的打包应用实例（避免单实例锁导致被测实例退出） */
export default function globalSetup(): void {
  try {
    execSync('taskkill /F /IM "Finance Agents.exe"', { stdio: 'ignore', windowsHide: true });
  } catch {
    /* 无实例则忽略 */
  }
}