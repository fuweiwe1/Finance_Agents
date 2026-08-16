import type { TraceTurn } from '../../lib/api';
import { useTracesStore } from '../../state/useTracesStore';

export function TraceDetail() {
  const selected = useTracesStore((s) => s.selected);
  const rate = useTracesStore((s) => s.rate);

  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        选择左侧一条对话查看全链路
      </div>
    );
  }

  const inTokens = selected.turns.reduce((a, t) => a + (t.inputTokens ?? 0), 0);
  const outTokens = selected.turns.reduce((a, t) => a + (t.outputTokens ?? 0), 0);
  const cost = selected.turns.reduce((a, t) => a + (t.cost ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* 用户消息 */}
      <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2">
        <div className="text-[11px] text-blue-500">用户 · 会话 {selected.sessionId}</div>
        <div className="text-sm text-slate-800">{selected.userMessage}</div>
        {selected.context?.symbol && (
          <div className="text-[11px] text-slate-400">上下文：{selected.context.symbol}</div>
        )}
      </div>

      {/* 瀑布：每轮一个卡片 */}
      {selected.turns.map((turn, i) => (
        <TurnCard key={i} index={i} turn={turn} />
      ))}

      {/* 汇总 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span>总耗时 {(selected.totalMs / 1000).toFixed(2)}s</span>
        <span>tokens {inTokens}→{outTokens}</span>
        <span>成本 ${cost.toFixed(4)}</span>
        <span className={selected.outcome === 'ok' ? 'text-emerald-600' : 'text-red-500'}>
          {selected.outcome === 'ok' ? '成功' : `失败：${selected.errorMessage ?? ''}`}
        </span>
      </div>

      {/* 反馈标记（bad case 迭代入口） */}
      <div className="mt-3 flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2">
        <span className="mr-1 text-xs text-slate-500">这条回答</span>
        {[1, 2, 3, 4, 5].map((r) => (
          <button
            key={r}
            onClick={() => void rate(selected.id, r)}
            title={`评分 ${r}`}
            className={`rounded px-1 text-lg transition-colors ${
              selected.feedback?.rating === r
                ? 'text-amber-500'
                : 'text-slate-300 hover:text-amber-400'
            }`}
          >
            ★
          </button>
        ))}
        {selected.feedback?.rating ? (
          <span className="ml-2 text-[11px] text-slate-400">已标记 {selected.feedback.rating} 分</span>
        ) : (
          <span className="ml-2 text-[11px] text-slate-300">（低分将沉淀为 bad case）</span>
        )}
      </div>
    </div>
  );
}

function TurnCard({ index, turn }: { index: number; turn: TraceTurn }) {
  return (
    <div className="mb-3 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-600">
          Turn {index + 1}
          <span className="ml-2 font-mono text-slate-400">{turn.modelId}</span>
        </span>
        <span className="text-slate-400">
          {(turn.latencyMs / 1000).toFixed(1)}s
          {turn.inputTokens != null ? ` · ${turn.inputTokens}→${turn.outputTokens ?? '?'} tok` : ''}
          {turn.cost != null ? ` · $${turn.cost.toFixed(4)}` : ''}
        </span>
      </div>

      {turn.toolCalls.map((tc, j) => (
        <div key={j} className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span>🔧</span>
            <span className="font-mono font-medium text-slate-700">{tc.toolName}</span>
            <span className="font-mono text-slate-400">{JSON.stringify(tc.args)}</span>
            <span className={tc.isError ? 'text-red-500' : 'text-emerald-600'}>
              {tc.isError ? '✗' : '✓'} {(tc.latencyMs / 1000).toFixed(1)}s
            </span>
          </div>
          {tc.result !== undefined && (
            <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all text-[10px] text-slate-400">
              {typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result)}
            </pre>
          )}
        </div>
      ))}

      {turn.responseText && (
        <div className="mt-2 whitespace-pre-wrap rounded bg-slate-50 px-2 py-1.5 text-sm leading-relaxed text-slate-700">
          {turn.responseText}
        </div>
      )}
    </div>
  );
}
