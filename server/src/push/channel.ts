/**
 * 推送通道抽象：M9 一期只有飞书；接口预留企微/钉钉/带图（升级飞书应用）的二期适配。
 */

export type PushCardColor = 'blue' | 'red' | 'green' | 'orange' | 'grey';

/** 通道无关的卡片：标题 + 颜色 + 若干 markdown 块。 */
export interface PushCard {
  title: string;
  color: PushCardColor;
  body: string[];
}

export interface PushResult {
  ok: boolean;
  /** 失败时首条错误 */
  error?: string;
}

export interface PushChannel {
  send(cards: PushCard[]): Promise<PushResult>;
}