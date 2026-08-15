import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchNewsByName } from '../eastmoneyNews.js';

describe('fetchNewsByName（东方财富新闻）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('解析 jsonp 响应并剥离 HTML 标签', async () => {
    const body = `cb({"code":0,"result":{"cmsArticleWebOld":[
      {"date":"2026-08-15 16:51:11","code":"abc123","title":"<em>茅台</em>渠道改革半年考","content":"8月14日晚，<em>贵州茅台</em>披露半年报。","url":"http://finance.eastmoney.com/a/abc123.html","mediaName":"北京商报"}
    ]}})`;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
    const news = await fetchNewsByName('贵州茅台', 3);
    expect(news).toHaveLength(1);
    expect(news[0]!.title).toBe('茅台渠道改革半年考'); // <em> 已剥离
    expect(news[0]!.summary).toContain('贵州茅台');
    expect(news[0]!.source).toBe('北京商报');
    expect(news[0]!.url).toContain('abc123');
    expect(news[0]!.time).toContain('T'); // ISO 时间
  });

  it('请求失败返回空（调用方兜底）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not jsonp', { status: 200 })));
    await expect(fetchNewsByName('贵州茅台', 3)).rejects.toThrow();
  });
});
