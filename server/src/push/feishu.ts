import { createHmac } from 'node:crypto';
import type { PushCard, PushChannel, PushResult } from './channel.js';

/**
 * 飞书群自定义机器人 webhook 通道（无签名优先；若配置 secret 则带 HMAC-SHA256 签名）。
 * 卡片 v2：msg_type=interactive + card 属性。逐条发送，逐条校验 code===0。
 */
const HEADER_TEMPLATE: Record<string, string> = {
  blue: 'blue',
  red: 'red',
  green: 'green',
  orange: 'orange',
  grey: 'grey',
} as const;

const TIMEOUT_MS = 15_000;

export interface FeishuPushOptions {
  webhookUrl: string;
  secret?: string;
  fetchImpl?: typeof fetch;
}

export class FeishuPushChannel implements PushChannel {
  constructor(private readonly opts: FeishuPushOptions) {}

  async send(cards: PushCard[]): Promise<PushResult> {
    let lastError: string | undefined;
    for (const card of cards) {
      try {
        const payload = this.buildPayload(card);
        const res = await (this.opts.fetchImpl ?? fetch)(this.opts.webhookUrl, {
          method: 'POST',
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          lastError = `HTTP ${res.status}`;
          continue;
        }
        const body = (await res.json()) as { code?: number; msg?: string };
        if (body?.code !== 0) {
          lastError = `code=${body?.code} ${body?.msg ?? ''}`;
          continue;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    return lastError ? { ok: false, error: lastError } : { ok: true };
  }

  private buildPayload(card: PushCard): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      msg_type: 'interactive',
      card: {
        config: { wide_screen_mode: true },
        header: {
          template: HEADER_TEMPLATE[card.color] ?? 'blue',
          title: { tag: 'plain_text', content: card.title },
        },
        elements: card.body.map((md) => ({ tag: 'markdown', content: md })),
      },
    };
    if (this.opts.secret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      payload['timestamp'] = timestamp;
      payload['sign'] = hmacToBase64(this.opts.secret, `${timestamp}\n${this.opts.secret}`);
    }
    return payload;
  }
}

function hmacToBase64(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message, 'utf8').digest('base64');
}