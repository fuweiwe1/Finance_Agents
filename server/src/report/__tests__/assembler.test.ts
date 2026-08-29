import { describe, it, expect } from 'vitest';
import { buildOverviewCard, buildDashboardCards } from '../assembler.js';
import { makeReport } from './fixture.js';

describe('assembler', () => {
  it('概览卡：每股一行 + 信号 + 情绪 + 建议 + 一句话', () => {
    const card = buildOverviewCard([
      { symbol: '600519', report: makeReport({ sentiment_score: 48, operation_advice: '观望', decision_type: 'hold' }) },
      { symbol: '000001', report: makeReport({ stock_name: '平安银行', decision_type: 'buy', operation_advice: '买入' }) },
    ]);
    expect(card.body.length).toBe(2);
    expect(card.body[0]).toContain('🟡持有观望');
    expect(card.body[1]).toContain('平安银行');
    expect(card.body[1]).toContain('买入');
  });

  it('仪表盘卡：主要区块齐全 + 免责声明', () => {
    const cards = buildDashboardCards(makeReport(), '600519');
    expect(cards.length).toBe(1);
    const joined = cards[0]!.body.join('\n');
    expect(joined).toContain('核心结论');
    expect(joined).toContain('狙击点');
    expect(joined).toContain('操作清单');
    expect(joined).toContain('信号归因');
    expect(joined).toContain('不构成投资建议');
  });

  it('超长内容自动拆多卡', () => {
    const longReport = makeReport({
      dashboard: {
        intelligence: {
          ...makeReport().dashboard.intelligence,
          latest_news: '风险'.repeat(3000),
          risk_alerts: Array.from({ length: 12 }, () => '风险点'.repeat(900)),
        },
      },
    });
    const cards = buildDashboardCards(longReport, '600519');
    expect(cards.length).toBeGreaterThan(1);
    for (const c of cards) {
      const total = c.body.join('').length;
      expect(total).toBeLessThanOrEqual(9000);
    }
  });

  it('决策色：buy → green / sell → red / hold → blue', () => {
    expect(buildDashboardCards(makeReport({ decision_type: 'buy' }), '600519')[0]!.color).toBe('green');
    expect(buildDashboardCards(makeReport({ decision_type: 'sell' }), '600519')[0]!.color).toBe('red');
    expect(buildDashboardCards(makeReport({ decision_type: 'hold' }), '600519')[0]!.color).toBe('blue');
  });
});