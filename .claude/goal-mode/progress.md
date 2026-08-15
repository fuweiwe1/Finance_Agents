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

## M0–M6 全部完成 ✅

## 后续修复任务 ✅
- **Agent 面板可拖拽伸缩**：拖拽手柄 + 宽度限幅(300-640) + localStorage 记忆；中部 flex 随动，E2E 拖拽用例通过（面板变宽/中部变窄/无横向溢出）。
- **重启后模型配置失效 bug**：ModelManager 从 store 恢复配置时立即构建 pi-ai Models 集合（此前 UI 显示"已配置"但 getModel() 为 null，对话报"模型未配置"）；新增 models.test.ts 回归测试。
- **E2E 稳定性**：原因定位为 Chromium 对 `127.0.0.1` 走系统代理(死代理)导致连接拒绝，`localhost` 绕过代理；回退到 `localhost` + 移除了 globalSetup 的 taskkill，E2E 3/3 稳定通过。

## 关键备注

- npm 安装卡顿根因：全局 npm 代理 `127.0.0.1:7890`（Clash）失效 → 项目 `.npmrc` 用 `noproxy=*` + `registry=npmmirror` 直连解决。
- 腾讯字段为 `~` 分隔无文档，已用真实响应 fixture 锁格式；新浪盘后价/股本索引已修正。
