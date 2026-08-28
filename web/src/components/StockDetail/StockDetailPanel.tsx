import { useState } from 'react';
import { useAppStore } from '../../state/useAppStore';
import { MarketHeader } from './MarketHeader';
import { Tabs, type TabKey } from './Tabs';
import { CardsGrid } from './CardsGrid';
import { PositionCard } from './PositionCard';
import { ChartTab } from './ChartTab';
import { FinancialsTab } from './FinancialsTab';
import { NewsTab } from './NewsTab';

export function StockDetailPanel() {
  const selected = useAppStore((s) => s.selected);
  const [tab, setTab] = useState<TabKey>('overview');

  return (
    <div className="p-4">
      {/* key=selected 强制在切换股票时重置加载态，避免短暂显示旧股票数据 */}
      <MarketHeader key={selected} symbol={selected} />
      <Tabs active={tab} onChange={setTab} />
      {tab === 'overview' && (
        <>
          <CardsGrid symbol={selected} />
          <PositionCard />
        </>
      )}
      {tab === 'chart' && <ChartTab symbol={selected} />}
      {tab === 'financials' && <FinancialsTab symbol={selected} />}
      {tab === 'news' && <NewsTab symbol={selected} />}

      <p className="mt-4 text-center text-[11px] text-ink-faint">
        ⚠️ 数据来自第三方免费接口，仅供演示，不构成投资建议。
      </p>
    </div>
  );
}
