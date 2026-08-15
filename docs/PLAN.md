# finance_agents — 股票 Agents 智能投顾工作台（实施计划）

> 状态：**已批准，待 goal 模式执行**（2026-08-15）。
> 决策已确认：Web 应用 / 腾讯 + Finnhub 数据源 / Agent 默认 OpenAI 兼容自定义 baseURL。

## Context（为什么做）

`C:\finance_agents` 目前是空仓库。目标是基于 **Pi Agent SDK**（`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`）搭建一个"股票 Agent 智能投顾工作台"：左侧会话/自选/功能导航，中间股票详情面板（头部行情 + Tab + 2×2 指标卡片 + 持仓卡），右侧 Agent 对话面板（顶部可配置模型 API）。

已确认的决策：
- **应用形态**：Web 应用（React + Vite 浏览器界面 + Node 后端承载 Pi agent SDK 运行时）。
- **数据源**：腾讯行情 `qt.gtimg.cn`（免 key，实时美股行情 + 日K，国内可达）；Finnhub（免费 key，基本面/新闻/图表，国内可达）作为增强，无 key 优雅降级。
- **Agent 默认模型**：OpenAI 兼容接口 + 自定义 baseURL（pi-ai `createProvider()` 原生支持，可接中转 / Ollama / vLLM / LM Studio）。

实测连通性（本机国内网络，2026-08-15）：腾讯 ✅、新浪 ✅（备用）、Finnhub ✅（401=可达）、Alpha Vantage ✅（额度仅25次/天，弃用）、Yahoo ❌ 被墙、Stooq ❌ JS 反爬。

---

## 一、目标（Goals，验收导向）

| # | 目标 | 完成标准 |
|---|------|---------|
| G0 | 脚手架 | `npm run dev` 一键起前后端；`typecheck`/`lint`/`test` 全绿 |
| G1 | 数据层 | TSLA/AAPL/NVDA 真实数据：头部行情（现价/涨跌/开高低/前收/量/盘后态）+ 估值(PE/PB/换手/市值) + 基本面(EPS/股息/股本) + 新闻 + 日K，全部跑通；Finnhub 无 key 时估值/基本面/新闻/图表降级为 `—` + 提示，不报错 |
| G2 | Agent | 右侧对话用 Pi agent-core + pi-ai（OpenAI 兼容自定义 baseURL），能调工具回答"TSLA 现在多少钱 / PE 多少 / 今天走势 / 最新新闻"，流式输出、工具调用可见 |
| G3 | UI | 严格按下方"UI 规格"渲染三栏布局；2×2 卡片 + Tab 切换 + 通栏持仓卡；选中自选联动详情面板与对话上下文 |
| G4 | 实时 | 详情 + 自选行 10s 级自动刷新，带抖动与退避；盘后(Post-Market)状态正确 |
| G5 | 会话/自选 | New Session/切换/消息计数；自选增删查，选中高亮 |
| G6 | 质量 | 单测（解析器/Provider 契约/工具）+ 集成（API/SSE）+ E2E（Playwright）三档测试；无 key 也可自测（fauxProvider 脚本化模型） |

---

## 二、技术选型与架构

**npm workspaces 单仓（server + web）**，根 `package.json` 编排脚本。

```
finance_agents/
├─ package.json                  # workspaces + dev/typecheck/lint/test 脚本
├─ .env.example                  # PORT / FINNHUB_API_KEY
├─ docs/PLAN.md                  # 本计划
├─ server/                       # Node + TypeScript 后端（承载 Pi SDK）
│  ├─ src/
│  │  ├─ index.ts                # Express 入口 + SSE 中间件
│  │  ├─ config.ts               # env 解析
│  │  ├─ market/                 # 数据层
│  │  │  ├─ types.ts             # MarketQuote/Financials/NewsItem/Kline 内部类型
│  │  │  ├─ normalize.ts         # 代码归一化: tsla/TSLA/TSLA.US/TSLA.OQ → usTSLA + TSLA
│  │  │  ├─ provider.ts          # MarketDataProvider 接口 + 注册表
│  │  │  ├─ tencent.ts           # TencentProvider：实时报价 + 日K（字段解析器）
│  │  │  ├─ finnhub.ts           # FinnhubProvider：profile2/metric/news/candle
│  │  │  ├─ composite.ts         # 路由：quote→腾讯；funds/news/chart→Finnhub(降级)
│  │  │  └─ cache.ts             # TTL 缓存 + single-flight
│  │  ├─ agent/
│  │  │  ├─ models.ts            # createModels + createProvider(自定义 OpenAI 兼容 baseURL)
│  │  │  ├─ tools.ts             # get_quote/get_financials/get_news/get_kline/get_watchlist
│  │  │  ├─ agent.ts             # 每会话一个 pi-agent-core Agent，SSE 事件转发
│  │  │  ├─ sessions.ts          # 会话内存存储（含消息、msg 计数）
│  │  │  └─ prompt.ts            # 中文投顾人设 + 免责声明 + 上下文注入
│  │  └─ api/
│  │     ├─ market.routes.ts     # /api/market/quote, /quotes(批量), /financials, /news, /kline, /search
│  │     ├─ agent.routes.ts      # /api/agent/sessions, /chat(SSE), /model-config
│  │     └─ watchlist.routes.ts  # /api/watchlist
│  └─ package.json
└─ web/                          # React + Vite + TS 前端
   ├─ src/
   │  ├─ App.tsx                 # 三栏布局
   │  ├─ components/
   │  │  ├─ Sidebar/             # Sessions / Watchlist / BottomNav
   │  │  ├─ StockDetail/         # MarketHeader / Tabs / CardsGrid(2×2) / PositionCard / ChartTab / FinancialsTab / NewsTab
   │  │  └─ AgentPanel/          # ModelConfigBar / ChatMessages / ChatInput
   │  ├─ state/                  # zustand: watchlist / selected / sessions / chat / modelConfig
   │  ├─ hooks/                  # useQuote / useQuotesBatch / useFinancials / useAgentStream
   │  └─ lib/                    # apiClient / format(数字/百分比/市值) / marketSession(盘后判断)
   └─ package.json
```

**关键依赖**：`@earendil-works/pi-agent-core`、`@earendil-works/pi-ai`（后端）；React 18 + Vite + TS + Tailwind CSS v4 + zustand + `lightweight-charts`（前端）；Express 5 + SSE；Vitest + supertest + Playwright（测试）。Node ≥ 20。

**选型理由**：Pi SDK 是 Node/TS 运行时，浏览器跑不了 → 后端承载；`pi-ai` 的 `createProvider({ api: openAICompletionsApi() })` 原生支持自定义 baseURL（对接用户要求的 OpenAI 兼容）；自带 `fauxProvider()` 供无 key 自测。前端用轻量级 charts 库而非重 BI 库，贴合股票场景。

---

## 三、数据层设计

**内部类型**（`market/types.ts`）：
```ts
MarketQuote { symbol, name, price, change, changePct, open, high, low, prevClose,
              volume, marketCap?, postMarketPrice?, postMarketPct?, ts }
Financials   { symbol, pe?, pb?, turnoverRate?, marketCap?, eps?, dividendYield?, sharesOutstanding? }
NewsItem     { id?, symbol, title, summary?, source?, url?, time }
KlineBar     { ts, open, high, low, close, volume }
```

**TencentProvider**（免 key，主行情源）：
- 报价：`GET https://qt.gtimg.cn/q=usTSLA`，`~` 分隔字段，做**具名解析器**（字段索引映射表 + 防御性校验 + 单位处理）。字段覆盖：名称/代码、现价、昨收、今开、量、涨跌额/幅、最高最低、币种、52周高低、流通/总市值(亿USD)、PE、时间戳。解析失败自动 fallback 新浪 `hq.sinajs.cn/list=gb_tsla`。
- 日K：`GET https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=usTSLA,day,,,N,qfq`（已实测通，TSLA 可回溯至 2011）。
- 盘后态：比较当前美东时间与收盘 16:00 EDT + 腾讯返回时间戳，得出 `Pre/Regular/Post/Halted` 状态。

**FinnhubProvider**（增强源，`FINNHUB_API_KEY`）：
- 基本面：`company_profile2`（marketCap, shareOutstanding）+ `metric`（peTTM, pb, epsTTM, dividendYieldIndicatedAnnual, annualTurnover）。
- 新闻：`company-news?from&to&symbol`（免费 60 次/分）。
- 图表：`stock/candle` 日线。
- 无 key → Composite 降级：估值/基本面卡显示 `—` + "需配置 Finnhub key" 提示；新闻/图表 Tab 显示引导文案。

**CompositeProvider**：quote/批量 quote → Tencent；financials/news/kline → Finnhub（有 key）或降级。`cache.ts` 提供 TTL（quote 10s / financials 1h / news 10min / kline 1h）+ 单飞（同一 symbol 并发只发一次）。批量接口 `/api/market/quotes?symbols=TSLA,AAPL,NVDA` 一次拉全自选。

---

## 四、Agent 设计（Pi agent SDK）

**模型配置**（`agent/models.ts`）：
- 用 `createProvider({ id:'custom-openai', baseUrl, auth:{apiKey}, models:[{id, baseUrl, api:'openai-completions', contextWindow, maxTokens,...}], api: openAICompletionsApi() })` 支持任意 OpenAI 兼容端点。
- 前端 ModelConfigBar 填写 baseURL / model / API key → `POST /api/agent/model-config` → 存后端内存（可选持久化本地 JSON，**key 不进浏览器/不落前端**）。默认提供 OpenAI/Anthropic/Gemini/自定义 四个模板（pi-ai 内置 provider 也可一键切换）。
- 工具（`agent/tools.ts`，pi-ai Tool 定义，TypeBox schema）：
  - `get_quote(symbol)`、`get_financials(symbol)`、`get_news(symbol, limit)`、`get_kline(symbol, interval, count)`、`get_watchlist()`。
  - **结果压缩**：只取关键字段、统一格式化数字，控制 token 用量。

**会话 Agent**（`agent/agent.ts`）：
- 每会话一个 `new Agent({ initialState: { systemPrompt, model }, streamFn })`（pi-agent-core）。
- `subscribe()` 把事件（`message_update`/`text_delta`/`toolcall_*`/`done`/`error`）经 SSE 转发前端；工具执行后 `continue()`。
- 系统提示注入：当前选中股票上下文（代码/名称/最新价），中文投顾人设 + "不构成投资建议"免责。
- 会话存储：内存 Map（消息 + msg 计数）；SQLite 持久化列为优化项。

**对话流**：前端 ChatInput → `POST /api/agent/sessions/:id/chat`（SSE）→ 流式渲染；工具调用显示为可展开 chip。

---

## 五、前端 UI 规格（严格对照用户需求）

**整体**：三栏 —— 左 Sidebar（约 260px）｜中 StockDetail（flex-1）｜右 AgentPanel（约 360px，可折叠）。

**左侧边栏**（垂直三块）：
1. **SESSIONS**：蓝色高亮 `+ New Session` 按钮；下方会话列表（`New Session` + `0 msgs`），点击选中高亮。
2. **WATCHLIST**：标题 + 搜索输入框（输入代码 → 解析名称 → 添加）；条目 = 代码+名称 + 右侧实时价 + 涨跌幅，右侧蓝色 `+` 号；行选中高亮（默认 TSLA）。内置 AAPL.US 苹果 / TSLA.US 特斯拉 / NVDA.US 英伟达。
3. **底部功能导航**（图标+文字）：Portfolio / Alerts / Skills / Settings / Agent Panel（右下绿色在线小点）。本期为静态入口，仅 Agent Panel 联动右栏显示/隐藏。

**中间：股票详情面板**（自上而下）：
1. **头部行情**：名称代码（Tesla  TSLA.US）+ 大字体现价 + 涨跌幅；下一行平铺 Open / High / Low / Prev Close / Volume；下方 `Post-Market` 状态徽标（按美东时段）。
2. **Tab 栏**：Overview / Chart / Financials / News，默认选中 Overview。
3. **2×2 卡片网格**（白底圆角，左标签右数值的键-值排版）：
   - 左上 **QUOTE**：最新价、涨跌幅、成交量
   - 右上 **PERFORMANCE**：日内区间、开盘、前收、52 周高低
   - 左下 **VALUATION**：PE、PB、换手率、总市值
   - 右下 **BASIC FUNDAMENTALS**：EPS、股息、总股本
4. **POSITION 持仓卡**（通栏整行）：默认显示"无持仓"（本地空持仓，localStorage 持久化）。

**右侧 Agent 面板**：顶部 ModelConfigBar（Provider 下拉 + baseURL + model + API key + Save）；下方对话流（用户/助手气泡 + 工具调用 chip + 流式光标）；底部输入框。

**交互**：选中自选 → 详情面板刷新 + Agent 上下文注入；实时轮询（详情 10s、自选批量 10s，带 ±20% 抖动与退避，页面隐藏暂停）；Tab 切换按需加载（Chart 懒加载）。

---

## 六、实施计划（里程碑 + 完成标准）

**M0 脚手架与计划落盘**
- 建 workspaces、`.env.example`、`docs/PLAN.md`；根脚本 `dev`（concurrently 起前后端）/ `typecheck` / `lint` / `test`。
- ✅ dev 起来、静态检查绿。

**M1 数据层**
- normalize.ts + Tencent 解析器（用**捕获的真实响应做 fixture**：tsla/aapl/nvda/无效代码）+ 新浪 fallback + Finnhub mapper + Composite + cache/single-flight + 批量接口。
- ✅ G1 数据类单测通过；`npm run demo`（临时脚本）能拉出 TSLA 真实头部字段。

**M2 后端 API + Agent 接线**
- market.routes（quote/quotes/financials/news/kline/search）+ agent.routes（sessions/chat SSE/model-config）+ watchlist.routes。
- models.ts（自定义 OpenAI 兼容 provider）+ tools.ts + agent.ts（SSE 事件转发）+ sessions.ts + prompt.ts。
- ✅ 集成测试：真实数据接口契约 + SSE 事件时序（fauxProvider 无 key 可测）。

**M3 前端 UI**
- 三栏布局 + 侧边栏三区 + 详情面板（头部/Tab/2×2/持仓）+ Chart(lighweigh-charts) + 对话面板 + ModelConfigBar + zustand 状态 + 轮询 hooks + 格式化。
- ✅ E2E：加自选/选中联动/Tab 切换/发消息出流式回复，三栏按规格渲染。

**M4 集成与打磨**
- 选中联动 Agent 上下文、会话/自选持久化、错误/空态（无 key 降级、断网、加载）、盘后徽标、骨架屏、格式化细节。
- ✅ 手工 checklist 全过（见"测试方案"）。

**M5 优化与文档**
- 缓存命中/轮询抖动验证、长会话 compaction、token/cost 展示、README（启动/配置 key/免责）、部署说明。
- ✅ G4/G5/G6 全绿 + README。

---

## 七、测试方案（怎么自测）

**T1 单元测试（Vitest）**
- Tencent 解析器：用真实响应 fixture 断言全字段（价格/涨跌/高低/量/52周/市值/PE），格式变更即红；无效代码返回规范化错误。
- normalize、格式化工具（数字/百分比/亿市值/换手率）、盘后时段判断（用固定时区 fixture）。
- Finnhub mapper 空字段 → null；tools 输出结构（mock provider）。
- Agent 全流程：`fauxProvider()` 脚本化模型跑"TSLA 现在多少钱"→ 工具调用 → 回复。

**T2 集成测试（Vitest + supertest）**
- `/api/market/quote`、批量、financials、news、kline 契约（在线跑真实数据；CI/离线用 fixture stub）。
- SSE `/chat`：用 fauxProvider 断言 `text_delta → toolcall → done` 时序与格式；会话 CRUD、watchlist CRUD。

**T3 E2E（Playwright）**
- 搜索 TSLA → 加自选 → 行出现且带价；选中 → 详情头部/4卡/持仓渲染；切 Chart 出 K 线；发"TSLA 的 PE 是多少"→ 流式回复 + 工具 chip；清空模型配置 → 降级提示。

**T4 手工验收清单（`npm run demo` + checklist）**
- 国内网络、真实数据：TSLA 头部全字段正确；盘后徽标正确；自选三行实时跳动；无 key 降级卡片出 `—` + 引导；断网重连恢复；每项对照 UI 规格逐条打勾。

---

## 八、优化方案（怎么自优化）

**数据/性能**：single-flight + TTL 缓存；批量拉自选；轮询 ±20% 抖动 + 指数退避 + 页面隐藏暂停；Chart 懒加载；腾讯解析失败自动降级新浪。
**Agent**：工具结果压缩省 token；系统提示注入当前选中上下文；长会话 `transformContext` 压缩；fast/smart 模型分层可切；`pi-ai` 内置 token/cost 追踪展示在会话里。
**前端**：memo/useMemo、长列表虚拟化、骨架屏、错误/空态、localStorage 持久化自选与会话。
**健壮性/合规**：接口超时重试；**免责声明（不构成投资建议）**；key 仅存后端；`.env` 模板化。

---

## 九、风险与对策

| 风险 | 对策 |
|------|------|
| 腾讯接口字段索引无文档、随时变 | 解析器隔离 + fixture 测试锁字段；失败降级新浪 |
| Finnhub 60次/分限流 | 缓存 + 批量 + 轮询节流；无 key 降级可跑 |
| 国内访问 npm/GitHub 慢 | 锁定依赖版本；需要时配置 registry 镜像 |
| 模型无 key（自测期） | `fauxProvider()` 脚本化模型跑通全链路，key 由用户后补 |

---

## 十、验收标准（对照用户需求逐条）

1. 左侧 SESSIONS（New Session 蓝色按钮 + 会话列表 + msg 计数）、WATCHLIST（搜索 + 三只自选带实时价 + 蓝色加号 + 选中高亮）、底部功能导航（5 项 + Agent Panel 绿点）齐全。
2. 中间头部：名称代码 + 大字体现价 + 涨跌幅 + Open/High/Low/Prev Close/Volume + Post-Market 徽标；Tab 四栏默认 Overview。
3. 2×2 卡片：QUOTE / PERFORMANCE / VALUATION / BASIC FUNDAMENTALS，键值排版；下方通栏 POSITION 显示无持仓。
4. 右侧 Agent 对话：顶部模型 API 配置（Provider/baseURL/model/key/Save），对话流式输出 + 工具调用可见。
5. 全链路在**国内网络、真实数据**下演示通过；无 key 亦不崩溃。
