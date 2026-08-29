/**
 * 发送一张样例卡片到飞书（验证 webhook 通路）。
 * 本地：FEISHU_WEBHOOK_URL 环境变量 或 本地设置里的 webhook。
 * 云端：workflow_dispatch mode=test 时调用，FEISHU_WEBHOOK_URL 来自 Secret。
 */
import { FileStore } from '../store.js';
import { config } from '../config.js';
import { FeishuPushChannel } from '../push/feishu.js';
import type { PushCard } from '../push/channel.js';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

async function main(): Promise<void> {
  let webhookUrl = env('FEISHU_WEBHOOK_URL');
  if (!webhookUrl) {
    const store = new FileStore(config.dataFile);
    webhookUrl = store.getReportSettings()?.feishuWebhookUrl || undefined;
  }
  if (!webhookUrl) throw new Error('未找到 FEISHU_WEBHOOK_URL（环境变量或本地设置）');

  const card: PushCard = {
    title: '📡 M9 推送测试卡',
    color: 'blue',
    body: [
      '这是一张**连通性测试卡片**，用于验证日程推送到飞书的通道。',
      '若你能看到本条消息，webhook 已就绪，可以开始每日 20:00 的决策日报推送。',
      '日期：' + new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      '⚠️ 以上为模型观点，不构成投资建议。',
    ],
  };
  const channel = new FeishuPushChannel({ webhookUrl });
  const res = await channel.send([card]);
  if (!res.ok) throw new Error(`推送失败: ${res.error}`);
  console.log('[sendTestCard] 已发送测试卡片 ✓');
}

main().catch((e) => {
  console.error('[sendTestCard] 失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});