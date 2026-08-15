# Finance Agents — 股票 Agent 智能投顾工作台

基于 **Pi Agent SDK**（`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`）搭建的美股智能投顾工作台：左侧会话/自选，中间股票详情面板（实时行情 + 2×2 指标卡 + K 线图表），右侧 Agent 对话面板（可配置任意 OpenAI 兼容模型）。

```
┌─────────────┬────────────────────────────┬──────────────────┐
│  SESSIONS   │  特斯拉  TSLA.US           │  Agent           │
│  + New      │  342.27  ▲0.68%            │  [模型 API 配置条] │
│  WATCHLIST  │  Open/High/Low/... 盘后    │  你: TSLA 现在…  │
│  AAPL.US    │  ┌──────┬──────┐           │  🔧 get_quote     │
│  TSLA.US ◀  │  │QUOTE │PERF. │  Overview │  助手: 342.27…    │
│  NVDA.US    │  ├──────┼──────┤  Chart    │  本轮 1024 in/…   │
│  ─────────  │  │VALUA │FUNDA │ Financials│  [输入…]         │
│  Portfolio  │  └──────┴──────┘           │                  │
│  Alerts…    │  POSITION 无持仓           │                  │
└─────────────┴────────────────────────────┴──────────────────┘
```

## 功能特性

- **实时行情**：腾讯行情（免 key、国内可达）实时美股报价，新浪兜底；详情 + 自选行 10s 级自动刷新（带抖动与指数退避，页面隐藏暂停）
- **详情面板**：头部行情（大字价格/涨跌/开高低/前收/量/盘后状态徽标）+ Overview/Chart/Financials/News 四 Tab + 2×2 指标卡（QUOTE / PERFORMANCE / VALUATION / BASIC FUNDAMENTALS）+ 通栏 POSITION 卡
- **Agent 对话**：Pi agent SDK 驱动，可调工具（报价/基本面/新闻/K线），SSE 流式输出，工具调用 chip 可见，token/cost 用量展示；**任意 OpenAI 兼容端点**（OpenAI / 中转 / Ollama / vLLM）
- **会话与自选**：New Session/切换/消息计数；自选增删查、选中联动详情与对话上下文
- **持久化**：自选/会话/模型配置持久化到 `server/.data/app-state.json`（重启不丢，key 不入前端）
- **健壮性**：无 Finnhub key 时估值/新闻/图表优雅降级为占位提示；断网自动退避重试；长会话按 token 剪枝防超上下文

## 技术栈

| 端 | 技术 |
|---|---|
| 后端 | Node.js + TypeScript + Express 5 + Pi Agent SDK（`pi-agent-core` / `pi-ai`）|
| 前端 | React 19 + Vite + Tailwind CSS v4 + zustand + lightweight-charts |
| 数据 | 腾讯行情（实时报价/日K，免 key）+ 新浪（兜底）+ Finnhub（基本面/新闻，免费 key）|
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

### 1. 模型 API（Agent 对话必需）
右上角 Agent 面板 → `配置模型 API` → 选 `OpenAI 兼容` → 填 baseURL / model / API key → 保存。
- 例：OpenAI 官方 `https://api.openai.com/v1` + `gpt-4o-mini`；或 Ollama `http://localhost:11434/v1` + `qwen3:32b`。
- key 只存后端内存并持久化到 `.data/`（不入前端、不提交仓库）。

### 2. Finnhub key（可选，估值/新闻/图表增强）
复制 `.env.example` 为 `.env`，填 `FINNHUB_API_KEY`（注册：https://finnhub.io/register ，免费档 60 次/分）：
```bash
cp .env.example .env
# 编辑 .env 填入 FINNHUB_API_KEY=
```
无 key 也能用：行情完全可用，估值/新闻/图表显示占位提示。

## 常用命令

```bash
npm run dev          # 起前后端（开发）
npm run demo         # 数据层演示：拉 TSLA/AAPL/NVDA 真实行情+基本面+新闻+K线
npm run typecheck    # TS 类型检查（server + web）
npm run lint         # ESLint
npm test             # 单测 + 集成（server 55+ / web 2）
npm run test:e2e     # Playwright E2E（需先起 dev）
npm run build        # 生产构建
```

## 项目结构

```
├─ server/                  # Node 后端（承载 Pi Agent SDK）
│  └─ src/
│     ├─ market/            # 数据层：Tencent/Sina/Finnhub/Composite Provider + TTL缓存+single-flight
│     ├─ agent/             # Pi SDK：models(自定义 OpenAI 兼容)/tools(5个市场工具)/sessionAgent/SessionStore
│     ├─ api/               # REST 路由 + SSE 对话
│     ├─ store.ts           # JSON 文件持久化
│     └─ scripts/demo.ts    # 数据层演示脚本
└─ web/                     # React 前端
   └─ src/
      ├─ components/        # Sidebar / StockDetail(头部·Tabs·2×2卡·Chart·News) / AgentPanel(配置条·对话)
      ├─ state/             # zustand：自选/会话/对话/用量
      ├─ hooks/             # usePolling(抖动+退避+页面隐藏暂停)
      └─ lib/               # apiClient / 格式化
```

## 数据来源说明

- **腾讯行情** `qt.gtimg.cn`：实时报价/日K（免 key，字段为 `~` 分隔无官方文档，解析器已用真实响应 fixture 锁格式）
- **新浪** `hq.sinajs.cn`：腾讯失败时的兜底
- **Finnhub**：基本面（PE/PB/EPS/股息/股本）、公司新闻、K 线增强（需免费 key）

## 免责声明

本项目为技术演示，数据来自第三方免费接口，**仅供参考，不构成任何投资建议**。股市有风险，投资需谨慎。
