import { describe, it, expect } from 'vitest';
import { getVariable, setVariable, listSecrets, dispatchWorkflow, probeActionsWrite, probeReportCloudState, latestWorkflowRun, GithubError } from '../github.js';

const REF = { token: 'pat', repo: 'fuweiwe1/Finance_Agents' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('github transport', () => {
  it('getVariable 404 → undefined', async () => {
    const fn = (async (_i: unknown, _o?: unknown) => new Response('not found', { status: 404 })) as typeof fetch;
    expect(await getVariable(REF, 'X', { fetchImpl: fn })).toBeUndefined();
  });

  it('getVariable 命中 → 值', async () => {
    const fn = (async (_i: unknown, _o?: unknown) =>
      jsonResponse({ name: 'X', value: 'abc' })) as typeof fetch;
    expect(await getVariable(REF, 'X', { fetchImpl: fn })).toBe('abc');
  });

  it('setVariable 更新（先 GET 后 PATCH）', async () => {
    let methodSeen: string | undefined;
    const fn = (async (input: unknown, init?: { method?: string }) => {
      methodSeen = init?.method ?? 'GET';
      const url = String(input);
      if (url.endsWith('/X')) {
        if ((init?.method ?? 'GET') === 'GET') return jsonResponse({ name: 'X', value: 'old' });
        return jsonResponse({});
      }
      return jsonResponse({});
    }) as typeof fetch;
    await setVariable(REF, 'X', 'new', { fetchImpl: fn });
    expect(methodSeen).toBe('PATCH');
  });

  it('setVariable 创建（不存在 → POST）', async () => {
    let methodSeen: string | undefined;
    const fn = (async (input: unknown, init?: { method?: string }) => {
      methodSeen = init?.method ?? 'GET';
      const url = String(input);
      if (url.endsWith('/X')) return new Response('not found', { status: 404 });
      return jsonResponse({});
    }) as typeof fetch;
    await setVariable(REF, 'X', 'new', { fetchImpl: fn });
    expect(methodSeen).toBe('POST');
  });

  it('listSecrets 解析元数据', async () => {
    const fn = (async (_i: unknown, _o?: unknown) =>
      jsonResponse({ secrets: [{ name: 'REPORT_MODEL_KEY', created_at: '2026-01-01T00:00:00Z' }] })) as typeof fetch;
    const s = await listSecrets(REF, { fetchImpl: fn });
    expect(s.map((x) => x.name)).toEqual(['REPORT_MODEL_KEY']);
  });

  it('dispatchWorkflow POST 到正确路径', async () => {
    let seen = '';
    const fn = (async (input: unknown, init?: { method?: string }) => {
      seen = `${init?.method ?? ''} ${String(input)}`;
      return jsonResponse({});
    }) as typeof fetch;
    await dispatchWorkflow(REF, 'daily-report.yml', { mode: 'test' }, { fetchImpl: fn });
    expect(seen).toContain('POST');
    expect(seen).toContain('/actions/workflows/daily-report.yml/dispatches');
  });

  it('非 2xx → GithubError', async () => {
    const fn = (async (_i: unknown, _o?: unknown) => jsonResponse({ message: 'nope' }, 403)) as typeof fetch;
    await expect(listSecrets(REF, { fetchImpl: fn })).rejects.toBeInstanceOf(GithubError);
  });

  it('probeActionsWrite 失败态', async () => {
    const fn = (async (_i: unknown, _o?: unknown) => jsonResponse({}, 403)) as typeof fetch;
    const p = await probeActionsWrite(REF, { fetchImpl: fn });
    expect(p.ok).toBe(false);
  });

  it('latestWorkflowRun 解析最近一次运行', async () => {
    const fn = (async (_i: unknown, _o?: unknown) =>
      jsonResponse({
        workflow_runs: [
          { id: 42, status: 'completed', conclusion: 'success', display_title: '自选股每日决策仪表盘推送', created_at: '2026-08-29T12:00:00Z', html_url: 'https://github.com/run/42', head_sha: 'abc1234' },
        ],
      })) as typeof fetch;
    const r = await latestWorkflowRun(REF, 'daily-report.yml', { fetchImpl: fn });
    expect(r?.id).toBe(42);
    expect(r?.conclusion).toBe('success');
    expect(r?.displayTitle).toContain('仪表盘');
  });

  it('latestWorkflowRun 无运行 → null', async () => {
    const fn = (async (_i: unknown, _o?: unknown) => jsonResponse({ workflow_runs: [] })) as typeof fetch;
    expect(await latestWorkflowRun(REF, 'daily-report.yml', { fetchImpl: fn })).toBeNull();
  });

  it('probeReportCloudState 汇总', async () => {
    const fn = (async (input: unknown, _init?: { method?: string }) => {
      const url = String(input);
      if (url.endsWith('/actions/secrets')) {
        return jsonResponse({ secrets: [{ name: 'REPORT_MODEL_KEY', created_at: 'x' }] });
      }
      if (url.includes('/actions/variables/REPORT_WATCHLIST')) return jsonResponse({ name: 'REPORT_WATCHLIST', value: '600519' });
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const st = await probeReportCloudState(REF, { fetchImpl: fn });
    expect(st.actionsWriteOk).toBe(true);
    expect(st.variables.REPORT_WATCHLIST).toBe('600519');
    expect(st.secretsReady.modelKey).toBe(true);
    expect(st.secretsReady.webhookUrl).toBe(false);
  });
});