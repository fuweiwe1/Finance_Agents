# Goal 模式进度

status: in_progress
updated: 2026-08-15

## 里程碑状态

| 里程碑 | 状态 | 验收证据 |
|---|---|---|
| M0 脚手架 | ✅ done | `npm run dev` 起前后端(3001/5173)；typecheck/lint 绿；live /api/health + /api/market/quote 返回真实数据 |
| M1 数据层 | ✅ done | 48 单测/集成全过（腾讯/新浪解析器真实 fixture 锁字段、缓存 single-flight、Composite 路由与降级）；`npm run demo` 真实拉取 TSLA/AAPL/NVDA 全字段正确；GBK 解码/新浪兜底/Finnhub 降级均验证 |
| M2 后端 API + Agent | ✅ done | market/watchlist/agent 路由契约测试全过；SSE 对话用 fauxProvider 脚本化模型验证：工具调用 get_quote → 回答 → chat_end 事件时序正确；模型配置 key 不出接口；未配置模型返回 400 |
| M3 前端 UI | ✅ done | E2E(Playwright) 2 用例通过：三栏渲染/默认TSLA详情/2×2卡/Chart canvas/Tab切换 + 选中AAPL联动/未配置模型提示；web 单测 2 过；typecheck/lint 绿 |
| M4 集成与打磨 | ✅ done | FileStore 持久化(watchlist/sessions/modelConfig→JSON，.data/ 不入库)实机验证"加 MSFT→重启→仍在"；骨架屏/免责声明落地；store 单测 5 过；typecheck/lint 绿；E2E 2/2 |
| M5 优化与文档 | ✅ done | README(启动/配置/测试/部署/免责)；长会话按 token 剪枝(transformContext+estimateTokens)；chat_end 透传 token/cost 用量，前端展示；缓存/轮询验证；全量回归绿 |

## M6 A 股化改造（用户决策：只支持 A 股，数据源全国内）✅

| 里程碑 | 状态 | 验收证据 |
|---|---|---|
| M6-1 A股 normalize+时段 | ✅ | 600519→sh600519/000001→sz/bj 前缀规则；北京时间时段(集合竞价/交易/收盘) |
| M6-2 A股解析器+K线 | ✅ | 腾讯88字段(PE/PB/换手/市值/股本/一年高低)+qfqday日K；新浪A股格式；真实fixture锁格式 |
| M6-3 去 Finnhub | ✅ | composite 移除 Finnhub；getFinancials 由腾讯报价构建；新闻降级；.env.example 更新 |
| M6-4 前端适配 | ✅ | 默认自选A股、量(万手)/市值(亿)/时段徽标(交易中·已收盘)、去 Finnhub 提示 |
| M6-5 测试+验证+文档 | ✅ | demo 真实A股全字段正确；typecheck/lint 绿；server 47+web 2 测试 + E2E 2/2 全过；README 更新 |

## M7 Agent 全链路观测体系

### M7-1 Trace 采集 + JSONL 落盘 + API ✅
| 项 | 验收证据 |
|---|---|
| Trace 数据模型 + Collector | `trace/types.ts` + `collector.ts`：事件流→turn/toolCall/耗时/tokens/回答/outcome；残留中断处理 |
| TraceStore(JSONL) | `trace/store.ts`：追加落盘 + list(过滤/分页) + get + setFeedback |
| traces API + chat 接线 | `api/traces.routes.ts`（GET 列表/:id、POST feedback）；chat 路由每次对话生成 trace 并落盘 |
| 测试 | collector/store/routes 单测+集成 + chat 测试断言 trace 生成（含 get_quote 工具调用）|
| 实机验证 | 真实 deepseek 对话 → `traces.jsonl` 落盘 → `/api/traces` 查到 1 条（2轮、get_quote、197/265 tokens、outcome ok）|
| 回归 | typecheck/lint 绿；server 62 + web 2 测试 + E2E 3/3 全过 |

### E2E 稳定性（独立端口方案）✅
根因：globalSetup 的 taskkill 与新 webServer 存在竞态（vite 起来后被误杀）。彻底方案：**E2E 用独立端口**（web 4173 / api 3101）+ 隔离数据/追踪文件，与开发环境(5173/3001)完全隔离，不杀任何进程、不影响用户数据。vite 端口/代理目标支持环境变量覆盖（WEB_PORT/API_PORT）。

### M7-2 Traces UI 面板（列表+瀑布详情）✅
| 项 | 验收证据 |
|---|---|
| API 客户端+类型 | `web/src/lib/api.ts` 新增 `traces.list/get/feedback` + AgentTrace/TraceTurn/TraceToolCall 类型 |
| Traces store | `useTracesStore`：load/select/rate（刷新后选中同步）|
| UI 组件 | `Traces/TracesModal`（弹窗）+ `TraceList`（列表：时间/结果/耗时/轮数/评分）+ `TraceDetail`（瀑布：每轮卡片→工具调用→回答→汇总→1-5星反馈）|
| 入口 | 底部导航新增 🕵️ Traces 按钮 → 弹窗 |
| 测试 | E2E 4/4 通过（含 Traces 弹窗打开/空态/关闭）；typecheck/lint 绿；server 62+web 2 |
| 实机验证 | 真实对话"茅台PE多少？"→ trace 记录 2 轮、调用 get_financials（正确工具），`/api/traces` 供 UI 渲染 |

### M7-3 bad case 导出 + eval runner ✅
| 项 | 验收证据 |
|---|---|
| 评测用例集 | `eval/cases.ts`：5 用例（行情/财务/K线/新闻/回归），expectTool/mustInclude/expectNot |
| 检查逻辑 | `eval/runner.ts` `evaluateTrace`（纯函数）：outcome/工具调用正确性/数字一致性(仅 get_quote price 强制)/免责/违禁词 |
| runner | `runCase` 用真实模型+真实数据跑单用例 → trace → 检查 |
| 脚本 | `npm run eval:agent`：批量重放 → PASS/FAIL 报告 + 平均耗时 + 失败导出 `.data/bad-cases.jsonl` |
| 测试 | `eval/runner.test.ts` 纯检查逻辑 + faux 集成；**修复 TraceCollector 并行工具 bug**（Map<toolCallId>，原单槽并行串台） |
| 实机评测 | deepseek 真实跑 **5/5 PASS**：工具选择全对、价格一致、回归(不再提"仅支持美股") |

### M7-4 指标汇总 + 迭代回归对比 ✅
| 项 | 验收证据 |
|---|---|
| 历史记录 | `eval/history.ts`：每次 eval 摘要(ts/模型/pass/avgLatency/tokens/成本/perCase)追加 `.data/eval-history.jsonl` |
| 对比逻辑 | `compareWithPrevious`（纯函数）：pass/耗时/成本变化 + 回归/改善用例 |
| eval:agent 增强 | 跑完自动对比上次：`PASS 5/5 ▲ (上次 4/5)` + 改善用例；实机验证 |
| eval:summary | 趋势表命令：每次运行 PASS/耗时/tokens/成本；实机 2 次记录 4/5→5/5 |
| 测试 | `history.test.ts`（读写/对比）；又修复数字检查千分位逗号误报（"1,341.99"）；server 75 + web 2 + E2E 4/4 全绿 |

### M7-5 bad case 双向闭环（低分反馈导出 + 原因标签 + eval 吸收）✅
| 项 | 验收证据 |
|---|---|
| 原因标签 | TraceFeedback 增加 `reasons:string[]`；Traces 评分 UI ≤3 分展开标签多选（数字错误/工具选错/答非所问/拒绝服务/太啰嗦/其他）+ 提交 |
| 低分反馈导出 | `npm run export:badcases [--min-rating=N]`：从 traces.jsonl 筛低分（≤2 必收、3 分需原因）→ 去重合并进 bad-cases.jsonl |
| eval 吸收 | `eval:agent` 自动读 bad-cases.jsonl → 按消息去重（上限 15）→ 并入用例池；实机验证"6 个用例（含 1 条历史 bad case）" |
| 测试 | `badcases.test.ts`（去重/上限/低分判定/合并）；78 server + 2 web + E2E 4/4 全绿 |
| 实机闭环 | 真实对话 → 2 分+原因反馈 → export:badcases 导出 → eval 吸收 → 对比回归，全链路跑通 |

### M7-5 迭代闭环已就绪 ✅
采集 → trace → UI 观测 → 1-5★+原因反馈 → export:badcases 导出 → eval 吸收 → 指标趋势 → 改 prompt/工具 → 对比回归。

## M0–M6 全部完成 ✅

## 后续修复任务 ✅
- **Agent 面板可拖拽伸缩**：拖拽手柄 + 宽度限幅(300-640) + localStorage 记忆；中部 flex 随动，E2E 拖拽用例通过（面板变宽/中部变窄/无横向溢出）。
- **重启后模型配置失效 bug**：ModelManager 从 store 恢复配置时立即构建 pi-ai Models 集合（此前 UI 显示"已配置"但 getModel() 为 null，对话报"模型未配置"）；新增 models.test.ts 回归测试。
- **E2E 稳定性**：原因定位为 Chromium 对 `127.0.0.1` 走系统代理(死代理)导致连接拒绝，`localhost` 绕过代理；回退到 `localhost` + 移除了 globalSetup 的 taskkill，E2E 3/3 稳定通过。

## 关键备注

- npm 安装卡顿根因：全局 npm 代理 `127.0.0.1:7890`（Clash）失效 → 项目 `.npmrc` 用 `noproxy=*` + `registry=npmmirror` 直连解决。
- 腾讯字段为 `~` 分隔无文档，已用真实响应 fixture 锁格式；新浪盘后价/股本索引已修正。
