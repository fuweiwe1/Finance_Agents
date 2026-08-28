import { useState } from 'react';
import { useAppStore } from '../../state/useAppStore';
import { useChatStore } from '../../state/useChatStore';
import { useQuote } from '../../hooks/usePolling';

export function ChatInput() {
  const [text, setText] = useState('');
  const selected = useAppStore((s) => s.selected);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const send = useChatStore((s) => s.send);
  const streaming = useChatStore((s) => s.streaming);
  const quote = useQuote(selected);

  const submit = async () => {
    const msg = text.trim();
    if (!msg || !activeSessionId || streaming) return;
    setText('');
    await send(activeSessionId, msg, { symbol: selected, name: quote?.name, price: quote?.price });
  };

  return (
    <div className="shrink-0 border-t border-line p-2">
      <div className="flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="输入问题，Enter 发送"
          className="input flex-1"
        />
        <button
          onClick={() => void submit()}
          disabled={streaming || !text.trim()}
          className="btn-primary shrink-0"
        >
          {streaming ? '…' : '发送'}
        </button>
      </div>
      <p className="mt-1 truncate text-[10px] text-ink-faint">
        当前上下文：{selected}
        {quote?.price ? ` · ${quote.price}` : ''} ｜ 模型按右上角配置的 API 调用
      </p>
    </div>
  );
}
