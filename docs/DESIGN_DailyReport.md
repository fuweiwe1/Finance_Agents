# M9 设计：自选股每日决策仪表盘推送（飞书）

> 状态：设计已收敛（grill 共识），待材料（PAT/签名密钥）后进入实施。
> 关联：`docs/PLAN.md`；实现代码不落到本文件，见各 `server/src/report|push` 模块。

## 1. 目标

对用户设定的"报告清单"（独立于侧栏自选股），每交易日 20:00（北京时间）生成**每股一张决策仪表盘**，
以**概览卡 + N 张仪表盘卡**推送到飞书群（自定义机器人 Webhook），由云端 GitHub Actions 驱动，
机器关机照发。

## 2. 端到端链路

```
GitHub Actions schedule (cron: 0 12 * * * UTC = 20:00 CST，主分支，自持公开仓库 fuweiwe1/Finance_Agents)
  → 交易日门（远程交易日历 + 仅星期过滤兜底；节假日/周末跳过，静默退出）
  → npm ci（根 workspace）
  → node server/src/scripts/dailyReport.ts（独立"报告模型"，env 全部来自 GitHub Secrets & Vars）
  →   每股 1 个无头 Pi Agent（并行，fresh instance 模式 = eval/runner.ts:97-120 同款）
  →     报告即工具：TypeBox 输出 schema + constrainedSampling.strict='require'
  →     数据来自 CompositeProvider（腾讯报价/日K、新浪兜底、东财新闻）
  →     一致性校验（bias/支撑压力/key_points 不得与现价自相矛盾）
  → 组装【概览卡 + N 张仪表盘卡】→ 飞书群 webhook（HMAC-SHA256 签名，逐股发送）
  → 运行结果写回仓库变量 REPORT_LAST_STATUS → 应用设置页展示
```

## 3. 已定决策快照

| 域 | 决策 |
|---|---|
| 报告形态 | 组合日报；每股一张完整**决策仪表盘**（深度版）；赴前出概览卡 |
| 分析深度 | 固定轻-中模板 + 决策信封；基本面数值复用腾讯字段，不做深挖 |
| 时点 | 每交易日 20:00 北京；非交易日跳过 |
| 触发 | 无条件固定推送；瞬时失败自动重试（指数退避）；失败告警 = 应用内"上次推送状态" + workflow 运行页 |
| 调度 | GitHub Actions `schedule` + `workflow_dispatch`（手动/测试）；公开仓库，仅主分支 |
| 配置真源 | GitHub 仓库 Variables + Secrets；应用 Settings 面板经 **fine-grained PAT** 读写同步；本地 FileStore 仅作展示镜像 |
| 报告清单 | 设置页独立维护，与侧栏自选股解耦；随"应用到云端"同步上仓库变量 |
| 通道 | 自研薄飞书客户端（约几十行）；`PushChannel` 插拔接口；一期卡片无图 |
| 消息 | 概览卡(1) + 仪表盘卡(N)；每股超长再拆文本段（卡片上限内） |
| 模型 | 独立"报告模型"配置（provider/baseUrl/model/key 一套 secret），与聊天模型解耦 |
| 生成 | 每股 1 无头 Agent 并行；输出走"报告即工具 + constrainedSampling" |
| 客户端 | 不引 cc-connect（本地调度/外部 agent CLI/飞书应用模式 三重不匹配） |

## 4. 每股报告 schema（精炼版，输入到 TypeBox 输出工具）

决策信封
- `stock_name` / `sentiment_score`(0-100) / `trend_prediction`(强烈看多/看多/震荡/看空/强烈看空)
- `operation_advice`(买入/加仓/持有/减仓/卖出/观望) / `decision_type`(buy/hold/sell) / `confidence_level`(高/中/低)

`dashboard.core_conclusion`
- `one_sentence`(≤30字) / `signal_type`(🟢买入信号/🟡持有观望/🔴卖出信号/⚠️风险警告) / `time_sensitivity`(立即行动/今日内/本周内/不急)
- `position_advice.{no_position,has_position}`（空仓/持仓双建议）

`dashboard.data_perspective`
- `trend_status`：`ma_alignment` / `is_bullish` / `trend_score`(0-100)
- `price_position`：`current_price` / `ma5` / `ma10` / `ma20` / `bias_ma5`(%) / `bias_status`(安全/警戒/危险) / `support_level`★ / `resistance_level`★（★=启发式，标 estimated）
- `volume_analysis`：`volume_ratio`(量比) / `volume_status`(放量/缩量/平量) / `turnover_rate`(%) / `volume_meaning`
- `chip_structure`：**整块置 null**（免费源无筹码分布数据，不编；见 §5）

`dashboard.intelligence`
- `latest_news` / `risk_alerts:[]` / `positive_catalysts:[]` / `earnings_outlook` / `sentiment_summary`（东财新闻由 LLM 归因归纳）

`dashboard.battle_plan`
- `sniper_points`：`ideal_buy` / `secondary_buy` / `stop_loss` / `take_profit`（具体元，模型不得臆造；缺依据时给"需确认"文字并降置信）
- `position_strategy`：`suggested_position` / `entry_plan` / `risk_control`
- `action_checklist:[6项]`（每项 ✅/⚠️/❌）

`dashboard.phase_decision`（固定口径：盘后）
- `phase`="postmarket" / `action_window`="盘后复盘" / `immediate_action` / `watch_conditions:[]` / `next_check_time`=下交易日早盘前 / `confidence_reason` / `data_limitations:[]`

`dashboard.signal_attribution`
- `technical_indicators` / `news_sentiment` / `fundamentals` / `market_conditions`(均0-100) / `strongest_bullish_signal` / `strongest_bearish_signal`

尾部摘要
- `analysis_summary`(≤100字) / `key_points`(3-5 个，逗号分隔) / `risk_warning` / `buy_reason`
- `tool_calls`:string（本轮用到的工具清单，替代原 search_performed——无外网搜索）
- `data_sources`:string

**打包外字段（非 schema，由卡片模板补）**：名称、`decision_type` 彩色标签、`sentiment_score`、缺数据时灰标、一行"不构成投资建议"。

**评分带 & 稳定性约束**（进系统提示词）：
- 80-100 强烈买入；60-79 买入；40-59 观望→hold；0-39 减仓/卖出
- 不得因单日涨跌/评分越线剧烈切换 buy/sell；支撑压力之间、资金流不明 → 中性（hold/观望）
- 接近支撑确认或有效突破压力且资金量价配合才可买入；跌破关键支撑/资金持续流出/风险放大才可卖出
- `phase_decision`、`signal_attribution` 必须出；数据 stale/missing/fetch_failed → `confidence_level`≠高
- 盘后运行不得伪造当日盘中走势

## 5. 数据能力对照（事实，来自现有 providers）

| 字段 | 来源 | 状态 |
|---|---|---|
| price/涨跌/开高低收/昨收 | 腾讯 `qt.gtimg.cn` | ✅ 已解析 |
| turnover_rate(38) / 量比(字段49) | 腾讯原始报文 | 量比 **待接**（新解析字段） |
| ma5/10/20、bias、均线排列/趋势分 | 日K 本地计算（`getKline` qfqday） | ✅ 计算层新建 |
| 支撑/压力 | 近 K 线高低启发式 | ⚠️ 标 estimated |
| 放量/缩量/平量 | 今日量 vs 近 5 日量 | ✅ 计算层新建 |
| PE/PB/EPS/市值/换手 | 腾讯字段 → `getFinancials` | ✅ 已有 |
| 新闻/公告/舆情 | 东财 `fetchNewsByName` → LLM | ✅ 已有 |
| **筹码分布（获利比例/平均成本/集中度）** | 无免费源 | ❌ **整块 null，不编** |
| **主力资金流向** | 无（东财有接口未接） | ❌ M10 新增 |
| **板块/行业** | 无 | ❌ M10 新增 |

无源字段策略：置 null + `data_limitations` 注明 + 置信度≠高；绝不臆造价格/筹码/资金。

## 6. 配置项

**GitHub 变量（Var）**：`REPORT_WATCHLIST`（报告清单，逗号分隔代码）、`REPORT_LAST_STATUS`（最近一次运行结果，应用读回展示）
**GitHub Secrets**：`REPORT_MODEL_PROVIDER` / `REPORT_MODEL_BASE_URL` / `REPORT_MODEL_NAME` / `REPORT_MODEL_KEY` / `FEISHU_WEBHOOK_URL` / `FEISHU_WEBHOOK_SECRET`（可空）
**不存 GitHub**：fine-grained PAT（仅存本地 FileStore 镜像区，gitignore；runner 用自带 GITHUB_TOKEN，无需 PAT）

**应用设置页字段**：报告清单 / 报告模型四件套 / webhook URL+签名密钥 / PAT / "应用到云端"按钮（写 Var+Secret）/ "立即推送测试"（workflow_dispatch）/ 最近推送状态 / 上次同步时间

**PAT 权限**：仅 `Actions` → **Read and write**（覆盖 repo variables/secrets 读写 + workflow_dispatch 触发；Metadata 自动读；**无需 Contents**）

## 7. 飞书通道

- 自定义群机器人 `https://open.feishu.cn/open-apis/bot/v2/hook/<id>`
- 若启用签名校验：请求体带 `timestamp`、`sign = base64(HMAC-SHA256(secret, timestamp + "\n" + secret))`
- 消息：`msg_type:"interactive"` + card（概览卡/仪表盘卡）；逐条发送，逐条 await 200
- 签名密钥未提供时**先按无签名 POST**（webhook URL 即唯一凭据），建议用户尽量开启签名

## 8. 调度与交易日历

- cron `0 12 * * *`（UTC）= 20:00 CST；手动触发用 `workflow_dispatch`
- 交易日门：优先远程交易日历接口（国内可达、免费——落地时实测选定），失败降级"周一至周五 + 提示标记"
- 日期参照北京时间（runner TZ 显式设置）

## 9. 失败处理

- 数据/模型瞬时失败：指数退避重试（≤3 次）
- 任一股失败：仅降级该股（其卡片上游失败标记），其余照发
- 整轮失败：重试 → 写 `REPORT_LAST_STATUS=failed`（附原因）+ workflow 标红；webhook 崩溃时失败可见性依赖应用侧状态 + workflow 页
- 当日已发防止重复：runner 幂等标记（当天已成功则不再发）

## 10. 测试途径

- 设置页"立即推送测试" → `workflow_dispatch` 带 `mode=test`（发一张样例卡片验 webhook）
- 本地 `npm run report:test` 干跑（不出网推送，只打印卡片 JSON）便于调 schema

## 11. M10 增强（排期，本期不做）

1. 补数据源：主力资金流向 + 板块/行业（东财免费接口，插 `CompositeProvider`）
2. "轻量/完整"报告模式开关
3. 飞书交互（IM 里直接调 agent）——cc-connect 或自研长连接，独立二期功能
4. 卡片带图（升级飞书开放平台应用；`PushChannel` 已预留） 5. 已发防重、多群多目标（配置结构预留数组）

## 12. 风险与约束

- 公开仓库：Secrets 只面向主分支 schedule/dispatch 运行注入；PR 等触发路径不注入；模型 key/webhook 属可轮换凭据，失控影响有限
- 交付卡片带"不构成投资建议"；本工具为个人研究用途
- 报告是模型判断，价格目标为启发式+模型估计，标注 `estimated`/`data_limitations`

---

## 13. 实现备注（M9 落地后回填）

**文件清单（已实现）**：
- `server/src/report/`：`schema.ts`（决策仪表盘 TypeBox + `submit_report` 报告即工具，strict）、`prompt.ts`（评分带/约束/盘后口径）、`indicators.ts`（MA/乖离/支撑压力/量能/趋势分）、`tradingDay.ts`（远程日历+兜底）、`validate.ts`（数值/标签一致性，硬冲突重生成）、`assembler.ts`（概览卡+仪表盘卡，超长拆卡）、`runner.ts`（每股无头 Agent，并发 4）、`settings.ts`、`github.ts`（REST 变量/Secrets 元数据/分发）、`service.ts`（ReportService：设置/同步/状态/测试)
- `server/src/push/`：`channel.ts`（PushChannel 接口）、`feishu.ts`（卡片 v2，无签名/可选 HMAC）
- `server/src/scripts/`：`dailyReport.ts`（env 驱动入口）、`sendTestCard.ts`
- API：`server/src/api/report.routes.ts`；IPC：`electron/src/main|preload`；UI：`web/src/components/Settings/SettingsPanel.tsx`（激活侧栏 Settings 入口）+ `api.ts`/`bridge.ts`
- `.github/workflows/daily-report.yml`：schedule `0 12 * * *` UTC + `workflow_dispatch`（mode=full/test、date）

**两个现实约束（环境的）**：
1. **GitHub Secrets API 需 libsodium 加密写值**，本地 npm 代理坏无法装包 → 应用只自动写**仓库变量**（清单/模型 provider·baseUrl·model）；**模型 key 与飞书 webhook** 两个 Secret 由用户在仓库网页添加一次。应用侧 `probeReportCloudState` 检测就绪度并提示。
2. **PAT 权限**：要能写变量/Secrets/分发，fine-grained PAT 必须给仓库级 **Actions → Read and write**（只读会 403）。

**交易日历**：timor.tech 年度接口本机被墙（CI 也不可达）；bitefu 仅认 `workday=1`（`0`/裸值视为未知）。**兜底改为行情核验**：`hasTradingBarOnDate` 用腾讯日 K（当天收盘后有 bar → 交易日；节假日/周末无 bar → 跳过），数据源即行情层、CI/本机都可达。日程 `cron 0 12 * * *` 本身按周一至五粗过滤，由该核验处理节假日。

**运行状态展示**：runner 不写 GitHub 变量（GITHUB_TOKEN 无仓库变量权限，403）；改为应用侧 `latestWorkflowRun` 读最近一次 workflow run 的状态/结论展示在设置页。

**运行方式**：
- 本地干跑：`npm run report:dry`（回退聊天模型，打印卡片不推送）
- 本机发测试卡：`npm run report:card`（读本地设置的 webhook 或 `FEISHU_WEBHOOK_URL` env）
- 云端：推 `daily-report.yml` 后 `workflow_dispatch` 设好变量/Secrets 即可