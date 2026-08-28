<p align="center">
  <strong>Finance Agents</strong> — 基于 Pi Agent SDK 的 A 股智能投顾工作台
  <br/>
  <em>A-share Stock Agent Workbench · PC 桌面端 + Web 双形态 · 数据源全国内，零 API Key</em>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green">
  <img alt="Node" src="https://img.shields.io/badge/Node.js-%3E%3D20-blue">
  <img alt="Pi SDK" src="https://img.shields.io/badge/Pi%20Agent%20SDK-0.84-8A2BE2">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-44-47848F">
  <img alt="Tests" src="https://img.shields.io/badge/tests-82%20passing-brightgreen">
</p>

<p align="center">
  <strong>实时行情 + 2×2 指标卡 + K 线图表 + Agent 对话 + 全链路观测与评测闭环 + 桌面打包分发</strong>
</p>

---

## 🎬 演示

<!-- 重新录制后放到 docs/screenshots/demo.gif，把下面这行取消注释替换即可：
-->

---

## ✨ 功能特性

- **桌面端 + Web 双形态**：PC 桌面应用（Electron，托盘常驻 / 单实例 / 自动更新 / 数据存 userData）与浏览器 Web 版同源同能力；桌面走本地 IPC，Web 走 HTTP
- **实时 A 股行情**：腾讯行情（免 key、国内可达）实时报价，新浪兜底；详情 + 自选行 10s 级自动刷新（抖动 + 指数退避 + 页面隐藏暂停）
- **股票详情面板**：头部行情（大字价格/涨跌/开高低/前收/量/交易时段徽标）+ Overview / Chart / Financials / News 四 Tab + 2×2 指标卡（QUOTE / PERFORMANCE / VALUATION / BASIC FUNDAMENTALS）+ 通栏 POSITION 卡
- **K 线图表**：腾讯前复权日 K，TradingView `lightweight-charts` 渲染（免费、无需账号）
- **Agent 对话**：Pi Agent SDK 驱动，可调工具（报价/基本面/新闻/K 线），流式输出、工具调用可见、token/cost 用量展示；**任意 OpenAI 兼容端点**（DeepSeek / 中转 / Ollama / vLLM）
- **全链路观测体系**：每次对话自动落盘 trace，UI 瀑布查看每轮模型/工具/耗时/成本；1-5★ 反馈 + 原因标签 → bad case 导出 → eval 自动吸收（详见[观测文档](docs/OBSERVABILITY.md)）
- **会话与自选**：New Session/切换/消息计数；自选增删查、选中联动详情与对话上下文；自选/会话/模型配置持久化（重启不丢，key 不入前端）

---

## 🧩 工作原理

三栏工作台，后端业务抽成传输无关 `services`，桌面(IPC) 与 Web(Express) 共用：

```
┌──────────────┬────────────────────────────┬──────────────────┐
│SESSIONS      │Moutai 600519  SH           │Agent             │
│[+ New]       │1341.99  -0.98%  closed     │[model conf]      │
│WATCHLIST     │O 1355 H 1359 L 1338        │you: PE?          │
│600519 *      │V 2.9M  PE 20.6  PB 6.7     │tool: get_fin     │
│000001        │[QUOTE][PERF]               │asst: PE 20.6     │
│300750        │[VALUA][FUNDA]              │this turn 2k      │
│----------    │Overview|Chart|...          │[input...]        │
│Traces        │POSITION: none              │                  │
│Agent  *      │                            │                  │
└──────────────┴────────────────────────────┴──────────────────┘
         Web 浏览器                       Electron 桌面
              └──────────┬─────────────────────┘
                 双传输 api.ts
        （浏览器 fetch+SSE ｜ 桌面 window.api(IPC)）
                         ▼
              server/src/services.ts（transport 无关）
       market(腾讯/新浪/东财)  agent(pi-agent-core)  traces
```

**迭代闭环（本项目差异化亮点）**：

```
对话 → trace 落盘 → UI 瀑布观测 → 1-5★反馈+原因标签
    → export:badcases 低分导出 → eval:agent 自动吸收历史 bad case
    → 指标趋势表 → 改 prompt/工具 → 对比回归（pass 涨跌/回归/改善）
```

- 数据源全部国内免费：腾讯行情（实时/日K）+ 新浪（兜底）+ 东方财富（新闻）
- 桌面版数据存 `%APPDATA%\Finance Agents`；Web dev 存 `server/.data`

---

## 🚀 快速开始

**前置**：Node.js ≥ 20（桌面端打包需要 Windows x64）

### Web 版（开发/调试最快）
```bash
npm install
npm run dev          # 起前后端（后端 3001，前端 5173）
# 打开 http://localhost:5173
```

### 桌面版（PC 应用）
```bash
npm install
npm run dev:electron   # 桌面开发模式（自动起 web dev + Electron 窗口）
npm run dist:win       # 打包：electron-builder → dist/ 下 Setup.exe + portable.exe
```

> 国内网络：自带 `.npmrc`（npmmirror + 绕代理），`npm install` 直接可用。
> 端口占用 `EADDRINUSE`：先 `npm run kill:dev` 再 `npm run dev`。
> 打包若访问 GitHub 超时：为 electron-builder 配置代理或镜像（脚本已兼容）。

---

## ⚙️ 配置

### 模型 API（Agent 对话，可选）
右上角 Agent 面板 → `配置模型 API` → 填 baseURL / model / API key。
- 例：DeepSeek `https://api.deepseek.com/v1` + `deepseek-chat`；或 Ollama `http://localhost:11434/v1` + `qwen3:32b`
- key 只存后端内存并持久化到本地数据目录（不入前端、不提交仓库）
- **不配置也能用**：行情/图表/指标全可用，仅 Agent 对话不可用

### 数据源
**A 股数据零配置、零 key**：腾讯（实时/日K）+ 新浪（兜底）+ 东方财富（新闻）。无海外依赖。

---

## 📦 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 起前后端（Web 开发）|
| `npm run dev:electron` | 桌面开发模式（Electron 窗口）|
| `npm run dist:win` | 打包 Windows 安装包 + 便携版（`electron/dist/`）|
| `npm run demo` | 数据层演示：600519/000001/300750 真实行情+财务+新闻+K线 |
| `npm run test` / `test:e2e` / `test:electron` | 单测+集成 / 浏览器 E2E / 桌面 E2E（独立端口，不影响开发）|
| `npm run eval:agent` | 真实模型评测：PASS/FAIL + 对比上次 + 吸收历史 bad case |
| `npm run eval:summary` | 评测历史趋势表（只读，不调模型）|
| `npm run export:badcases` | 低分反馈 → 合并进 bad-cases.jsonl |
| `npm run kill:dev` | 清理 3001/5173 残留进程 |

---

## ✅ 质量

- **82 项单测/集成**（腾讯/新浪解析器真实 fixture 锁字段、Agent 工具循环、trace 采集、eval 检查、service/IPC 协议）
- **浏览器 E2E 4 用例** + **Electron E2E 1 用例**（窗口 + window.api IPC 全链路）+ 打包冒烟
- **真实模型评测**：`npm run eval:agent` 对 deepseek 批量重放，自动检查工具选择/数字一致/免责/回归
- typecheck / lint 全绿

---

## 🛠 技术栈

| 端 | 技术 |
|---|---|
| 桌面 | Electron 44 + electron-vite + electron-builder（NSIS + portable + 自动更新）|
| 后端 | Node.js + TypeScript + Express 5 + **Pi Agent SDK**（`pi-agent-core` / `pi-ai`）|
| 前端 | React 19 + Vite + Tailwind CSS v4 + zustand + lightweight-charts |
| 数据 | 腾讯行情 / 新浪 / 东方财富（均国内免费）|
| 测试 | Vitest + supertest + Playwright（浏览器/Electron）|

---

## 🗺 路线图

- [ ] 桌面版自动更新发布到 GitHub Releases（`electron/dist/*.exe` + `latest.yml`）
- [ ] News 卡片富化（新闻列表增强、来源聚合）
- [ ] K 线多周期（周/月线 + 指标叠加）
- [ ] 持仓/自选与真实账户联动
- [ ] eval 按原因标签聚合统计、bad case 人工确认后合入用例集

---

## 📄 文档

- [观测体系与 Trace / Bad Case 迭代闭环](docs/OBSERVABILITY.md)
- [Electron 桌面端改造计划](docs/PLAN_ELECTRON.md)
- [实施计划](docs/PLAN.md)

---

## ⚠️ 免责声明

本项目为技术演示，数据来自第三方免费接口，**仅供参考，不构成任何投资建议**。股市有风险，投资需谨慎。

## 📜 致谢

- [Pi Agent Harness](https://github.com/earendil-works/pi) — `pi-agent-core` / `pi-ai` Agent 运行时与多模型接入
- [Electron](https://www.electronjs.org/) / [electron-vite](https://electron-vite.org/) — 桌面端
- [lightweight-charts](https://github.com/tradingview/lightweight-charts) — TradingView 开源图表
- 腾讯行情 / 新浪财经 / 东方财富 — A 股数据源

## 📃 License

MIT