import {
  applyMove,
  findKing,
  INITIAL_CASTLING,
  initialBoard,
  isLoneKing,
  needsPromotion,
  other,
  pieceTargets,
  sideOf,
  sqName,
  toSan,
  typeOf,
} from './board';
import { cardMatches, cardName, cardUnlocksSquare, createDeck, HAND_SIZE, NO_MOVE_DRAW_LIMIT } from './cards';
import { nextRandom, randomSeed, shuffle } from './rng';
import type {
  ActionResult,
  Card,
  Color,
  GameAction,
  GameResult,
  GameState,
  HistoryEntry,
  Move,
  MoveRecord,
  ResultReason,
  Side,
  UnoStatus,
} from './types';

export interface NewGameOptions {
  seed?: number;
}

/** Shuffle, deal 7 each, and flip a starter card (its action is ignored). */
export function createGame(opts: NewGameOptions = {}): GameState {
  const [deck0, rng0] = shuffle(createDeck(), (opts.seed ?? randomSeed()) >>> 0);
  const deck = deck0.slice();
  const hands: Record<Side, Card[]> = { w: [], b: [] };
  for (let i = 0; i < HAND_SIZE; i++) {
    hands.w.push(deck.pop()!);
    hands.b.push(deck.pop()!);
  }
  const starter = deck.pop()!;
  return {
    v: 2,
    board: initialBoard(),
    turn: 'w',
    phase: 'card',
    castling: { ...INITIAL_CASTLING },
    ep: null,
    hands,
    deck,
    discard: [starter],
    activeColor: starter.color,
    played: null,
    lastMove: null,
    noMoveStreak: 0,
    uno: { w: 'none', b: 'none' },
    pendingCapture: null,
    result: null,
    history: [],
    turnCount: 0,
    rng: rng0,
    seq: 0,
  };
}

// ───────────────────────────── queries ─────────────────────────────

export function topCard(state: GameState): Card | null {
  return state.discard[state.discard.length - 1] ?? null;
}

/** All moves the current player could make with `card` (pseudo-legal, card-restricted). */
export function movesForCard(state: GameState, card: Card, side: Side = state.turn): Move[] {
  if (card.kind !== 'number' && card.kind !== 'wild') return [];
  const out: Move[] = [];
  for (let from = 0; from < 64; from++) {
    const p = state.board[from];
    if (!p || sideOf(p) !== side) continue;
    if (!cardUnlocksSquare(card, from)) continue;
    for (const to of pieceTargets(state.board, from, state.castling, state.ep)) out.push({ from, to });
  }
  return out;
}

/** Squares holding pieces that can move with the played card. */
export function movableSquares(state: GameState): number[] {
  if (state.phase !== 'move' || !state.played) return [];
  return [...new Set(movesForCard(state, state.played).map((m) => m.from))];
}

/** Destinations for the piece on `from` under the played card. */
export function targetsFrom(state: GameState, from: number): number[] {
  if (state.phase !== 'move' || !state.played) return [];
  if (!cardUnlocksSquare(state.played, from)) return [];
  const p = state.board[from];
  if (!p || sideOf(p) !== state.turn) return [];
  return pieceTargets(state.board, from, state.castling, state.ep);
}

/** Why a card cannot be played right now ('' if it can). */
export function cardBlockReason(state: GameState, card: Card, side: Side = state.turn): string {
  if (state.phase !== 'card') return 'Not the card phase.';
  if (!cardMatches(card, topCard(state), state.activeColor)) {
    const top = topCard(state);
    return state.activeColor && top?.kind === 'wild'
      ? `Must match ${state.activeColor} (wild colour).`
      : `Doesn't match ${top ? cardName(top) : 'the pile'}.`;
  }
  switch (card.kind) {
    case 'number':
      return movesForCard(state, card, side).length ? '' : 'No piece on that file or rank can move.';
    case 'wild':
      return movesForCard(state, card, side).length ? '' : 'No piece can move.';
    case 'reverse':
      return state.lastMove && state.lastMove.by === other(side) ? '' : 'No opponent move to undo.';
    case 'draw2':
      return '';
  }
}

export function canPlayCard(state: GameState, card: Card, side: Side = state.turn): boolean {
  return cardBlockReason(state, card, side) === '';
}

export function playableCards(state: GameState, side: Side = state.turn): Card[] {
  return state.hands[side].filter((c) => canPlayCard(state, c, side));
}

/** True when the current player has no playable card and must discard one. */
export function mustDiscardDead(state: GameState): boolean {
  return state.phase === 'card' && playableCards(state).length === 0 && state.hands[state.turn].length > 0;
}

/** Reverse cards `side` could play to veto a king capture. */
export function vetoCards(state: GameState): Card[] {
  if (state.phase !== 'kingCaptured') return [];
  return state.hands[state.turn].filter(
    (c) => c.kind === 'reverse' && cardMatches(c, topCard(state), state.activeColor),
  );
}

export function canCatchUno(state: GameState, catcher: Side): boolean {
  return !state.result && state.uno[other(catcher)] === 'forgot';
}

export function canCallUno(state: GameState, side: Side): boolean {
  const s = state.uno[side];
  return !state.result && (s === 'needed' || s === 'forgot');
}

// ───────────────────────────── helpers ─────────────────────────────

function fail(state: GameState, error: string): ActionResult {
  return { ok: false, state, error };
}

function ok(state: GameState): ActionResult {
  return { ok: true, state: { ...state, seq: state.seq + 1 } };
}

function log(state: GameState, entry: HistoryEntry): GameState {
  return { ...state, history: [...state.history, entry] };
}

function removeFromHand(state: GameState, side: Side, cardId: string): [GameState, Card | null] {
  const hand = state.hands[side];
  const card = hand.find((c) => c.id === cardId) ?? null;
  if (!card) return [state, null];
  return [{ ...state, hands: { ...state.hands, [side]: hand.filter((c) => c.id !== cardId) } }, card];
}

/** Draw n cards for `side`, reshuffling the discard pile (all but the top card) when the deck runs out. */
function drawCards(state: GameState, side: Side, n: number): GameState {
  let { deck, discard, rng } = state;
  const hand = [...state.hands[side]];
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      if (discard.length <= 1) break;
      const top = discard[discard.length - 1]!;
      [deck, rng] = shuffle(discard.slice(0, -1), rng);
      discard = [top];
    }
    deck = deck.slice();
    hand.push(deck.pop()!);
  }
  return { ...state, deck, discard, rng, hands: { ...state.hands, [side]: hand } };
}

function endGame(state: GameState, winner: Side | null, reason: ResultReason, text?: string): GameState {
  const result: GameResult = { winner, reason };
  return log(
    { ...state, phase: 'over', result, pendingCapture: null },
    { side: state.turn, kind: 'end', card: null, text: text ?? resultText(result) },
  );
}

export function resultText(result: GameResult, names?: Record<Side, string>): string {
  const name = (s: Side) => names?.[s] ?? (s === 'w' ? 'White' : 'Black');
  if (!result.winner) {
    switch (result.reason) {
      case 'sixNoMove':
        return 'Draw — six cards in a row with no piece moving.';
      case 'agreement':
        return 'Draw by agreement.';
      case 'aborted':
        return 'Game aborted.';
      case 'timeout':
        return 'Draw — time ran out.';
      default:
        return 'Draw.';
    }
  }
  const w = name(result.winner);
  const l = name(other(result.winner));
  switch (result.reason) {
    case 'kingCapture':
      return `${w} captured the king!`;
    case 'unoCaught':
      return `${l} forgot to call UNO — ${w} wins!`;
    case 'resign':
      return `${l} resigned — ${w} wins.`;
    case 'timeout':
      return `${l} ran out of time — ${w} wins.`;
    case 'abandon':
      return `${l} left the game — ${w} wins.`;
    default:
      return `${w} wins.`;
  }
}

/** Keep each side's UNO status in sync with the board. */
function refreshUno(state: GameState): GameState {
  let changed = false;
  const uno = { ...state.uno };
  for (const side of ['w', 'b'] as Side[]) {
    const lone = isLoneKing(state.board, side);
    let next: UnoStatus = uno[side];
    if (!lone) next = 'none';
    else if (next === 'none') next = 'needed';
    if (next !== uno[side]) {
      uno[side] = next;
      changed = true;
    }
  }
  return changed ? { ...state, uno } : state;
}

/**
 * Finish the current player's turn: draw a replacement card, apply the
 * six-card no-move draw rule, flag a forgotten UNO, and pass the turn.
 */
function finishTurn(state: GameState, pieceMoved: boolean, nextEp: number | null): GameState {
  const side = state.turn;
  let s = drawCards(state, side, 1);
  s = { ...s, noMoveStreak: pieceMoved ? 0 : s.noMoveStreak + 1, played: null, ep: nextEp };
  if (s.uno[side] === 'needed') s = { ...s, uno: { ...s.uno, [side]: 'forgot' } };
  if (s.noMoveStreak >= NO_MOVE_DRAW_LIMIT) return endGame(s, null, 'sixNoMove');
  return { ...s, turn: other(side), phase: 'card', turnCount: s.turnCount + 1 };
}

function placeOnDiscard(state: GameState, card: Card, color: Color | null): GameState {
  return { ...state, discard: [...state.discard, card], activeColor: color };
}

/** Undo a move record (Reverse card / veto). */
function undoRecord(state: GameState, rec: MoveRecord): GameState {
  return refreshUno({
    ...state,
    board: rec.boardBefore.slice(),
    castling: { ...rec.castlingBefore },
    lastMove: null,
  });
}

// ───────────────────────────── actions ─────────────────────────────

function playCard(state: GameState, side: Side, cardId: string, color?: Color): ActionResult {
  if (state.phase !== 'card') return fail(state, 'You can’t play a card right now.');
  const card = state.hands[side].find((c) => c.id === cardId);
  if (!card) return fail(state, 'That card isn’t in your hand.');
  const reason = cardBlockReason(state, card, side);
  if (reason) return fail(state, reason);
  if (card.kind === 'wild' && !color) return fail(state, 'Choose a colour for the Wild.');

  let [s] = removeFromHand(state, side, cardId);
  const active = card.kind === 'wild' ? color! : card.color;
  s = placeOnDiscard(s, card, active);

  switch (card.kind) {
    case 'number':
    case 'wild':
      return ok({ ...s, phase: 'move', played: card });
    case 'draw2': {
      if (s.hands[side].length === 0) {
        s = log(s, { side, kind: 'draw2', card, discarded: [] });
        return ok(finishTurn(s, false, null));
      }
      return ok({ ...s, phase: 'draw2', played: card });
    }
    case 'reverse': {
      const rec = s.lastMove!;
      s = undoRecord(s, rec);
      s = log(s, { side, kind: 'reverse', card, san: rec.san, from: rec.to, to: rec.from });
      // The opponent regains the en passant chance they had before their undone move.
      return ok(finishTurn(s, false, rec.epBefore));
    }
  }
}

function makeMove(state: GameState, side: Side, move: Move): ActionResult {
  if (state.phase !== 'move' || !state.played) return fail(state, 'Play a card first.');
  const card = state.played;
  const piece = state.board[move.from];
  if (!piece || sideOf(piece) !== side) return fail(state, 'That’s not your piece.');
  if (!cardUnlocksSquare(card, move.from)) return fail(state, `The ${cardName(card)} doesn’t unlock ${sqName(move.from)}.`);
  if (!pieceTargets(state.board, move.from, state.castling, state.ep).includes(move.to)) {
    return fail(state, 'Illegal move.');
  }
  const promo = needsPromotion(state.board, move.from, move.to);
  if (promo && move.promotion && !['Q', 'R', 'B', 'N'].includes(move.promotion)) {
    return fail(state, 'Invalid promotion piece.');
  }
  const m: Move = { from: move.from, to: move.to, promotion: promo ? (move.promotion ?? 'Q') : undefined };
  const san = toSan(state.board, state.castling, state.ep, m);
  const applied = applyMove(state.board, state.castling, state.ep, m);
  const record: MoveRecord = { ...applied.record, san };

  let s: GameState = refreshUno({
    ...state,
    board: applied.board,
    castling: applied.castling,
    lastMove: record,
  });
  s = log(s, {
    side,
    kind: 'move',
    card,
    color: card.kind === 'wild' ? s.activeColor : undefined,
    san,
    from: m.from,
    to: m.to,
  });

  if (record.captured && typeOf(record.captured) === 'K') {
    const victim = other(side);
    s = drawCards({ ...s, noMoveStreak: 0, played: null }, side, 1);
    s = { ...s, pendingCapture: record, turn: victim, phase: 'kingCaptured', ep: null };
    if (vetoCards(s).length === 0) return ok(endGame(s, side, 'kingCapture'));
    return ok(s);
  }

  return ok(finishTurn(s, true, applied.ep));
}

function discardDead(state: GameState, side: Side, cardId: string): ActionResult {
  if (state.phase !== 'card') return fail(state, 'You can’t discard right now.');
  if (playableCards(state, side).length > 0) return fail(state, 'You have a playable card — you must play it.');
  let [s, card] = removeFromHand(state, side, cardId);
  if (!card) return fail(state, 'That card isn’t in your hand.');
  s = placeOnDiscard(s, card, card.color);
  s = log(s, { side, kind: 'dead', card });
  return ok(finishTurn(s, false, null));
}

function draw2Discard(state: GameState, side: Side, cardIds: string[]): ActionResult {
  if (state.phase !== 'draw2') return fail(state, 'No Draw Two to resolve.');
  const need = Math.min(2, state.hands[side].length);
  const unique = [...new Set(cardIds)];
  if (unique.length !== need) return fail(state, `Choose ${need} card${need === 1 ? '' : 's'} to discard.`);
  let s = state;
  const discarded: Card[] = [];
  for (const id of unique) {
    const [next, card] = removeFromHand(s, side, id);
    if (!card) return fail(state, 'That card isn’t in your hand.');
    s = next;
    discarded.push(card);
  }
  // Discards are slipped under the Draw Two so it stays the card to match.
  const top = s.discard[s.discard.length - 1]!;
  s = { ...s, discard: [...s.discard.slice(0, -1), ...discarded, top] };
  s = drawCards(s, side, discarded.length);
  s = log(s, { side, kind: 'draw2', card: state.played, discarded });
  return ok(finishTurn(s, false, null));
}

function veto(state: GameState, side: Side, cardId: string): ActionResult {
  if (state.phase !== 'kingCaptured' || !state.pendingCapture) return fail(state, 'Nothing to veto.');
  const card = vetoCards(state).find((c) => c.id === cardId);
  if (!card) return fail(state, 'You need a matching Reverse to veto.');
  const rec = state.pendingCapture;
  let [s] = removeFromHand(state, side, cardId);
  s = placeOnDiscard(s, card, card.color);
  s = undoRecord({ ...s, pendingCapture: null, phase: 'card' }, rec);
  s = log(s, { side, kind: 'veto', card, san: rec.san, from: rec.to, to: rec.from });
  return ok(finishTurn(s, false, rec.epBefore));
}

function acceptCapture(state: GameState): ActionResult {
  if (state.phase !== 'kingCaptured' || !state.pendingCapture) return fail(state, 'Nothing to accept.');
  return ok(endGame(state, state.pendingCapture.by, 'kingCapture'));
}

function callUno(state: GameState, side: Side): ActionResult {
  if (!canCallUno(state, side)) return fail(state, 'You don’t need to call UNO.');
  const s = log({ ...state, uno: { ...state.uno, [side]: 'called' } }, { side, kind: 'uno', card: null });
  return ok(s);
}

function catchUno(state: GameState, side: Side): ActionResult {
  if (!canCatchUno(state, side)) return fail(state, 'Nothing to catch.');
  const s = log(state, { side, kind: 'catch', card: null });
  return ok(endGame(s, side, 'unoCaught'));
}

/**
 * Apply an action by `side`. Pure: never mutates `state`.
 * Turn-independent actions (resign, UNO call/catch) may be made by either side.
 */
export function applyAction(state: GameState, side: Side, action: GameAction): ActionResult {
  if (state.result) return fail(state, 'The game is over.');
  switch (action.type) {
    case 'resign':
      return ok(endGame(state, other(side), 'resign'));
    case 'callUno':
      return callUno(state, side);
    case 'catchUno':
      return catchUno(state, side);
    default:
      break;
  }
  if (state.turn !== side) return fail(state, 'It’s not your turn.');
  switch (action.type) {
    case 'play':
      return playCard(state, side, action.cardId, action.color);
    case 'move':
      return makeMove(state, side, { from: action.from, to: action.to, promotion: action.promotion });
    case 'discardDead':
      return discardDead(state, side, action.cardId);
    case 'draw2Discard':
      return draw2Discard(state, side, action.cardIds);
    case 'veto':
      return veto(state, side, action.cardId);
    case 'acceptCapture':
      return acceptCapture(state);
    default:
      return fail(state, 'Unknown action.');
  }
}

/** End the game from outside the rules (clock flag, agreement, abandon, abort). */
export function forceResult(state: GameState, winner: Side | null, reason: ResultReason): GameState {
  if (state.result) return state;
  return { ...endGame(state, winner, reason), seq: state.seq + 1 };
}

/**
 * What a given player is allowed to see: opponent hand and deck order are hidden
 * (replaced by face-down placeholders) and the RNG state is removed.
 */
export function viewFor(state: GameState, viewer: Side | null): GameState {
  const hide = (cards: Card[], tag: string): Card[] =>
    cards.map((_, i) => ({ id: `${tag}${i}`, kind: 'number', color: null }) as Card);
  return {
    ...state,
    hands: {
      w: viewer === 'w' ? state.hands.w : hide(state.hands.w, 'hw'),
      b: viewer === 'b' ? state.hands.b : hide(state.hands.b, 'hb'),
    },
    deck: hide(state.deck, 'd'),
    rng: 0,
  };
}

/** Random seed helper exposed for callers that want reproducible games. */
export function seedFrom(n: number): number {
  return nextRandom(n >>> 0)[1];
}

export { findKing };
