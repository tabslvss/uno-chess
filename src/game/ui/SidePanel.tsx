import { MessageCircle, ScrollText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cardShortLabel } from '@/game/cards';
import type { HistoryEntry, Side } from '@/game/types';
import { cn } from '@/lib/cn';
import { QUICK_CHAT } from '@/net/protocol';
import { Tabs } from '@/components/ui';
import type { ChatLine } from '@/net/useOnlineGame';
import { COLOR_HEX } from './cardArt';

function CardChip({ entry }: { entry: HistoryEntry }) {
  const c = entry.card;
  if (!c) return null;
  const color = c.kind === 'wild' ? entry.color : c.color;
  return (
    <span
      className="inline-grid h-5 min-w-5 place-items-center rounded-md px-1 text-[0.68rem] font-black text-white shadow-sm"
      style={{
        background:
          c.kind === 'wild' && !color
            ? 'conic-gradient(#d64534 0 25%, #e9b824 0 50%, #2fa660 0 75%, #2f6fd6 0)'
            : COLOR_HEX[color ?? 'red'],
        outline: c.kind === 'wild' ? '2px solid #2b2420' : undefined,
      }}
    >
      {cardShortLabel(c)}
    </span>
  );
}

function describe(e: HistoryEntry): string {
  switch (e.kind) {
    case 'move':
      return e.san ?? '';
    case 'reverse':
      return `undid ${e.san}`;
    case 'veto':
      return `vetoed ${e.san}!`;
    case 'draw2':
      return `swapped ${e.discarded?.length ?? 0}`;
    case 'dead':
      return 'discarded';
    case 'uno':
      return 'called UNO!';
    case 'catch':
      return 'caught UNO!';
    case 'end':
      return e.text ?? 'Game over';
  }
}

export function MoveList({ history, names }: { history: HistoryEntry[]; names: Record<Side, string> }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [history.length]);
  let turn = 0;
  if (!history.length) {
    return <p className="p-4 text-center text-sm text-ink-faint">Moves will appear here.</p>;
  }
  return (
    <ol className="thin-scrollbar h-full space-y-0.5 overflow-y-auto p-2 text-sm" aria-label="Move history">
      {history.map((e, i) => {
        const isTurn = e.kind === 'move' || e.kind === 'reverse' || e.kind === 'draw2' || e.kind === 'dead' || e.kind === 'veto';
        if (isTurn) turn++;
        return (
          <li
            key={i}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1',
              e.kind === 'end' ? 'bg-mustard/20 font-extrabold' : i % 2 ? 'bg-surface-2/60' : '',
            )}
          >
            <span className="w-6 shrink-0 text-right font-mono text-xs text-ink-faint">{isTurn ? turn : ''}</span>
            <span
              className={cn('h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-ink/30', e.side === 'w' ? 'bg-[#f7f1e6]' : 'bg-[#2b2420]')}
              title={names[e.side]}
            />
            <CardChip entry={e} />
            <span className={cn('min-w-0 truncate font-bold', e.kind === 'move' && 'font-mono')}>{describe(e)}</span>
          </li>
        );
      })}
      <div ref={end} />
    </ol>
  );
}

export function ChatBox({ chat, onSend, me }: { chat: ChatLine[]; onSend?: (i: number) => void; me: Side | null }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [chat.length]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="thin-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {chat.length === 0 && <p className="p-3 text-center text-sm text-ink-faint">Say hi with a quick message.</p>}
        {chat.map((c) => (
          <div key={c.id} className={cn('flex', c.side === me ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%] rounded-2xl px-3 py-1.5 text-sm', c.side === me ? 'bg-brand text-white' : 'bg-surface-2')}>
              {c.side !== me && <span className="mr-1 font-extrabold">{c.name}:</span>}
              {c.text}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {onSend && me && (
        <div className="flex flex-wrap gap-1.5 border-t border-line p-2">
          {QUICK_CHAT.map((t, i) => (
            <button key={t} type="button" onClick={() => onSend(i)} className="chip bg-surface-2 py-1 hover:bg-mustard/30">
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SidePanel({
  history,
  names,
  chat,
  onChat,
  me,
}: {
  history: HistoryEntry[];
  names: Record<Side, string>;
  chat?: ChatLine[];
  onChat?: (i: number) => void;
  me: Side | null;
}) {
  const [tab, setTab] = useState('moves');
  const unread = useRef(0);
  const seen = useRef(chat?.length ?? 0);
  if (tab === 'chat') seen.current = chat?.length ?? 0;
  unread.current = (chat?.length ?? 0) - seen.current;
  const items = [
    {
      value: 'moves',
      label: (
        <span className="flex items-center justify-center gap-1.5">
          <ScrollText size={15} /> Moves
        </span>
      ),
      content: <MoveList history={history} names={names} />,
    },
  ];
  if (chat) {
    items.push({
      value: 'chat',
      label: (
        <span className="flex items-center justify-center gap-1.5">
          <MessageCircle size={15} /> Chat
          {unread.current > 0 && <span className="chip bg-brand px-1.5 text-white">{unread.current}</span>}
        </span>
      ),
      content: <ChatBox chat={chat} onSend={onChat} me={me} />,
    });
  }
  return <Tabs value={tab} onValueChange={setTab} items={items} className="h-full" listClassName="m-2 mb-0" />;
}
