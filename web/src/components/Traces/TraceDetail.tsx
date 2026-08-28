import { useState } from 'react';
import type { TraceTurn } from '../../lib/api';
import { useTracesStore } from '../../state/useTracesStore';

/** 低分原因标签（bad case 分类），供 export:badcases 按类聚合 */
const RATING_REASONS = ['数字/数据错误', '工具选错', '答非所问', '拒绝服务', '太啰嗦', '其他'];

export function TraceDetail() {
  const selected = useTracesStore((s) => s.selected);
  const rate = useTracesStore((s) => s.rate);

  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">
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
      <div className="mb-3 rounded-lg bg-accent-soft px-3 py-2">
        <div className="text-[11px] text-accent">用户 · 会话 {selected.sessionId}</div>
        <div className="text-sm text-ink">{selected.userMessage}</div>
        {selected.context?.symbol && (
          <div className="text-[11px] text-ink-faint">上下文：{selected.context.symbol}</div>
        )}
      </div>

      {/* 瀑布：每轮一个卡片 */}
      {selected.turns.map((turn, i) => (
        <TurnCard key={i} index={i} turn={turn} />
      ))}

      {/* 汇总 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-soft px-3 py-2 text-[11px] text-ink-soft">
        <span>总耗时 {(selected.totalMs / 1000).toFixed(2)}s</span>
        <span>tokens {inTokens}→{outTokens}</span>
        <span>成本 ${cost.toFixed(4)}</span>
        <span className={selected.outcome === 'ok' ? 'text-down' : 'text-up'}>
          {selected.outcome === 'ok' ? '成功' : `失败：${selected.errorMessage ?? ''}`}
        </span>
      </div>

      {/* 反馈标记（bad case 迭代入口） */}
      <RateControl
        feedback={selected.feedback}
        onRate={(rating, reasons) => void rate(selected.id, rating, { reasons })}
      />
    </div>
  );
}

/** 评分 + 低分原因标签：≤3 分展开标签多选后提交，>3 分直接提交 */
function RateControl({
  feedback,
  onRate,
}: {
  feedback?: { rating: number; reason?: string; reasons?: string[] };
  onRate: (rating: number, reasons: string[]) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  const pick = (r: number) => {
    if (r > 3) {
      setPicked(null);
      setTags([]);
      onRate(r, []);
      return;
    }
    setPicked(r);
    setTags(feedback?.reasons ?? []);
  };

  const confirm = () => {
    if (picked == null) return;
    onRate(picked, tags);
    setPicked(null);
    setTags([]);
  };

  return (
    <div className="mt-3 rounded-lg border border-line px-3 py-2">
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs text-ink-soft">这条回答</span>
        {[1, 2, 3, 4, 5].map((r) => (
          <button
            key={r}
            onClick={() => pick(r)}
            title={`评分 ${r}`}
            className={`rounded px-1 text-lg transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              (feedback?.rating ?? picked) === r ? 'text-pre' : 'text-line-strong hover:text-pre'
            }`}
          >
            ★
          </button>
        ))}
        {feedback?.rating ? (
          <span className="ml-2 text-[11px] text-ink-faint">已标记 {feedback.rating} 分</span>
        ) : (
          <span className="ml-2 text-[11px] text-ink-faint/70">（低分将沉淀为 bad case）</span>
        )}
      </div>

      {picked != null && picked <= 3 && (
        <div className="mt-2 border-t border-line pt-2">
          <div className="text-[11px] text-ink-faint">哪里不对？（bad case 分类）</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {RATING_REASONS.map((tag) => (
              <button
                key={tag}
                onClick={() => setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]))}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  tags.includes(tag)
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line text-ink-soft hover:border-line-strong'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <button
            onClick={confirm}
            className="mt-2 rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]"
          >
            提交 {picked} 分反馈
          </button>
        </div>
      )}
    </div>
  );
}

function TurnCard({ index, turn }: { index: number; turn: TraceTurn }) {
  return (
    <div className="mb-3 rounded-xl border border-line/70 bg-surface-soft/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-ink-soft">
          Turn {index + 1}
          <span className="ml-2 font-mono text-ink-faint">{turn.modelId}</span>
        </span>
        <span className="text-ink-faint">
          {(turn.latencyMs / 1000).toFixed(1)}s
          {turn.inputTokens != null ? ` · ${turn.inputTokens}→${turn.outputTokens ?? '?'} tok` : ''}
          {turn.cost != null ? ` · $${turn.cost.toFixed(4)}` : ''}
        </span>
      </div>

      {turn.toolCalls.map((tc, j) => (
        <div key={j} className="mt-2 rounded bg-surface-soft px-2 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span>🔧</span>
            <span className="font-mono font-medium text-ink">{tc.toolName}</span>
            <span className="font-mono text-ink-faint">{JSON.stringify(tc.args)}</span>
            <span className={tc.isError ? 'text-up' : 'text-down'}>
              {tc.isError ? '✗' : '✓'} {(tc.latencyMs / 1000).toFixed(1)}s
            </span>
          </div>
          {tc.result !== undefined && (
            <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all text-[10px] text-ink-faint">
              {typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result)}
            </pre>
          )}
        </div>
      ))}

      {turn.responseText && (
        <div className="mt-2 whitespace-pre-wrap rounded bg-surface-soft px-2 py-1.5 text-sm leading-relaxed text-ink">
          {turn.responseText}
        </div>
      )}
    </div>
  );
}
