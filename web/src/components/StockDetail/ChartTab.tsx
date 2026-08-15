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
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#64748b' },
      grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
      width: containerRef.current.clientWidth,
      height: 380,
      timeScale: { borderColor: '#e2e8f0' },
      rightPriceScale: { borderColor: '#e2e8f0' },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#dc2626',
      downColor: '#059669',
      borderVisible: false,
      wickUpColor: '#dc2626',
      wickDownColor: '#059669',
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
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Chart · 日K</h3>
        <span className="text-xs text-slate-400">{symbol}</span>
      </div>
      <div ref={containerRef} />
      {!kline && <p className="py-6 text-center text-sm text-slate-400">加载 K 线中…</p>}
    </div>
  );
}
