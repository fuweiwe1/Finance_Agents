/**
 * GitHub 仓库 REST 客户端（只操作 Actions 变量 / 工作流分发，外加 Secret 元数据探测）。
 * - 变量（Vars）：报告清单 / 报告模型 provider·baseUrl·model / 最近状态——明文，App 用 PAT 直写。
 * - Secrets：模型 key 与飞书 webhook 因 GitHub 要求 libsodium 加密（本地无法装），走「网页手动添加」，
 *   本模块只负责探测是否已存在（列表元数据不含值）。
 * - 工作流分发：测试卡片 / 手动触发用。
 */
const API_BASE = 'https://api.github.com';
const ACCEPT = 'application/vnd.github+json';
const API_VERSION = '2022-11-28';
const TIMEOUT_MS = 15_000;

export interface RepoRef {
  token: string;
  /** 'owner/repo' */
  repo: string;
}

export class GithubError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'GithubError';
  }
}

interface GhOptions {
  token: string;
  repo: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

async function gh<T>(opts: GhOptions, method: string, path: string, body?: unknown): Promise<T> {
  const base = opts.baseUrl ?? API_BASE;
  const res = await (opts.fetchImpl ?? fetch)(`${base}${path}`, {
    method,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: ACCEPT,
      'X-GitHub-Api-Version': API_VERSION,
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j?.message) detail = `${detail}: ${j.message}`;
    } catch {
      /* ignore */
    }
    throw new GithubError(detail, res.status);
  }
  if (res.status === 204 || res.status === 201) {
    // 204 无正文；201 对有返回的接口仍走 json
    if (res.status === 204) return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ---- 变量（Variables） ----

interface RepoVariable {
  name: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

export async function getVariable(ref: RepoRef, name: string, opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): Promise<string | undefined> {
  const path = `/repos/${ref.repo}/actions/variables/${encodeURIComponent(name)}`;
  try {
    const v = await gh<RepoVariable>({ token: ref.token, repo: ref.repo, ...opts }, 'GET', path);
    return v?.value;
  } catch (err) {
    if (err instanceof GithubError && err.httpStatus === 404) return undefined;
    throw err;
  }
}

/** 有则 PATCH，无则 POST（创建）。 */
export async function setVariable(ref: RepoRef, name: string, value: string, opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): Promise<void> {
  const path = `/repos/${ref.repo}/actions/variables/${encodeURIComponent(name)}`;
  const existing = await getVariable(ref, name, opts).catch(() => undefined);
  const mk = { token: ref.token, repo: ref.repo, ...opts } as GhOptions;
  if (existing !== undefined) {
    await gh(mk, 'PATCH', path, { name, value });
  } else {
    await gh(mk, 'POST', `/repos/${ref.repo}/actions/variables`, { name, value });
  }
}

// ---- Secrets（只探测元数据，不写值） ----

export interface SecretMeta {
  name: string;
  created_at: string;
}

export async function listSecrets(ref: RepoRef, opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): Promise<SecretMeta[]> {
  const res = await gh<{ secrets?: SecretMeta[] }>(
    { token: ref.token, repo: ref.repo, ...opts },
    'GET',
    `/repos/${ref.repo}/actions/secrets`,
  );
  return res?.secrets ?? [];
}

// ---- 工作流分发 ----

export async function dispatchWorkflow(
  ref: RepoRef,
  workflowFileName: string,
  inputs: Record<string, string>,
  opts: { baseUrl?: string; fetchImpl?: typeof fetch; ref?: string } = {},
): Promise<void> {
  await gh(
    { token: ref.token, repo: ref.repo, ...opts },
    'POST',
    `/repos/${ref.repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/dispatches`,
    { ref: opts.ref ?? 'main', inputs },
  );
}

// ---- 权限探针 ----

export async function probeActionsWrite(ref: RepoRef, opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): Promise<{ ok: boolean; error?: string }> {
  try {
    await listSecrets(ref, opts);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, error: msg };
  }
}

/** 探测报告所需的仓库实体当前是否就绪（供设置页展示）。 */
export async function probeReportCloudState(
  ref: RepoRef,
  opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<{
  actionsWriteOk: boolean;
  error?: string;
  variables: Partial<Record<string, string | undefined>>;
  secretsReady: { modelKey: boolean; webhookUrl: boolean };
}> {
  const probe = await probeActionsWrite(ref, opts);
  const variables: Record<string, string | undefined> = {};
  const names = ['REPORT_WATCHLIST', 'REPORT_MODEL_PROVIDER', 'REPORT_MODEL_BASE_URL', 'REPORT_MODEL_NAME', 'REPORT_LAST_STATUS', 'REPORT_LAST_DATE'] as const;
  if (probe.ok) {
    for (const n of names) {
      variables[n] = await getVariable(ref, n, opts).catch(() => undefined);
    }
  }
  const secrets = probe.ok ? await listSecrets(ref, opts).catch(() => [] as SecretMeta[]) : [];
  const secretNames = new Set(secrets.map((s) => s.name));
  return {
    actionsWriteOk: probe.ok,
    error: probe.error,
    variables: variables as Partial<Record<string, string | undefined>>,
    secretsReady: {
      modelKey: secretNames.has('REPORT_MODEL_KEY'),
      webhookUrl: secretNames.has('FEISHU_WEBHOOK_URL'),
    },
  };
}