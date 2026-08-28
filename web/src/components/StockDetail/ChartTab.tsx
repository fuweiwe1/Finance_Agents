import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useKline } from '../../hooks/usePolling';

export function ChartTab({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const kline = useKline(symbol);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#5f5a52' },
      grid: { vertLines: { color: '#f1ede7' }, horzLines: { color: '#f1ede7' } },
      width: containerRef.current.clientWidth,
      height: 380,
      timeScale: { borderColor: '#d9d3c7' },
      rightPriceScale: { borderColor: '#d9d3c7' },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#c14f35',
      downColor: '#3d7a59',
      borderVisible: false,
      wickUpColor: '#c14f35',
      wickDownColor: '#3d7a59',
    });
    chartRef.current = chart;
    seriesRef.current = series;
    const onResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !kline?.length) return;
    const data = kline.map((b) => ({
      time: b.ts as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [kline]);

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="eyebrow">Chart · 日K</h3>
        <span className="text-xs text-ink-faint">{symbol}</span>
      </div>
      <div ref={containerRef} />
      {!kline && <p className="py-6 text-center text-sm text-ink-faint">加载 K 线中…</p>}
    </div>
  );
}
