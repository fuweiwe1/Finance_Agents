# Finance Agents — 股票 Agent 智能投顾工作台（A 股）

基于 **Pi Agent SDK**（`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`）搭建的 **A 股**智能投顾工作台：左侧会话/自选，中间股票详情面板（实时行情 + 2×2 指标卡 + K 线图表），右侧 Agent 对话面板（可配置任意 OpenAI 兼容模型）。

```
┌─────────────┬────────────────────────────┬──────────────────┐
│  SESSIONS   │  贵州茅台  600519·沪       │  Agent           │
│  + New      │  1341.99  ▼0.98%          │  [模型 API 配置条] │
│  WATCHLIST  │  Open/High/Low/... 已收盘  │  你: 茅台现在…    │
│  600519     │  ┌──────┬──────┐          │  🔧 get_quote     │
│  000001 ◀   │  │QUOTE │PERF. │ Overview │  助手: 1341.99…   │
│  300750     │  ├──────┼──────┤  Chart   │  本轮 1024 in/…   │
│  ─────────  │  │VALUA │FUNDA │ Financials│  [输入…]         │
│  Portfolio  │  └──────┴──────┘          │                  │
│  Alerts…    │  POSITION 无持仓           │                  │
└─────────────┴────────────────────────────┴──────────────────┘
```

## 功能特性

- **实时行情**：腾讯行情（免 key、国内可达）A 股实时报价，新浪兜底；详情 + 自选行 10s 级自动刷新（抖动 + 指数退避 + 页面隐藏暂停）
- **详情面板**：头部行情（大字价格/涨跌/开高低/前收/量/交易时段徽标）+ Overview/Chart/Financials/News 四 Tab + 2×2 指标卡（QUOTE / PERFORMANCE / VALUATION / BASIC FUNDAMENTALS）+ 通栏 POSITION 卡
- **K 线图表**：腾讯前复权日 K（TradingView `lightweight-charts` 渲染，免费无需账号）
- **Agent 对话**：Pi agent SDK 驱动，可调工具（报价/基本面/新闻/K线），SSE 流式输出，工具调用 chip 可见，token/cost 用量展示；**任意 OpenAI 兼容端点**（DeepSeek / 中转 / Ollama / vLLM 等）
- **会话与自选**：New Session/切换/消息计数；自选增删查、选中联动详情与对话上下文
- **持久化**：自选/会话/模型配置持久化到 `server/.data/app-state.json`（重启不丢，key 不入前端）
- **数据来源全国内**：腾讯 + 新浪，无海外依赖、无需任何 API key

## 技术栈

| 端 | 技术 |
|---|---|
| 后端 | Node.js + TypeScript + Express 5 + Pi Agent SDK（`pi-agent-core` / `pi-ai`）|
| 前端 | React 19 + Vite + Tailwind CSS v4 + zustand + lightweight-charts |
| 数据 | 腾讯行情（A股实时报价/日K，免 key）+ 新浪（兜底）|
| 测试 | Vitest（单测+集成）+ supertest + Playwright（E2E）|

## 快速开始

**前置**：Node.js ≥ 20，npm。

```bash
# 1. 安装依赖（workspaces 一次装 server + web）
npm install

# 2. 一键起前后端（后端 3001，前端 5173，前端 /api 已代理到后端）
npm run dev

# 3. 浏览器打开 http://localhost:5173
```

> 国内网络：项目自带 `.npmrc` 使用 npmmirror 并绕过失效代理，直接 `npm install` 即可。

## 配置

### 模型 API（Agent 对话必需，可选）
右上角 Agent 面板 → `配置模型 API` → 选 `OpenAI 兼容` → 填 baseURL / model / API key → 保存。
- 例：DeepSeek `https://api.deepseek.com/v1` + `deepseek-chat`；或 Ollama `http://localhost:11434/v1` + `qwen3:32b`。
- key 只存后端内存并持久化到 `.data/`（不入前端、不提交仓库）。
- 不配置也能用：行情/图表/指标全可用，仅 Agent 对话不可用。

> A 股数据源无需任何 key（腾讯/新浪免费），没有可配置项。

## 常用命令

```bash
npm run dev          # 起前后端（开发）
npm run demo         # 数据层演示：拉 600519/000001/300750 真实行情+财务+K线
npm run typecheck    # TS 类型检查（server + web）
npm run lint         # ESLint
npm test             # 单测 + 集成（server 47 / web 2）
npm run test:e2e     # Playwright E2E（自动起服务，用隔离数据文件）
npm run build        # 生产构建
```

## 项目结构

```
├─ server/                  # Node 后端（承载 Pi Agent SDK）
│  └─ src/
│     ├─ market/            # 数据层：Tencent/Sina/Composite Provider + TTL缓存+single-flight
│     ├─ agent/             # Pi SDK：models(自定义 OpenAI 兼容)/tools(5个市场工具)/sessionAgent/SessionStore
│     ├─ api/               # REST 路由 + SSE 对话
│     ├─ store.ts           # JSON 文件持久化
│     └─ scripts/demo.ts    # 数据层演示脚本
└─ web/                     # React 前端
   └─ src/
      ├─ components/        # Sidebar / StockDetail(头部·Tabs·2×2卡·Chart·News) / AgentPanel(配置条·对话)
      ├─ state/             # zustand：自选/会话/对话/用量
      ├─ hooks/             # usePolling(抖动+退避+页面隐藏暂停)
      └─ lib/               # apiClient / 格式化(A股量/市值/时段)
```

## 数据来源说明

- **腾讯行情** `qt.gtimg.cn`：A 股实时报价（含 PE/PB/换手/市值/股本/一年高低）+ 前复权日 K（免 key，字段为 `~` 分隔无官方文档，解析器已用真实 fixture 锁格式）
- **新浪** `hq.sinajs.cn`：腾讯失败时的兜底
- 新闻：A 股免费新闻接口暂未接入（News Tab 显示引导文案）

## 免责声明

本项目为技术演示，数据来自第三方免费接口，**仅供参考，不构成任何投资建议**。股市有风险，投资需谨慎。
