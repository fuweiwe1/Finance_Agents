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

## M0–M5 全部完成 ✅

## 关键备注

- npm 安装卡顿根因：全局 npm 代理 `127.0.0.1:7890`（Clash）失效 → 项目 `.npmrc` 用 `noproxy=*` + `registry=npmmirror` 直连解决。
- 腾讯字段为 `~` 分隔无文档，已用真实响应 fixture 锁格式；新浪盘后价/股本索引已修正。
