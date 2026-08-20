# Agent 全链路观测体系与 Trace / Bad Case 迭代闭环

> 采集 → trace → UI 观测 → 1-5★反馈 → bad case 导出 → eval 重放 → 指标趋势 → 改 prompt/工具 → 对比回归

核心设计：**同一个 Agent 事件流，一边喂给浏览器做流式渲染，一边喂给采集器做结构化记录**，后续所有环节都建立在"结构化 trace"这一层数据上。

---

## 0. 数据模型（一切的骨架）

`server/src/trace/types.ts` — 三层结构：

```
AgentTrace（一次对话）
├─ id / sessionId / userMessage / context{symbol,name}
├─ startedAt / endedAt / totalMs / outcome(ok|error) / errorMessage?
├─ feedback?{rating,reason}              ← 1-5★ 反馈
└─ turns[]（每轮 = 一次 LLM 调用 + 它触发的工具）
   ├─ modelId / startedAt/endedAt / latencyMs
   ├─ inputTokens / outputTokens / cost     ← 用量
   ├─ responseText                          ← 这轮模型说的话
   ├─ stopReason
   └─ toolCalls[]                           ← 这轮调的工具
      ├─ toolName / args / result? / isError / latencyMs
```

模型刻意"贴合" pi-agent-core 的事件结构，让采集几乎是一对一的映射。

---

## 1. 采集（Capture）

**位置**：`server/src/api/agent.routes.ts` 的 chat 处理器。`agent.prompt` 的回调同时做两件事：

```ts
const collector = new TraceCollector({ sessionId: meta.id, userMessage: message, modelId: models.getConfig().model, context: ctx });
await agent.prompt(message, (e) => {
  send('agent_event', e);   // → SSE 转发给前端（流式渲染）
  collector.onEvent(e);     // → 采集进 trace
});
collector.finish();
traces.append(collector.trace);   // ← 落盘
```

`TraceCollector`（`server/src/trace/collector.ts`）监听 pi-agent-core 的 `AgentEvent`，映射规则：

| 事件 | 动作 |
|---|---|
| `turn_start` | 开一个 TraceTurn，记 `startedAt` |
| `message_update`（text_delta） | 把增量文本 append 进 `turn.responseText` |
| `tool_execution_start` | 把工具放进 `Map<toolCallId>`（**并行工具用 id 区分**，单槽会被并行覆盖导致串台）|
| `tool_execution_end` | 补上 result/isError/latency，push 进当前 turn |
| `turn_end` | 收尾本轮：从 `message.usage` 取 tokens/cost、`stopReason` |
| `finish(error?)` | 处理异常中断的残留 turn/工具，汇总 `outcome`/`totalMs` |

---

## 2. 落盘（JSONL）

`server/src/trace/store.ts`，追加式 JSONL（`server/.data/traces.jsonl`，`.data/` 已 gitignore）：

```
{"id":"o36n0jh6","sessionId":"...","turns":[...],"outcome":"ok",...}\n
```

- `append(trace)` → 一行一个 trace
- `list({sessionId,outcome,limit,offset})` → 读全文件、过滤、按 startedAt 倒序、分页
- `get(id)` / `setFeedback(id, {rating,reason})` → feedback 整文件重写（数据量小，O(n) 可接受）

为什么 JSONL 而非 SQLite：追加 O(1)、可 tail 查看、换 SQLite 只动 store 一个文件。

---

## 3. UI 观测

`web/src/components/Traces/` 三件套 + zustand：

- **入口**：底部导航 🕵️ Traces 按钮 → `App.tsx` 的 `tracesOpen` 状态 → 渲染 `TracesModal`
- **TraceList**（左）：每条显示 时间/问题/✓✗/耗时/轮数/评分，点击 → `api.traces.get(id)` 拉详情
- **TraceDetail**（右）：瀑布式——
  - 用户消息卡片（含会话 id、上下文股票）
  - 每个 Turn 一张卡片：模型、耗时、tokens、成本
  - 下面挂工具 chip：`🔧 get_quote {"symbol":"600519"} ✓0.1s` + 结果 JSON
  - 汇总条：总耗时 / tokens in→out / 成本
  - **1-5★ 评分按钮**

数据来源：`api.ts` 的 `traces.list/get/feedback` → 后端 `/api/traces`。

---

## 4. 1-5★ 反馈 + 原因标签

点★ → `useTracesStore.rate(id, rating, {reasons})` → `POST /api/traces/:id/feedback`（`reasons: string[]` 标签数组）→ `traces.routes.ts`（校验 rating 1-5、reasons 数组）→ `TraceStore.setFeedback` 写回。

**≤3 分时展开原因标签多选**：数字/数据错误、工具选错、答非所问、拒绝服务、太啰嗦、其他。**标签让 bad case 自带分类**，`export:badcases` 后可按类聚合统计。

列表和详情的评分同步更新。**低分 trace 是 bad case 的候选**（判定：≤2 必收，3 分需带原因）。

---

## 5. bad case 导出（两种来源）

```
来源①  eval 评测失败          → evalAgent.ts 失败用例 → bad-cases.jsonl
来源②  用户低分反馈            → npm run export:badcases → 合并进 bad-cases.jsonl
```

1. **eval 失败自动导出**：`scripts/evalAgent.ts` 把失败用例的 trace 追加到 `server/.data/bad-cases.jsonl`。
2. **低分反馈导出**：`npm run export:badcases [--min-rating=N]`（默认 3）读 `traces.jsonl`，筛 `feedback.rating ≤ N` 且（≤2 分必收 / 3 分需带原因）的 trace，按 trace.id 去重合并进 `bad-cases.jsonl`。

**eval 自动吸收**：`eval:agent` 启动时读 `bad-cases.jsonl`，按消息去重（上限 15）派生为待考用例，追加进本次评测——历史踩过的坑变成永久回归用例。

---

## 6. eval 重放

三块：

- **`eval/cases.ts`** — 用例定义（纯声明）：
  ```ts
  { id: 'financials-000001', message: '平安银行（000001）的 PE 是多少？',
    context: { symbol: '000001' }, expectTool: 'get_financials' }
  ```
  现有 5 个：行情/财务/K线/新闻/回归（"茅台是A股还是美股"）。

- **`eval/runner.ts`** — 两个函数：
  - `runCase(models, market, c)`：用真实模型（从 `.data` 恢复的模型配置）建全新 `SessionAgent`，跑 `agent.prompt` + TraceCollector → trace
  - `evaluateTrace(trace, c)`：**纯函数**，逐项检查：
    - `outcome=ok`
    - 调用了 `expectTool`（工具选择正确性）
    - 回答包含工具返回的 **price**（防幻觉；只强制 price，PE 等补充数据不强求，否则"走势"类问题误报）
    - 含免责声明（`mustInclude`）
    - 不含违规词（`expectNot`，如"仅支持美股"式拒绝）

- **`scripts/evalAgent.ts`** — 编排：读模型配置 → 逐个 `runCase` → PASS/FAIL → 汇总 → 导出 bad case → 记历史 → 对比上次。

---

## 7. 指标趋势

`eval/history.ts`：每次 eval 生成 `EvalRunSummary`（PASS/平均耗时/tokens/成本/perCase），追加 `.data/eval-history.jsonl`。

`npm run eval:summary`（`scripts/evalSummary.ts`）打印趋势表：

```
#  | 时间              | 模型              | PASS    | 平均耗时 | tokens
1 | 2026-08-16T02:54  | deepseek-v4-flash |  4/5 |    5.1s |   3170→2795
2 | 2026-08-16T02:56  | deepseek-v4-flash |  5/5 |    5.1s |   2398→2778
```

---

## 8. 改 prompt/工具 → 对比回归

`eval/history.ts` 的 `compareWithPrevious(cur, prev)`（纯函数）返回：

```
passDelta / latencyDeltaMs / costDelta / regressed[] / improved[]
```

`evalAgent.ts` 跑完自动打印：

```
PASS 5/5 ▲ (上次 4/5)
平均耗时 5.1s ▲ (上次 5.1s)
✅ 改善: quote-600519
```

迭代闭环：改 `prompt.ts` 或 `tools.ts` 措辞 → 重跑 `npm run eval:agent` → 看对比（pass 涨没涨、哪个用例改善、有无新回归）。

---

## 这套体系实际抓到的问题

1. **TraceCollector 并行工具串台**：模型并行调 get_quote + get_financials，单槽位被覆盖 → 工具结果张冠李戴 → 评测误报"工具选错"。修成 `Map<toolCallId>`。
2. **数字检查千分位误报**：模型答"1,341.99"，检查器找"1341.99"找不到。改成去逗号匹配。
3. **回归词误报**：模型答"是A股，不是美股"，`/美股/` 把正常回答标红。改成只拦"仅支持美股"式拒绝。

每一个都是靠"跑一遍评测 + 看对比"暴露的，这就是闭环的价值。

---

## 常用命令

```bash
npm run eval:agent          # 真实模型评测：PASS/FAIL 报告 + 对比上次 + 导出 bad case + 吸收历史 bad case
npm run eval:summary        # 评测历史趋势表（只读，不调模型）
npm run export:badcases [--min-rating=2]  # 低分反馈 → 合并进 bad-cases.jsonl
# UI：左下导航 🕵️ Traces → 每条对话的瀑布链路 + 1-5★ 反馈（低分可勾选原因标签）
# 数据文件：server/.data/traces.jsonl（对话 trace）、eval-history.jsonl（评测历史）、bad-cases.jsonl（失败/低分用例）
```

### `npm run eval:agent` — 跑一次真实模型评测

用配置的真实模型（deepseek），对固定问题集"考试"，自动判断回答是否正确。流程：

1. 读 `server/.data/app-state.json` 里配置的模型；
2. 对 `eval/cases.ts` 的 5 个固定用例逐个跑（真实模型 + 真实数据 + 工具调用）：
   - "贵州茅台现在多少钱？"（应调 `get_quote`）
   - "平安银行 PE 是多少？"（应调 `get_financials`）
   - "宁德时代最近走势？"（应调 `get_kline`）
   - "茅台最近有什么新闻？"（应调 `get_news`）
   - "茅台是 A 股还是美股？"（回归项：不得再说"仅支持美股"）
3. 每个用例自动检查 4 件事：
   - 有没有报错（outcome=ok）
   - **工具选择是否正确**（问价格却调财务 = 失败）
   - **回答数字与工具返回一致**（防幻觉：模型瞎报价 = 失败）
   - 是否含免责声明 / 是否出现违规词（如"仅支持美股"式拒绝）
4. 输出 PASS/FAIL 报告 + 平均耗时 + tokens + 成本；
5. 失败用例导出 `.data/bad-cases.jsonl`；
6. 记入历史，**并对比上一次运行**（pass 涨跌、改善/回归的用例）。

典型输出：

```
▶ quote-600519: 贵州茅台现在多少钱？ ... ✅ PASS
===== 评测汇总 =====
PASS 5/5  🎉   平均耗时 5.1s · tokens 2398→2778 · 成本 $0.0000
===== 对比上次 =====
PASS 5/5 ▲ (上次 4/5)
✅ 改善: quote-600519
```

**什么时候用**：改了 `prompt.ts`（系统提示词）或 `tools.ts`（工具描述）后，跑一遍看变好/变坏。会**消耗模型 token**（5 题 × 两轮，约几秒、几分钱）。

### `npm run eval:summary` — 看评测历史趋势

只读历史，把历次 `eval:agent` 的结果列成趋势表，**不调用模型、免费秒出**：

```
===== 评测历史趋势（2 次）=====
#  | 时间              | 模型              | PASS    | 平均耗时 | tokens
1 | 2026-08-16T02:54  | deepseek-v4-flash |  4/5 |    5.1s |   3170→2795
2 | 2026-08-16T02:56  | deepseek-v4-flash |  5/5 |    5.1s |   2398→2778
```

**两者关系**：

```
eval:agent（考试+打分+存档） ──写──► .data/eval-history.jsonl ──读──► eval:summary（趋势表）
```

日常节奏：改完 prompt → 跑 `eval:agent` 看分数 + 对比上次 → 隔几次跑 `eval:summary` 看整体趋势。
