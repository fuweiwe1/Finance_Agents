/** 骨架屏占位（加载时脉动灰条） */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line ${className}`} />;
}
