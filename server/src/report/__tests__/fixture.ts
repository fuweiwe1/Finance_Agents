import type { StockReport } from '../schema.js';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** 生成一份合法默认决策仪表盘；可覆写字段（dashboard 顶层键整体替换）。 */
export function makeReport(
  over: Partial<Omit<StockReport, 'dashboard'>> & { dashboard?: DeepPartial<StockReport['dashboard']> } = {},
): StockReport {
  const base: StockReport = {
    stock_name: '贵州茅台',
    sentiment_score: 55,
    trend_prediction: '震荡',
    operation_advice: '持有',
    decision_type: 'hold',
    confidence_level: '中',
    dashboard: {
      core_conclusion: {
        one_sentence: '缩量横盘，中性观望',
        signal_type: '🟡持有观望',
        time_sensitivity: '本周内',
        position_advice: { no_position: '回调企稳再介入', has_position: '继续持有' },
      },
      data_perspective: {
        trend_status: { ma_alignment: '5/10/20 走平，价格在MA20下方', is_bullish: false, trend_score: 35 },
        price_position: { current_price: 1297.4, ma5: 1300.23, ma10: 1296.44, ma20: 1315.58, bias_ma5: -0.22, bias_status: '安全', support_level: 1270.33, resistance_level: 1363.35 },
        volume_analysis: { volume_ratio: 0.54, volume_status: '缩量', turnover_rate: 0.13, volume_meaning: '显著缩量，方向未明' },
      },
      intelligence: {
        latest_news: '【最新消息】行业景气承压',
        risk_alerts: ['行业收入下滑'],
        positive_catalysts: ['估值低'],
        earnings_outlook: '增速或放缓',
        sentiment_summary: '情绪偏谨慎',
      },
      battle_plan: {
        sniper_points: { ideal_buy: '回踩1270.33企稳', secondary_buy: '放量突破1363.35', stop_loss: '跌破1270.33', take_profit: '1363.35' },
        position_strategy: { suggested_position: '0-2成', entry_plan: '等待确认', risk_control: '跌破支撑减仓' },
        action_checklist: ['✅ 盘后口径确认', '✅ 量能评估', '⚠️ 行业风险'],
      },
      phase_decision: {
        phase: 'postmarket',
        action_window: '盘后复盘',
        immediate_action: '持有观望',
        watch_conditions: ['守住支撑'],
        next_check_time: '下交易早盘前',
        confidence_reason: '方向不明',
        data_limitations: ['筹码无数据源'],
      },
      signal_attribution: {
        technical_indicators: 35,
        news_sentiment: 40,
        fundamentals: 55,
        market_conditions: 45,
        strongest_bullish_signal: '估值低',
        strongest_bearish_signal: '行业承压',
      },
    },
    analysis_summary: '缩量横盘中性观望',
    key_points: '缩量,行业承压,估值支撑',
    risk_warning: '跌破支撑则下跌空间打开',
    buy_reason: '无明确买入信号',
    tool_calls: 'get_quote,get_news',
    data_sources: '腾讯/东财',
  };

  return {
    ...base,
    ...over,
    dashboard: { ...base.dashboard, ...(over.dashboard ?? {}) } as StockReport['dashboard'],
  };
}