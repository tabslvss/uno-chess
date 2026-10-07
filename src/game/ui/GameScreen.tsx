import {
  ArrowLeft,
  Flag,
  Handshake,
  Link2,
  ListOrdered,
  Megaphone,
  RefreshCw,
  Repeat2,
  Settings2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Dialog, Spinner, Tip } from '@/components/ui';
import { other } from '@/game/board';
import { cardLetter, cardLinesText, cardName, COLORS } from '@/game/cards';
import { canCallUno, cardBlockReason, mustDiscardDead, resultText, topCard, vetoCards } from '@/game/engine';
import type { Card, Color, Side } from '@/game/types';
import { cn } from '@/lib/cn';
import { signed } from '@/lib/format';
import { useSettings } from '@/stores/settings';
import { BoardView } from './BoardView';
import { COLOR_HEX } from './cardArt';
import type { GameController } from './controller';
import { GameCard } from './GameCard';
import { Hand, type HandMode } from './Hand';
import { Piles } from './Piles';
import { PlayerStrip } from './PlayerStrip';
import { MoveList, SidePanel } from './SidePanel';
import { useElementSize } from './useElementSize';
import { Sidebar } from '@/components/Sidebar';
import { useGameFeedback } from './useGameFeedback';

const HAND_CARD_W = 'clamp(50px, min(10.5dvh, 15.5vw), 108px)';
const PILE_CARD_W = 'clamp(40px, 8dvh, 86px)';

export function GameScreen({ c }: { c: GameController }) {
  const { state, me } = c;
  const settings = useSettings();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<Card | null>(null);
  const [wildCard, setWildCard] = useState<Card | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmResign, setConfirmResign] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [areaRef, area] = useElementSize<HTMLDivElement>();

  useGameFeedback(state, me, c.mode !== 'local');

  // Reset transient UI between turns.
  useEffect(() => {
    setSelected([]);
    setWildCard(null);
    setHovered(null);
  }, [state.seq]);

  // Show the result dialog shortly after the game ends.
  useEffect(() => {
    if (!state.result) return setShowResult(false);
    const t = setTimeout(() => setShowResult(true), 700);
    return () => clearTimeout(t);
  }, [state.result]);

  const orientation: Side = flipped ? other(c.orientation) : c.orientation;
  const bottom = orientation;
  const top = other(bottom);
  const myTurn = me !== null && state.turn === me && !state.result && !c.busy;
  const hand = me ? state.hands[me] : state.hands[bottom];
  const deadDiscard = myTurn && mustDiscardDead(state);
  const vetoes = me && state.phase === 'kingCaptured' && state.turn === me ? vetoCards(state) : [];

  const handMode: HandMode = c.concealed
    ? 'idle'
    : !myTurn
      ? 'idle'
      : state.phase === 'draw2'
        ? 'select'
        : state.phase === 'card'
          ? deadDiscard
            ? 'discard'
            : 'play'
          : 'idle';

  const onCardClick = useCallback(
    (card: Card) => {
      if (!myTurn) return;
      if (state.phase === 'draw2') {
        const need = Math.min(2, state.hands[me!].length);
        setSelected((s) => (s.includes(card.id) ? s.filter((x) => x !== card.id) : s.length >= need ? [...s.slice(1), card.id] : [...s, card.id]));
        return;
      }
      if (state.phase !== 'card') return;
      if (deadDiscard) {
        c.act({ type: 'discardDead', cardId: card.id });
        return;
      }
      const reason = cardBlockReason(state, card);
      if (reason) {
        toast(reason);
        return;
      }
      if (card.kind === 'wild') setWildCard(card);
      else c.act({ type: 'play', cardId: card.id });
    },
    [myTurn, state, me, deadDiscard, c],
  );

  // Keyboard shortcuts: 1–9 play cards, U = UNO, F = flip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key) && handMode !== 'idle') {
        const card = hand[Number(e.key) - 1];
        if (card) onCardClick(card);
      } else if (e.key.toLowerCase() === 'u' && me && canCallUno(state, me)) {
        c.act({ type: 'callUno' });
      } else if (e.key.toLowerCase() === 'f') setFlipped((f) => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hand, handMode, onCardClick, me, state, c]);

  const lastPileBy = useMemo<Side | null>(() => {
    for (let i = state.history.length - 1; i >= 0; i--) {
      const e = state.history[i]!;
      if (e.card) return e.side;
    }
    return null;
  }, [state.history]);

  // Board size: largest square that fits next to the piles with both player strips.
  const pilesW = area.width >= 640 ? Math.min(110, Math.max(70, area.height * 0.11)) + 24 : 0;
  const boardSize = Math.max(200, Math.floor(Math.min(area.width - pilesW, area.height - 2 * 52 - 16)));

  const top_ = topCard(state);
  const prompt = promptText(c, myTurn, deadDiscard, selected.length);
  const meUno = me ? state.uno[me] : 'none';
  const oppSide = me ? other(me) : top;
  const oppUno = state.uno[oppSide];

  const catchButton =
    me && (oppUno === 'needed' || oppUno === 'forgot') && !state.result ? (
      <motion.button
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="btn-mustard !px-3 !py-1.5"
        data-testid="catch-uno"
        onClick={() => {
          if (oppUno === 'needed') toast('Too early — they can still call it this turn!');
          else c.act({ type: 'catchUno' });
        }}
      >
        <Megaphone size={15} /> Catch!
      </motion.button>
    ) : null;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {c.canAbort && c.abort && (
        <button className="btn-secondary !py-2" onClick={c.abort}>
          <X size={16} /> Abort
        </button>
      )}
      {c.offerDraw && !state.result && (
        <button className="btn-secondary !py-2" onClick={c.offerDraw} disabled={c.drawOffer === me} data-testid="offer-draw">
          <Handshake size={16} /> {c.drawOffer === me ? 'Draw offered' : 'Offer draw'}
        </button>
      )}
      {!state.result && me && (
        <button
          className="btn-secondary !py-2"
          data-testid="resign"
          onClick={() => (settings.confirmResign ? setConfirmResign(true) : c.resign())}
        >
          <Flag size={16} /> Resign
        </button>
      )}
      {state.result && (
        <button className="btn-primary !py-2" onClick={() => setShowResult(true)}>
          Result
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden" data-board={settings.board}>
      <Sidebar compact className="hidden lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
      {/* ── Top bar ── */}
      <header className="flex h-12 shrink-0 items-center gap-2 px-2 sm:px-4">
        <Tip content="Leave game">
          <button className="btn-ghost !p-2" onClick={() => navigate('/play')} aria-label="Back to play menu">
            <ArrowLeft size={20} />
          </button>
        </Tip>
        <Link to="/" className="hidden items-center gap-2 sm:flex lg:hidden">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-display text-base font-bold sm:text-lg">{c.title}</div>
          {c.subtitle && <div className="truncate text-xs font-bold text-ink-soft">{c.subtitle}</div>}
        </div>
        {c.connection && c.connection !== 'open' && (
          <span className="chip bg-uno-red/15 text-uno-red">
            {c.connection === 'reconnecting' ? <Spinner className="h-3 w-3 border-2" /> : <WifiOff size={12} />}
            {c.connection}
          </span>
        )}
        {c.connection === 'open' && (
          <Tip content={`Connected${c.spectators ? ` · ${c.spectators} watching` : ''}`}>
            <span className="hidden text-sage sm:inline">
              <Wifi size={18} />
            </span>
          </Tip>
        )}
        {c.shareUrl && (
          <Tip content="Copy link to this game">
            <button
              className="btn-ghost !p-2"
              aria-label="Copy game link"
              onClick={() => {
                void navigator.clipboard?.writeText(c.shareUrl!);
                toast.success('Link copied');
              }}
            >
              <Link2 size={19} />
            </button>
          </Tip>
        )}
        <Tip content="Flip board (F)">
          <button className="btn-ghost !p-2" onClick={() => setFlipped((f) => !f)} aria-label="Flip board">
            <Repeat2 size={19} />
          </button>
        </Tip>
        <Tip content={settings.sound ? 'Mute' : 'Unmute'}>
          <button className="btn-ghost !p-2" onClick={() => settings.set({ sound: !settings.sound })} aria-label="Toggle sound">
            {settings.sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
        </Tip>
        <Tip content="Settings">
          <Link to="/settings" className="btn-ghost !p-2" aria-label="Settings">
            <Settings2 size={19} />
          </Link>
        </Tip>
        <button className="btn-ghost !p-2 lg:hidden" onClick={() => setSheet(true)} aria-label="Moves and chat">
          <ListOrdered size={19} />
        </button>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 gap-4 px-2 pb-2 sm:px-4 lg:pb-4">
        {/* ── Play column ── */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={areaRef} className="flex min-h-0 flex-1 items-center justify-center gap-6">
            {pilesW > 0 && (
              <Piles
                vertical
                discard={state.discard}
                deckCount={state.deck.length}
                activeColor={state.activeColor}
                lastBy={lastPileBy}
                bottomSide={bottom}
                cardWidth={PILE_CARD_W}
              />
            )}
            <div className="flex flex-col gap-2" style={{ width: boardSize }}>
              <PlayerStrip
                side={top}
                seat={c.seats[top]}
                active={state.turn === top && !state.result}
                clock={c.clock}
                mine={me === top}
                handCount={state.hands[top].length}
                uno={state.uno[top]}
                thinking={c.busy}
                action={top === oppSide ? catchButton : null}
              />
              <div className="relative" style={{ width: boardSize, height: boardSize }}>
                <BoardView
                  state={state}
                  orientation={orientation}
                  interactive={myTurn && state.phase === 'move' && !c.concealed}
                  previewCard={handMode === 'play' ? hovered : null}
                  onMove={(m) => c.act({ type: 'move', ...m })}
                />
                <AnimatePresence>
                  {c.drawOffer && c.drawOffer !== me && me && !state.result && (
                    <motion.div
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      className="card-surface absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 p-2 pl-4"
                    >
                      <Handshake size={18} className="text-sage" />
                      <span className="font-bold">Draw offered</span>
                      <button className="btn-sage !py-1.5" onClick={() => c.answerDraw?.(true)}>
                        Accept
                      </button>
                      <button className="btn-ghost !py-1.5" onClick={() => c.answerDraw?.(false)}>
                        Decline
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <PlayerStrip
                side={bottom}
                seat={c.seats[bottom]}
                active={state.turn === bottom && !state.result}
                clock={c.clock}
                mine={me === bottom}
                uno={state.uno[bottom]}
                thinking={c.busy && me !== bottom}
                action={bottom === oppSide ? catchButton : null}
              />
            </div>
          </div>

          {/* ── Prompt row ── */}
          <div className="mt-2 flex min-h-11 items-center justify-center gap-3 px-1">
            {pilesW === 0 && (
              <Piles
                discard={state.discard}
                deckCount={state.deck.length}
                activeColor={state.activeColor}
                lastBy={lastPileBy}
                bottomSide={bottom}
                cardWidth="34px"
                className="!gap-2 [&_span]:hidden"
              />
            )}
            <motion.p
              key={prompt}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'min-w-0 text-center text-sm font-extrabold sm:text-base',
                myTurn ? 'text-ink' : 'text-ink-soft',
              )}
              data-testid="prompt"
            >
              {prompt}
              {myTurn && state.phase === 'card' && top_ && !deadDiscard && (
                <span className="ml-1.5 hidden text-ink-soft sm:inline">
                  (match{' '}
                  <span style={{ color: state.activeColor ? COLOR_HEX[state.activeColor] : undefined }}>
                    {state.activeColor ?? 'anything'}
                  </span>
                  {top_.kind === 'number' ? ` or ${cardLetter(top_)}` : top_.kind !== 'wild' ? ` or ${cardName(top_).split(' ').slice(1).join(' ')}` : ''})
                </span>
              )}
            </motion.p>
            {state.phase === 'draw2' && myTurn && (
              <button
                className="btn-primary !py-2"
                disabled={selected.length !== Math.min(2, hand.length)}
                onClick={() => c.act({ type: 'draw2Discard', cardIds: selected })}
                data-testid="confirm-draw2"
              >
                <RefreshCw size={16} /> Swap {selected.length}/{Math.min(2, hand.length)}
              </button>
            )}
            <AnimatePresence>
              {me && (meUno === 'needed' || meUno === 'forgot') && !state.result && (
                <motion.button
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="btn-primary animate-pulse-ring !rounded-full !px-5 font-display !text-lg"
                  onClick={() => c.act({ type: 'callUno' })}
                  data-testid="call-uno"
                >
                  UNO!
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* ── Hand ── */}
          <div className="relative mt-1 flex shrink-0 justify-center pb-4 pt-4" style={{ minHeight: `calc(${HAND_CARD_W} * 1.546 + 36px)` }}>
            {c.concealed ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <p className="font-display text-lg font-bold">Pass the device to {c.seats[state.turn].name}</p>
                <button className="btn-primary" onClick={c.reveal}>
                  I’m {c.seats[state.turn].name} — show my cards
                </button>
              </div>
            ) : (
              <Hand
                cards={hand}
                mode={handMode}
                blockReason={(card) => cardBlockReason(state, card)}
                selected={selected}
                onCardClick={onCardClick}
                onHover={setHovered}
                cardWidth={HAND_CARD_W}
                className="max-w-[min(100%,900px)]"
              />
            )}
          </div>
          <div className="mt-1 flex justify-center lg:hidden">{toolbar}</div>
        </section>

        {/* ── Side panel (desktop) ── */}
        <aside className="hidden w-[300px] shrink-0 flex-col gap-3 lg:flex xl:w-[340px]">
          <div className="card-surface min-h-0 flex-1 overflow-hidden">
            <SidePanel
              history={state.history}
              names={{ w: c.seats.w.name, b: c.seats.b.name }}
              chat={c.chat}
              onChat={c.sendChat}
              me={me}
            />
          </div>
          <div className="card-surface p-3">
            <RulesHint state={state} />
            <div className="mt-3">{toolbar}</div>
          </div>
        </aside>
      </div>

      {/* ── Dialogs ── */}
      <Dialog open={!!wildCard} onOpenChange={(o) => !o && setWildCard(null)} title="Pick a colour" description="Your opponent will have to match it.">
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map((color: Color) => {
            const count = hand.filter((x) => x.color === color).length;
            return (
              <button
                key={color}
                data-testid={`wild-${color}`}
                className="flex h-20 flex-col items-center justify-center rounded-2xl font-display text-lg font-bold capitalize text-white shadow-md transition hover:-translate-y-0.5"
                style={{ background: COLOR_HEX[color] }}
                onClick={() => {
                  c.act({ type: 'play', cardId: wildCard!.id, color });
                  setWildCard(null);
                }}
              >
                {color}
                <span className="text-xs font-bold opacity-90">{count} in hand</span>
              </button>
            );
          })}
        </div>
      </Dialog>

      <Dialog open={vetoes.length > 0 || (me !== null && state.phase === 'kingCaptured' && state.turn === me)} dismissable={false} title="Your king was captured!" description="Play a matching Reverse to undo the capture, or accept defeat.">
        <div className="flex flex-col gap-3">
          {vetoes.length > 0 && (
            <div className="flex justify-center gap-2">
              {vetoes.map((v) => (
                <GameCard key={v.id} card={v} width={70} interactive playable onClick={() => c.act({ type: 'veto', cardId: v.id })} />
              ))}
            </div>
          )}
          <div className="flex gap-2">
            {vetoes[0] && (
              <button className="btn-primary flex-1" onClick={() => c.act({ type: 'veto', cardId: vetoes[0]!.id })} data-testid="veto">
                <RefreshCw size={16} /> Reverse it!
              </button>
            )}
            <button className="btn-secondary flex-1" onClick={() => c.act({ type: 'acceptCapture' })}>
              Accept defeat
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog open={confirmResign} onOpenChange={setConfirmResign} title="Resign this game?" description="Your opponent will be awarded the win.">
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setConfirmResign(false)}>
            Keep playing
          </button>
          <button
            className="btn-primary flex-1"
            data-testid="confirm-resign"
            onClick={() => {
              setConfirmResign(false);
              c.resign();
            }}
          >
            <Flag size={16} /> Resign
          </button>
        </div>
      </Dialog>

      <ResultDialog c={c} open={showResult && !!state.result} onClose={() => setShowResult(false)} />

      <Dialog open={sheet} onOpenChange={setSheet} title="Game" className="h-[80dvh] !p-0 [&>h2]:p-5 [&>div]:mt-0">
        <div className="flex h-[calc(80dvh-4.5rem)] flex-col">
          <div className="min-h-0 flex-1">
            {c.chat ? (
              <SidePanel history={state.history} names={{ w: c.seats.w.name, b: c.seats.b.name }} chat={c.chat} onChat={c.sendChat} me={me} />
            ) : (
              <MoveList history={state.history} names={{ w: c.seats.w.name, b: c.seats.b.name }} />
            )}
          </div>
          <div className="border-t border-line p-3">
            <RulesHint state={state} />
          </div>
        </div>
      </Dialog>
      </div>
    </div>
  );
}

function promptText(c: GameController, myTurn: boolean, dead: boolean, selected: number): string {
  const { state, me } = c;
  if (state.result) return resultText(state.result, { w: c.seats.w.name, b: c.seats.b.name });
  const turnName = c.seats[state.turn].name;
  if (state.phase === 'kingCaptured') return myTurn ? 'Your king was captured!' : `${turnName} may veto with a Reverse…`;
  if (!myTurn) {
    if (me === null) return `${turnName} to play`;
    return c.busy ? `${turnName} is thinking…` : `Waiting for ${turnName}…`;
  }
  switch (state.phase) {
    case 'card':
      return dead ? 'No playable card — tap one to discard it' : 'Play a card';
    case 'move':
      return state.played?.kind === 'wild' ? 'Wild! Move any piece' : `Move a piece on the ${cardLinesText(state.played!)}`;
    case 'draw2':
      return `Draw Two — pick ${2 - selected > 0 ? 2 - selected : 0} more to swap`;
    default:
      return '';
  }
}

function RulesHint({ state }: { state: import('@/game/types').GameState }) {
  return (
    <div className="space-y-1 text-xs text-ink-soft">
      <p>
        <span className="font-extrabold text-ink">Cards:</span> A–H unlock that file & rank (A = a-file + rank 1). Wild moves anything,
        Reverse undoes their last move, +2 swaps two cards.
      </p>
      <p>
        <span className="font-extrabold text-ink">Win:</span> capture the king. No check rule!{' '}
        {state.noMoveStreak > 0 && (
          <span className="font-bold text-brand">
            {6 - state.noMoveStreak} card{6 - state.noMoveStreak === 1 ? '' : 's'} without a move until a draw.
          </span>
        )}
      </p>
    </div>
  );
}

function ResultDialog({ c, open, onClose }: { c: GameController; open: boolean; onClose: () => void }) {
  const r = c.state.result;
  const navigate = useNavigate();
  if (!r) return null;
  const me = c.me;
  const title =
    r.reason === 'aborted'
      ? 'Game aborted'
      : !r.winner
        ? 'Draw'
        : me === null || c.mode === 'local'
          ? `${c.seats[r.winner].name} wins!`
          : r.winner === me
            ? 'You won!'
            : 'You lost';
  const change = c.ratingChange && me ? c.ratingChange[me] : null;
  const delta = change ? change.after - change.before : 0;
  const oppWantsRematch = me && c.rematch ? c.rematch[other(me)] : false;
  const iWantRematch = me && c.rematch ? c.rematch[me] : false;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={title} description={resultText(r, { w: c.seats.w.name, b: c.seats.b.name })}>
      <div className="space-y-4" data-testid="result-dialog">
        {change && (
          <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-4">
            <div>
              <div className="label">Rating</div>
              <div className="font-display text-3xl font-bold">{change.after}</div>
            </div>
            <span className={cn('chip text-base', delta >= 0 ? 'bg-sage/20 text-sage-deep dark:text-sage' : 'bg-uno-red/15 text-uno-red')}>
              {signed(delta)}
            </span>
          </div>
        )}
        {c.rated && !change && <p className="text-sm text-ink-soft">Updating ratings…</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          {c.requestRematch && (
            <button
              className="btn-primary flex-1"
              onClick={() => c.requestRematch!(!iWantRematch)}
              data-testid="rematch"
            >
              <RefreshCw size={16} />
              {iWantRematch ? 'Waiting for opponent…' : oppWantsRematch ? 'Accept rematch' : 'Rematch'}
            </button>
          )}
          {c.newGame && (
            <button className="btn-primary flex-1" onClick={c.newGame} data-testid="new-game">
              <RefreshCw size={16} /> Play again
            </button>
          )}
          <button className="btn-secondary flex-1" onClick={() => navigate('/play')}>
            New opponent
          </button>
        </div>
        <button className="btn-ghost w-full" onClick={onClose}>
          View board
        </button>
      </div>
    </Dialog>
  );
}
