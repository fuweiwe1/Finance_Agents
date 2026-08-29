import { Type, type Static } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';

/**
 * 决策仪表盘输出 schema（M9 精炼版，见 docs/DESIGN_DailyReport.md §4）。
 * 整表复用「报告即工具」：模型最终必须调用 submit_report 提交完整 JSON，
 * 经 constrainedSampling strict 强制 JSON Schema 校验。
 *
 * strict 约束注意事项（pi-ai constrained-sampling）：
 * - 不用 $ref / allOf / oneOf；数组元素不用 tuple；不用 boolean schema；
 * - 所有必填字段必须出现；可选字段（Type.Optional）会被转成「值 或 null」——
 *   正好承载「无数据 → 置 null 不编」的策略。
 */

/** 枚举字段：运行时是 String Literal 数组，类型上保持为相应字符串字面量联合。 */
function strUnion<const T extends readonly string[]>(values: T) {
  return Type.Unsafe<T[number]>(Type.Union(values.map((v) => Type.Literal(v)) as any));
}

export const SENTIMENT_TREND = ['强烈看多', '看多', '震荡', '看空', '强烈看空'] as const;
export const OPERATION_ADVICE = ['买入', '加仓', '持有', '减仓', '卖出', '观望'] as const;
export const DECISION_TYPES = ['buy', 'hold', 'sell'] as const;
export const CONFIDENCE_LEVELS = ['高', '中', '低'] as const;
export const SIGNAL_TYPES = ['🟢买入信号', '🟡持有观望', '🔴卖出信号', '⚠️风险警告'] as const;
export const TIME_SENSITIVITY = ['立即行动', '今日内', '本周内', '不急'] as const;
export const BIAS_STATUS = ['安全', '警戒', '危险', '未知'] as const;
export const VOLUME_STATUS = ['放量', '缩量', '平量', '未知'] as const;
export const CHIP_HEALTH = ['健康', '一般', '警惕', '未知'] as const;

export const StockReportSchema = Type.Object({
  // ---- 决策信封 ----
  stock_name: Type.String({ description: '股票中文名称' }),
  sentiment_score: Type.Number({ description: '0-100 整数情绪分', minimum: 0, maximum: 100 }),
  trend_prediction: strUnion(SENTIMENT_TREND),
  operation_advice: strUnion(OPERATION_ADVICE),
  decision_type: strUnion(DECISION_TYPES),
  confidence_level: strUnion(CONFIDENCE_LEVELS),

  dashboard: Type.Object({
    core_conclusion: Type.Object({
      one_sentence: Type.String({ description: '≤30字一句话核心结论' }),
      signal_type: strUnion(SIGNAL_TYPES),
      time_sensitivity: strUnion(TIME_SENSITIVITY),
      position_advice: Type.Object({
        no_position: Type.String({ description: '空仓者建议' }),
        has_position: Type.String({ description: '持仓者建议' }),
      }),
    }),

    data_perspective: Type.Object({
      trend_status: Type.Object({
        ma_alignment: Type.String({ description: '均线排列状态描述，如 5/10/20 多头排列' }),
        is_bullish: Type.Boolean(),
        trend_score: Type.Number({ description: '0-100 趋势分', minimum: 0, maximum: 100 }),
      }),
      price_position: Type.Object({
        current_price: Type.Number(),
        ma5: Type.Optional(Type.Number()),
        ma10: Type.Optional(Type.Number()),
        ma20: Type.Optional(Type.Number()),
        bias_ma5: Type.Optional(Type.Number({ description: '乖离率 %，可为负' })),
        bias_status: strUnion(BIAS_STATUS),
        support_level: Type.Optional(Type.Number({ description: '启发式支撑位，可空' })),
        resistance_level: Type.Optional(Type.Number({ description: '启发式压力位，可空' })),
      }),
      volume_analysis: Type.Object({
        volume_ratio: Type.Optional(Type.Number({ description: '量比' })),
        volume_status: strUnion(VOLUME_STATUS),
        turnover_rate: Type.Optional(Type.Number({ description: '换手率 %' })),
        volume_meaning: Type.String({ description: '量能含义解读' }),
      }),
      chip_structure: Type.Optional(
        Type.Object({
          profit_ratio: Type.Optional(Type.Number({ description: '获利比例 %，无免费源可空' })),
          avg_cost: Type.Optional(Type.Number({ description: '平均成本，无免费源可空' })),
          concentration: Type.Optional(Type.String({ description: '筹码集中度描述' })),
          chip_health: strUnion(CHIP_HEALTH),
        }),
      ),
    }),

    intelligence: Type.Object({
      latest_news: Type.String({ description: '【最新消息】近期重要新闻摘要' }),
      risk_alerts: Type.Array(Type.String(), { description: '风险点列表' }),
      positive_catalysts: Type.Array(Type.String(), { description: '利好列表' }),
      earnings_outlook: Type.String({ description: '业绩预期分析' }),
      sentiment_summary: Type.String({ description: '舆情一句话总结' }),
    }),

    battle_plan: Type.Object({
      sniper_points: Type.Object({
        ideal_buy: Type.String({ description: '理想入场位，无充分依据时写「需确认」' }),
        secondary_buy: Type.String(),
        stop_loss: Type.String(),
        take_profit: Type.String(),
      }),
      position_strategy: Type.Object({
        suggested_position: Type.String({ description: '建议仓位，如 2成' }),
        entry_plan: Type.String(),
        risk_control: Type.String(),
      }),
      action_checklist: Type.Array(Type.String(), {
        description: '6 项，每项以 ✅/⚠️/❌ 开头',
      }),
    }),

    phase_decision: Type.Object({
      phase: Type.Literal('postmarket', { description: '本报告固定盘后口径' }),
      action_window: Type.String(),
      immediate_action: Type.String(),
      watch_conditions: Type.Array(Type.String()),
      next_check_time: Type.String({ description: '下次检查点，如下个交易日早盘前' }),
      confidence_reason: Type.String(),
      data_limitations: Type.Array(Type.String(), { description: '数据缺失/降级说明' }),
    }),

    signal_attribution: Type.Object({
      technical_indicators: Type.Number({ minimum: 0, maximum: 100 }),
      news_sentiment: Type.Number({ minimum: 0, maximum: 100 }),
      fundamentals: Type.Number({ minimum: 0, maximum: 100 }),
      market_conditions: Type.Number({ minimum: 0, maximum: 100 }),
      strongest_bullish_signal: Type.String(),
      strongest_bearish_signal: Type.String(),
    }),
  }),

  // ---- 尾部摘要 ----
  analysis_summary: Type.String({ description: '≤100字综合分析摘要' }),
  key_points: Type.String({ description: '3-5 个核心看点，逗号分隔' }),
  risk_warning: Type.String(),
  buy_reason: Type.String(),
  tool_calls: Type.String({ description: '本轮用到的工具清单' }),
  data_sources: Type.String(),
});

export type StockReport = Static<typeof StockReportSchema>;

export const SUBMIT_REPORT_TOOL_NAME = 'submit_report';

export interface SubmittedReport {
  report: StockReport;
}

/**
 * 把「决策仪表盘」建模为工具：模型最终调用它一次性提交完整 JSON。
 * `onSubmit` 在工具 execute 时被调用（strict 校验已通过），runner 从这里拿结果。
 */
export function makeSubmitReportTool(onSubmit: (report: StockReport) => void): AgentTool<any, any> {
  let submitted = false;
  return {
    name: SUBMIT_REPORT_TOOL_NAME,
    label: '提交决策仪表盘',
    description:
      '全部分析完成后，用本工具一次性输出完整【决策仪表盘 JSON】。这是最终交付物：先完成所有 get_* 数据工具调用，再单独调用本工具（不要与其它工具并行），调用后不要再追加任何文字。',
    parameters: StockReportSchema,
    constrainedSampling: { type: 'json_schema', strict: 'require' },
    executionMode: 'sequential',
    execute: async (_toolCallId: string, params: unknown) => {
      if (!submitted) {
        submitted = true;
        onSubmit(params as StockReport);
      }
      return {
        content: [{ type: 'text', text: '报告已接收，无需再补充说明。' }],
        details: { ok: true },
      };
    },
  };
}