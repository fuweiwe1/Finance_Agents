/**
 * 合并同一 tag 的重复 GitHub Release（electron-builder 多目标发布偶发把资产拆到多个同名 Release）。
 * 保留含 latest.yml 的，删除其余。在 release-desktop.yml 的 electron-builder 之后运行。
 * 环境变量：GH_TOKEN（经典 PAT，需 Release 管理权限）、GH_REPO（owner/repo）、RELEASE_TAG（如 v0.2.0）
 */
const token = process.env.GH_TOKEN;
const repo = process.env.GH_REPO || 'fuweiwe1/Finance_Agents';
const tag = process.env.RELEASE_TAG;

if (!token || !tag) {
  console.error('[cleanup-releases] 缺少 GH_TOKEN / RELEASE_TAG');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function api(path, method = 'GET', body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`gh ${method} ${path} -> ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

async function main() {
  // 分页拉取全部 Release
  const releases = [];
  for (let page = 1; ; page++) {
    const list = await api(`/repos/${repo}/releases?per_page=100&page=${page}`);
    releases.push(...list);
    if (list.length < 100) break;
  }

  const same = releases.filter((r) => r.tag_name === tag);
  if (same.length <= 1) {
    console.log(`[cleanup-releases] ${tag} 无重复（${same.length} 个），跳过`);
    return;
  }

  const keeper = same.find((r) => r.assets.some((a) => a.name === 'latest.yml')) ?? same[0];
  for (const r of same) {
    if (r.id === keeper.id) continue;
    console.log(`[cleanup-releases] 删除重复 Release ${r.id}（${r.name}，assets=${r.assets.length}）`);
    await api(`/repos/${repo}/releases/${r.id}`, 'DELETE');
  }
  console.log(`[cleanup-releases] 保留 Release ${keeper.id}（assets=${keeper.assets.length}）`);
}

main().catch((e) => {
  console.error('[cleanup-releases] 失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});