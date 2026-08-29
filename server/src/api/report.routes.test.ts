import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { FileStore } from '../store.js';

let app: ReturnType<typeof createApp>;
let store: FileStore;

beforeEach(() => {
  store = new FileStore(null); // 内存隔离
  app = createApp({ store });
});

describe('report routes', () => {
  it('GET /api/report/settings → 默认视图（敏感项只回显布尔）', async () => {
    const res = await request(app).get('/api/report/settings').expect(200);
    expect(res.body.watchlist).toEqual([]);
    expect(typeof res.body.model.hasKey).toBe('boolean');
    expect(typeof res.body.hasPat).toBe('boolean');
    expect(typeof res.body.hasWebhookUrl).toBe('boolean');
    expect(res.body.githubRepo).toBe('fuweiwe1/Finance_Agents');
  });

  it('PUT /api/report/settings → 保存并回显；留空不覆盖原值', async () => {
    await request(app)
      .put('/api/report/settings')
      .send({
        watchlist: ['600519', '000001'],
        model: { provider: 'custom-openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: 'sk-A' },
        feishuWebhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/abc',
        pat: 'github_pat_xxx',
        githubRepo: '',
      })
      .expect(200);

    // 追踪修改不覆盖已设值
    await request(app)
      .put('/api/report/settings')
      .send({ watchlist: ['600519'], model: { provider: 'custom-openai', baseUrl: '', model: 'deepseek-chat', apiKey: '' } })
      .expect(200);

    const view = await request(app).get('/api/report/settings').expect(200);
    expect(view.body.watchlist).toEqual(['600519']);
    expect(view.body.model.model).toBe('deepseek-chat');
    expect(view.body.model.hasKey).toBe(true); // apiKey 留空 → 保持原值
    expect(view.body.hasPat).toBe(true); // pat 留空 → 保持
    expect(view.body.hasWebhookUrl).toBe(true); // webhook 留空 → 保持
  });

  it('GET /api/report/cloud-state 未配 PAT → actionsWriteOk=false（不抛）', async () => {
    const res = await request(app).get('/api/report/cloud-state').expect(200);
    expect(res.body.actionsWriteOk).toBe(false);
    expect(res.body.error).toBeTruthy();
  });

  it('POST /api/report/test-card 未配 webhook → ok=false', async () => {
    const res = await request(app).post('/api/report/test-card').expect(200);
    expect(res.body.ok).toBe(false);
  });
});