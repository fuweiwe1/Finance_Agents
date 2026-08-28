# finance_agents — Electron 桌面端改造（实施计划）(M8)

> 状态：**已批准，待 goal 模式执行**（2026-08-2x）
> 用户目标：把现有"Web 三栏工作台"改造成**可分发的 Windows 桌面应用**，并建立桌面端测试集。

---

## Context（为什么做）

当前 `finance_agents/web/`（React+Vite）+ `server/`（Express + Pi Agent SDK）是浏览器三栏工作台，已有 M0–M7：
数据层(A股，腾讯/新浪/东财)、Agent 对话、观测/评测闭环(78+ 测试、E2E)。

用户要把产品做成**桌面端应用分发**。经 grilling 收敛的决策见下表，均为已确认前提。

### 已确认决策（grilling 结论）

| # | 决策 | 结论 |
|---|---|---|
| 目标定位 | 桌面**分发**应用（打包安装包给别人用），本地个人决策助手 | Q1=B |
| 传输模型 | **IPC（去 HTTP）**为主；浏览器版保留作 dev/测试通道 | Q2=B + Q8=A |
| 架构 | 后端业务抽成**传输无关 service 层**，HTTP 路由 + IPC handler 都是薄适配 | Q8=A |
| 数据目录 | 持久化迁移到 `app.getPath('userData')`（打包后项目目录只读） | Q3=A |
| 构建 | **electron-vite** + **electron-builder**（与现有 Vite 生态契合） | Q4=A |
| 平台 | 先 **Windows x64**，架构保证跨平台不返工 | Q5 |
| 桌面体验 | **托盘常驻**：✕ 隐藏到托盘、托盘菜单(显示/退出)；隐藏时保留现有 10s 轮询 | Q6=B + Q10 |
| 系统通知 | 明确**放路线图，不进 v1** | Q10 |
| 单实例 | 要（`app.requestSingleInstanceLock`，第二实例激活已有窗口） | Q11 |
| 自动更新 | **v1 就上 electron-updater**（挂 GitHub Releases） | Q9 |
| 代码签名 | v1 **不签名**（接受 SmartScreen"未知发布者"提示） | Q9 |
| 安装器 | **NSIS 安装包 + portable 便携版**（builder 一条命令出两种） | Q12 |
| 图标 | 先用股票/水杯类 emoji 派生临时 `.ico`，后面替换 | Q13 |
| 测试 | **三层全留**：vitest + Playwright(浏览器) + Playwright(Electron) + 打包冒烟 | Q7 |

---

## 目标架构

```
┌───────────────────────── Electron 桌面端 ─────────────────────────┐
│ 主进程 (Node, 内置)                                               │
│  ├─ app lifecycle：单实例锁 / userData 目录 / 托盘 / 自动更新        │
│  ├─ services（传输无关，复用现有 server 业务）                        │
│  │   ├─ marketService（腾讯/新浪/东财 CompositeProvider）           │
│  │   ├─ agentService（ModelManager + SessionAgent，Pi SDK）        │
│  │   └─ traceService / store（FileStore/TraceStore → userData）    │
│  ├─ ipcMain handlers（market:quote / agent:chat / traces:* / …）    │
│  └─ agent 流式事件 → webContents.send('agent:event', e)            │
└───────────────┬───────────────────────────────────┬──────────────┘
  preload (contextBridge, contextIsolation on)       │  dev 通道
  window.api = { quote, chat, onAgentEvent, … }      ▼
┌───────────────┴───────────────────────────────────┴──────────────┐
│ 渲染进程（复用现有 web/ 组件）                                      │
│  lib/api.ts → 双传输：Electron 走 window.api(IPC)，浏览器走 fetch   │
└───────────────────────────────────────────────────────────────────┘
     dev：npm run dev（浏览器 + Express）
     build：npm run dist（electron-builder → NSIS + portable）
```

**核心原则**：现有组件、service 逻辑、测试全部复用；`web/src/lib/api.ts` 成为唯一的"传输适配层"（Electron 下用 `window.api`，浏览器下用 fetch 走 Express）。主进程直接持 services，打包后**不需要起 HTTP 服务**（干净、无端口、无本地防火墙提示）。

---

## 里程碑 M8-0 → M8-5（含 ✅ 完成标准）

### M8-0 脚手架与架构验证
- 根目录引入 `electron-vite`（`electron/` workspace，含 `main`/`preload`/渲染复用 `web/` 产物或独立入口）
- 最小接通：Electron 打开窗口 → 渲染现有 web 页面 → 主进程回调一条 IPC 计数打点
- ✅ `npm run dev:renderer`（浏览器）照常可用；`npm run dev:electron` 能开窗；typecheck 绿

### M8-1 service 层抽取（不动 UI）
- 新目录 `packages/core`（或 `electron/service`）：把 `server/src/market`、`agent`、`trace`、`store` 的**类实例化放在 service 层**，独立于 Express 路由
- `server/src/app.ts` 的路由改为调用 service（行为不变）
- ✅ 现有 vitest 78 项**全绿（零改动通过）**——证明抽取没有破坏任何逻辑

### M8-2 IPC 桥 + 前端双传输
- `electron/preload/index.ts`：`contextBridge.exposeInMainWorld('api', {...})`，暴露 `market.quote/quotes/financials/news/kline`、`agent.sessions/chat`、`traces.*`、`watchlist.*`
- agent 聊天流经 IPC：渲染进程 `ipcRenderer.invoke('agent:chat', payload)` → 主进程 `agent.prompt` → `webContents.send('agent:event')` 推事件 → `agent:chatEnd` 收尾（替代 SSE）
- `web/src/lib/api.ts`：检测 `window.api` 存在则走 IPC，否则走 fetch（浏览器 dev）
- `web/src/state/useChatStore.ts`：流式监听改为订阅 Electron 事件（无 fetch/SSE 分支）
- ✅ 浏览器 E2E(4 用例)不受影响；新增一个 IPC 序列化单测（payload 往返）
- ✅ 双传输在 dev 下可同时验证（浏览器 + Electron 都能对话/观测）

### M8-3 主进程集成（桌面化）
- 生命周期：`requestSingleInstanceLock`、窗口创建、`close` → 隐藏到托盘、托盘菜单（显示/退出）
- `DATA_DIR` 注入：开发期 `server/.data`；打包期 `app.getPath('userData')`，`FileStore/TraceStore/ModelManager` 读它（含模型 key）
- devtools 关闭（生产）；`contextIsolation: true`、`nodeIntegration: false`、CSP
- ✅ 打包产物启动：自选/会话/模型key 能写入 userData 并重启保留；✕ 隐藏到托盘、托盘恢复/退出正常；第二实例激活已有窗口

### M8-4 打包与分发
- `electron-builder`：`nsis`（Windows x64 安装包，含开始菜单/桌面快捷方式）+ `portable`
- 应用图标（临时 emoji 派生 `.ico`）
- electron-updater：打包时生成 `latest.yml`；主进程 `autoUpdater` 检查 GitHub Releases（给出更新位置，v1 允许手动触发检查 + 提示下载）
- ✅ 本地产出 `dist/*.exe`（Setup + portable）；打包冒烟通过

### M8-5 测试集落地 + 文档
- **T3 Electron E2E**（Playwright `_electron.launch`，dev 端口思路复用到 electron 实例）：窗口打开、IPC 聊天流（faux 模型 → 流式文本+工具 chip）、托盘图标存在、单实例、userData 写入
- **T4 打包冒烟**：Install exe / 跑 portable → 启动不崩、行情拉到、userData 目录正确
- package.json 脚本：`dev:electron` / `dist:win` / `test:electron` / `smoke:package`
- 更新 README(桌面版使用/打包说明) + docs/PLAN.md 进度 + progress.md
- ✅ typecheck/lint/三层测试 + 打包冒烟全绿

---

## 测试集（三层 + 打包冒烟）

| 层 | 工具 | 内容 | 门槛 |
|---|---|---|---|
| T1 单测/集成 | vitest | 现有 78 项 + 新增 IPC 序列化、service 层单测 | 全绿 |
| T2 E2E(浏览器) | Playwright browser | 现有 4 用例（dev 通道回归） | 全绿 |
| T3 E2E(Electron) | Playwright `_electron` | 窗口/托盘/IPC聊天流(faux)/单实例/userData | 全绿 |
| T4 打包冒烟 | 手动 + 脚本 | 装 exe/跑 portable → 启动 + 行情 + userData | 通过 |

**流程纪律**（goal 模式沿用）：每里程碑先 `typecheck`/`lint`，再跑对应档；带红灯不进下一里程碑。

---

## 风险与对策

| 风险 | 对策 |
|---|---|
| pi-ai/pi-agent-core 在 Electron 主进程(其内置 Node)不兼容 | M8-0 先做最小探测：在 electron 主进程 `require('@earendil-works/pi-ai')` 并跑一次 faux stream |
| 大依赖增大安装包体积 | electron-builder `asar` + 排除 devDeps；接受 ~100MB 级别 |
| IPC 大 payload（trace 全量/tool result） | 按需取、事件流增量推送；trace detail 走 invoke 按 id 查 |
| 打包后 .data 仍写项目目录 | M8-3 强制 `DATA_DIR=userData`，打包冒烟验证 |
| SmartScreen 未知发布者 | 记录在 README；后续可加证书（路线图） |

---

## 验收标准（对照用户目标）

1. `npm run dist` 产出 **NSIS 安装包 + portable**，安装后启动即用
2. Desktop 三栏工作台完整可用：行情/自选/Agent对话(流式+工具)/Traces/评测，与 Web 版功能对齐
3. 数据（自选/会话/模型 key/trace）落在 userData，**重启/移除项目目录后仍正常**
4. ✕ 隐藏到托盘、托盘显示/退出、单实例、更新检查 v1 可用
5. 三层测试 + 打包冒烟全绿；浏览器 dev 通道保留
---

## 桌面版发布流程（自动更新）

自动更新原理：桌面版启动时，用打包产物的 `app-update.yml` 去 **GitHub Releases** 查最新版本；发现新版即提示下载、重启生效。所以「发布」= 把新安装包 + `latest.yml` 传到语义化版本的 GitHub Release。

### 一次性前置（配凭证）

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
   - **Note**：随便填标识名（如 `finance-agents 桌面发布`）
   - **Expiration**：建议 90 天或 No expiration
   - **Scopes**：勾 **`repo`**（唯一必需）
2. 仓库 → Settings → Secrets and variables → Actions → New repository secret：
   - Name：`GH_TOKEN`，Value：刚才的 `ghp_...`

### 发版循环（3 步）

```bash
# 1. 改版本号：electron/package.json 的 "version"（tag 需与之一致）
# 2. 提交推送
git add -A && git commit -m "feat: ..." && git push
# 3. 打 tag 触发自动发布
git tag vX.Y.Z && git push origin vX.Y.Z
```

- `v*` tag 触发 `.github/workflows/release-desktop.yml`：装依赖 → 构建 web 渲染层 → electron-vite → `electron-builder --win --publish always`
- 自动创建/更新该 tag 的 GitHub Release，上传 `Setup.exe` + `portable.exe` + `latest.yml` + `blockmap`（老用户据此更新）

### 每次发版标准流程（详细，照着走）

**第 0 步 · 前置（只做一次）**
`GH_TOKEN` secret 已按上文配好；之后每次发版无需再动。

**第 1 步 · 改版本号**
- **关键**：改 `electron/package.json` 的 `"version"` —— 产物文件名（`Finance Agents-X.Y.Z-Setup-x64.exe`）、`latest.yml`、以及用户机器 electron-updater 的升级比对都读它。
- **同步**：`package.json`（根）/ `server/package.json` / `web/package.json` 的 `version` 改成同一数字，保持一致。
- 版本策略：小修 `0.1.x`，功能迭代 `0.2.0`。
- **关键规则：tag 必须与版本对齐**（版本 `X.Y.Z` → tag `vX.Y.Z`），否则发布会建到旧 tag 或升级检测不到。

**第 2 步 · 提交并推送代码**
```powershell
git add -A
git commit -m "chore: bump version to X.Y.Z"
git push
```
> ⚠️ **必须先推代码再推 tag**。tag 指向某个 commit，漏推代码 → tag 指向旧提交 → 编译产物还是旧版本。

**第 3 步 · 打 tag 触发自动发布**
```powershell
git tag vX.Y.Z
git push origin vX.Y.Z
```
推送 tag 瞬间 GitHub Actions 自动跑（3-8 分钟，无需干预）：
`npm ci` → 构建 web 渲染层 + 主进程 → `electron-builder --win --publish always` → 自动创建 Release `vX.Y.Z` 并传 4 个产物。

**第 4 步 · 验证**
1. Actions 工作流绿色 ✔
2. GitHub Releases 页：`vX.Y.Z` 下 `Setup.exe` / `portable.exe` / `latest.yml` / `blockmap` 齐全
3. 老版本应用启动 → 检测到 `latest.yml` 版本更高 → 提示更新 → 重启生效

**第 5 步 · 出问题怎么办**
- 工作流失败：看 Actions 日志 → 修代码推新 commit → 删旧 tag 重打（或直接打补丁版）：
  ```powershell
  git tag -d vX.Y.Z
  git push origin :vX.Y.Z
  ```
- Release 建了但产物不全：不用动代码 → Actions 该次运行 → **Re-run jobs**。
- 被打草稿/需隐藏：GitHub Releases 页直接编辑删除草稿。

### 本地手动发布（备用）

```bash
cd electron
GH_TOKEN=ghp_xxx npx electron-builder --win --publish always
```

### 验证

1. GitHub Releases 页出现带资产的 `vX.Y.Z`
2. 已装应用的电脑启动 → 日志/托盘出现「发现新版本」→ 更新 → 重启生效
