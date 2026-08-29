import type { PushCard, PushCardColor } from '../push/channel.js';
import type { StockReport } from './schema.js';

/**
 * 组装飞书卡片：1 张概览卡 + 每股 1（或多）张仪表盘卡（超长自动拆分）。
 */

const MAX_SECTION_TOTAL = 8_000; // 单卡 body 累计字符上限，超过拆分
const MAX_SECTIONS = 14;

/** 超长文本按换行切窗（单条 section 也能被拆），返回 ≤max 的多段。 */
function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < 0) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^[\n]/, '');
  }
  if (rest.trim()) out.push(rest.replace(/^[\n]/, ''));
  return out;
}

function colorOf(report: StockReport): PushCardColor {
  if (report.decision_type === 'sell') return 'red';
  if (report.decision_type === 'buy') return 'green';
  return 'blue';
}

function fmt(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return String(Number(n.toFixed(2)));
}

export interface OverviewEntry {
  symbol: string;
  report: StockReport;
}

export function buildOverviewCard(entries: OverviewEntry[]): PushCard {
  const lines: string[] = [];
  for (const { symbol, report } of entries) {
    const d = report.dashboard.core_conclusion;
    lines.push(
      `${d.signal_type} **${report.stock_name}**(${symbol})｜情绪 ${fmt(report.sentiment_score)}/100｜${report.operation_advice}｜置信 ${report.confidence_level}｜${d.one_sentence}`,
    );
  }
  const today = todayLabel();
  return {
    title: `自选股决策日报 · ${today} 盘后`,
    color: 'grey',
    body: lines.length ? lines : ['暂无报告'],
  };
}

function todayLabel(): string {
  return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function buildDashboardCardSections(report: StockReport): string[] {
  const d = report.dashboard;
  const pp = d.data_perspective.price_position;
  const va = d.data_perspective.volume_analysis;
  const intel = d.intelligence;
  const bp = d.battle_plan;
  const pd = d.phase_decision;
  const sa = d.signal_attribution;

  const sections: string[] = [];

  sections.push(
    `**核心结论**：${d.core_conclusion.one_sentence}\n${d.core_conclusion.signal_type} ｜ ${report.trend_prediction} ｜ 时间敏感性：${d.core_conclusion.time_sensitivity}\n**空仓**：${d.core_conclusion.position_advice.no_position}\n**持仓**：${d.core_conclusion.position_advice.has_position}`,
  );

  const dash: string[] = [];
  dash.push(`当前价 **${fmt(pp.current_price)}** 元`);
  if (pp.ma5 != null || pp.ma20 != null) {
    const ma = `MA5 ${fmt(pp.ma5)} / MA10 ${fmt(pp.ma10)} / MA20 ${fmt(pp.ma20)}；
乖离率(MA5) ${pp.bias_ma5 != null ? `${fmt(pp.bias_ma5)}%` : '—'} → ${pp.bias_status}`;
    dash.push(ma);
  }
  const sr = pp.support_level != null || pp.resistance_level != null ? `支撑 ${fmt(pp.support_level)} ／ 压力 ${fmt(pp.resistance_level)}（启发式 estimated）` : '支撑/压力：数据不足';
  dash.push(sr);
  if (d.data_perspective.trend_status.ma_alignment) dash.push(`均线：${d.data_perspective.trend_status.ma_alignment}（趋势分 ${fmt(d.data_perspective.trend_status.trend_score)}，${d.data_perspective.trend_status.is_bullish ? '偏多' : '偏空'}）`);
  sections.push(`**价格位置与趋势**\n${dash.join('\n')}`);
  sections.push(
    `**量能**：量比 ${fmt(va.volume_ratio)} · ${va.volume_status} · 换手 ${fmt(va.turnover_rate)}%\n${va.volume_meaning}`,
  );

  sections.push(
    `**情报**\n${intel.latest_news}` +
      (intel.risk_alerts.length ? `\n**风险**：${intel.risk_alerts.map((x) => `⚠️ ${x}`).join('\n')}` : '') +
      (intel.positive_catalysts.length ? `\n**利好**：${intel.positive_catalysts.map((x) => `✅ ${x}`).join('\n')}` : '') +
      `\n**业绩预期**：${intel.earnings_outlook}\n**舆情**：${intel.sentiment_summary}`,
  );

  sections.push(
    `**狙击点**\n理想入场 **${bp.sniper_points.ideal_buy}**\n次优入场 ${bp.sniper_points.secondary_buy} ｜ 止损 ${bp.sniper_points.stop_loss} ｜ 目标 ${bp.sniper_points.take_profit}\n**仓位**：${bp.position_strategy.suggested_position} ｜ ${bp.position_strategy.entry_plan}\n**风控**：${bp.position_strategy.risk_control}`,
  );

  sections.push(`**操作清单**\n${bp.action_checklist.map((x, i) => `${i + 1}. ${x}`).join('\n')}`);

  sections.push(
    `**阶段决策（盘后）**\n${pd.immediate_action}\n观察：${pd.watch_conditions.join('；')}\n下次检查：${pd.next_check_time}\n置信理由：${pd.confidence_reason}` +
      (pd.data_limitations.length ? `\n数据局限：${pd.data_limitations.map((x) => `· ${x}`).join('')}` : ''),
  );

  sections.push(
    `**信号归因**\n技术 ${fmt(sa.technical_indicators)} ｜ 舆情 ${fmt(sa.news_sentiment)} ｜ 基本面 ${fmt(sa.fundamentals)} ｜ 市场 ${fmt(sa.market_conditions)}\n最强多方：${sa.strongest_bullish_signal}；最强空方：${sa.strongest_bearish_signal}`,
  );

  sections.push(
    `**核心看点**：${report.key_points}\n**风险提示**：${report.risk_warning}\n**操作理由**：${report.buy_reason}\n**要点摘要**：${report.analysis_summary}`,
  );

  sections.push(`数据来源：${report.data_sources}；工具：${report.tool_calls}`);

  return sections;
}

export function buildDashboardCards(report: StockReport, symbol: string): PushCard[] {
  const title = `${report.stock_name}(${symbol}) · 决策仪表盘`;
  const color = colorOf(report);

  // 先按需要把超长 section 拆成 entry，再按上限分卡
  const entries: string[] = [];
  for (const sec of buildDashboardCardSections(report)) {
    entries.push(...splitLong(sec, MAX_SECTION_TOTAL));
  }

  const cards: PushCard[] = [];
  let current: string[] = [];
  let len = 0;
  const flush = () => {
    if (current.length) {
      cards.push({ title, color, body: current });
      current = [];
      len = 0;
    }
  };
  for (const sec of entries) {
    const grow = sec.length + 2;
    if (current.length && (len + grow > MAX_SECTION_TOTAL || current.length >= MAX_SECTIONS)) flush();
    current.push(sec);
    len += grow;
  }
  flush();
  if (!cards.length) cards.push({ title, color, body: ['数据不足，未生成有效报告'] });

  // 每张卡追加免责声明
  const disclaimer = '⚠️ 以上为模型观点，不构成投资建议。';
  for (const c of cards) c.body.push(disclaimer);
  return cards;
}