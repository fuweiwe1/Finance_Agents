import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { ModelManager } from '../agent/models.js';
import { SessionStore } from '../agent/sessions.js';

describe('Agent API（会话 + 模型配置，不依赖真实模型）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('模型配置 GET/POST（key 不回传）', async () => {
    const models = new ModelManager();
    const app = createApp({ models, sessions: new SessionStore() });

    const initial = await request(app).get('/api/agent/model-config');
    expect(initial.status).toBe(200);
    expect(initial.body.hasKey).toBe(false);

    const save = await request(app)
      .post('/api/agent/model-config')
      .send({ provider: 'custom-openai', baseUrl: 'http://localhost:11434/v1', model: 'qwen3:32b', apiKey: 'sk-test' });
    expect(save.status).toBe(200);
    expect(save.body.ok).toBe(true);

    const after = await request(app).get('/api/agent/model-config');
    expect(after.body.hasKey).toBe(true);
    expect(after.body.apiKey).toBeUndefined(); // key 不出接口
  });

  it('模型配置缺 model → 400', async () => {
    const app = createApp({ models: new ModelManager(), sessions: new SessionStore() });
    const res = await request(app).post('/api/agent/model-config').send({ provider: 'custom-openai' });
    expect(res.status).toBe(400);
  });

  it('会话 CRUD', async () => {
    const app = createApp({ models: new ModelManager(), sessions: new SessionStore() });

    const list0 = await request(app).get('/api/agent/sessions');
    expect(list0.body).toEqual([]);

    const create = await request(app).post('/api/agent/sessions');
    expect(create.status).toBe(201);
    const id = create.body.id as string;
    expect(create.body.msgCount).toBe(0);

    const list1 = await request(app).get('/api/agent/sessions');
    expect(list1.body.length).toBe(1);

    const del = await request(app).delete(`/api/agent/sessions/${id}`);
    expect(del.body.ok).toBe(true);
    expect((await request(app).get('/api/agent/sessions')).body.length).toBe(0);
  });

  it('未配置模型时发消息 → 400 model_not_configured', async () => {
    const app = createApp({ models: new ModelManager(), sessions: new SessionStore() });
    const create = await request(app).post('/api/agent/sessions');
    const id = create.body.id as string;
    const chat = await request(app).post(`/api/agent/sessions/${id}/chat`).send({ message: 'hi' });
    expect(chat.status).toBe(400);
    expect(chat.body.code).toBe('model_not_configured');
  });

  it('消息为空 → 400', async () => {
    const app = createApp({ models: new ModelManager(), sessions: new SessionStore() });
    const create = await request(app).post('/api/agent/sessions');
    const id = create.body.id as string;
    const chat = await request(app).post(`/api/agent/sessions/${id}/chat`).send({ message: '  ' });
    expect(chat.status).toBe(400);
  });
});
