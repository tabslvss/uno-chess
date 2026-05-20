import type { Color, GameAction, GameEvent, GameState, PieceType, Player, Square, UnoCard } from './types';
import { createInitialBoard, HAND_SIZE, INITIAL_CASTLING } from './constants';
import {
  applyChessMove,
  getLegalMovesForPiece,
  getMovablePieceSquares,
  isInCheck,
  restoreFromRecord,
} from './chess';
import { createDeck, drawCards, pieceOnUnlockedLines, cardLabel } from './uno';

function msg(state: GameState, text: string): GameState {
  return { ...state, message: text };
}

function opponent(p: Player): Player {
  return p === 'white' ? 'black' : 'white';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(drawPile: UnoCard[], count: number): { pile: UnoCard[]; cards: UnoCard[] } {
  const pile = [...drawPile];
  const { deck, drawn } = drawCards(pile, count);
  return { pile: deck, cards: drawn };
}

/** Pile is infinite — if empty, shuffle a fresh deck in. */
function ensurePile(pile: UnoCard[]): UnoCard[] {
  if (pile.length > 0) return pile;
  return shuffle(createDeck());
}

/** True when a card is playable (can produce at least one legal move, or is skip/wild). */
function cardIsPlayable(card: UnoCard, board: (import('./types').Piece | null)[][], player: Player): boolean {
  if (card.type === 'skip' || card.type === 'wild' || card.type === 'reverse') return true;
  return pieceOnUnlockedLines(board, player, card);
}

/**
 * Draw from pile, preferring a playable card.
 * Searches pile for a playable card; falls back to top of pile if none found.
 * Pile is automatically refilled if empty.
 */
function drawPlayableCard(pile: UnoCard[], board: (import('./types').Piece | null)[][], player: Player): { pile: UnoCard[]; card: UnoCard } {
  const mutable = [...ensurePile(pile)];
  // Try to find a playable card anywhere in the pile
  for (let i = mutable.length - 1; i >= 0; i--) {
    if (cardIsPlayable(mutable[i]!, board, player)) {
      const card = mutable[i]!;
      mutable.splice(i, 1);
      return { pile: mutable, card };
    }
  }
  // No playable card found — pop top
  const card = mutable.pop()!;
  return { pile: mutable, card };
}

function drawToPlayer(state: GameState, player: Player, n: number): { state: GameState; drawn: UnoCard[] } {
  let pile = [...state.drawPile];
  const drawn: UnoCard[] = [];
  for (let i = 0; i < n; i++) {
    // Infinite pile: refill if empty
    const result = drawPlayableCard(pile, state.board, player);
    pile = result.pile;
    drawn.push(result.card);
  }
  const last = drawn[drawn.length - 1];
  const event: GameEvent =
    last ? { type: 'draw', player, cardId: last.id } : null;
  return {
    state: {
      ...state,
      drawPile: pile,
      hands: { ...state.hands, [player]: [...state.hands[player], ...drawn] },
      lastEvent: event,
    },
    drawn,
  };
}

/** Check if ALL cards in a player's hand are unplayable letter cards. */
export function allCardsUnplayable(state: GameState, player: Player): boolean {
  const hand = state.hands[player];
  if (hand.length === 0) return false;
  return hand.every((c) => !cardIsPlayable(c, state.board, player));
}

/** Discard a card from hand and replace it with a playable card from the pile. */
export function discardForRedraw(state: GameState, cardId: string): GameState {
  const player = state.currentPlayer;
  const hand = state.hands[player];
  const card = hand.find((c) => c.id === cardId);
  if (!card || !allCardsUnplayable(state, player)) return state;

  const newHand = hand.filter((c) => c.id !== cardId);
  // Put the discarded card at bottom of pile, draw a playable replacement
  const pileWithDiscard = [card, ...state.drawPile];
  const { pile: newPile, card: drawn } = drawPlayableCard(pileWithDiscard, state.board, player);

  return msg(
    {
      ...state,
      drawPile: newPile,
      hands: { ...state.hands, [player]: [...newHand, drawn] },
      lastEvent: { type: 'draw', player, cardId: drawn.id },
    },
    `Discarded — drew ${drawn.type === 'letter' ? drawn.letter : drawn.type}.`,
  );
}

/** New game: 7 random cards each from the Uno Chess pile. White moves first. */
export function createGame(): GameState {
  let pile = shuffle(createDeck());
  const w = deal(pile, HAND_SIZE);
  pile = w.pile;
  const b = deal(pile, HAND_SIZE);
  return {
    board: createInitialBoard(),
    currentPlayer: 'white',
    phase: 'playCard',
    hands: { white: w.cards, black: b.cards },
    drawPile: b.pile,
    playedCard: null,
    activeCard: null,
    wildPendingColor: null,
    pendingCardId: null,
    selectedSquare: null,
    lastChessMove: null,
    idleTurns: 0,
    pendingCapture: null,
    result: null,
    resultReason: '',
    message: 'White — play a card, then move on that letter.',
    enPassantTarget: null,
    castlingRights: { ...INITIAL_CASTLING },
    lastEvent: null,
  };
}

/** Play the bonus card drawn after a successful Reverse (same turn). */
function playBonusCardAfterReverse(
  state: GameState,
  player: Player,
  card: UnoCard,
  wildColor?: Color,
): GameState {
  if (card.type === 'wild' && !wildColor) {
    return msg(
      { ...state, phase: 'pickWildColor', pendingCardId: card.id },
      'Wild — choose a color.',
    );
  }

  const newHand = state.hands[player].filter((c) => c.id !== card.id);
  let s: GameState = {
    ...state,
    hands: { ...state.hands, [player]: newHand },
    pendingCardId: null,
    activeCard: card,
    wildPendingColor: card.type === 'wild' ? (wildColor ?? card.color) : null,
    phase: 'chess',
    selectedSquare: null,
    lastEvent: { type: 'play', player, cardId: card.id },
  };

  if (card.type === 'skip') {
    return finishTurn(msg(s, 'Skip — turn ends.'), false);
  }

  if (card.type === 'reverse') {
    return finishTurn(msg(s, 'Drew Reverse — nothing else to undo. Turn ends.'), false);
  }

  const label = card.type === 'letter' ? card.letter : cardLabel(card);
  s = msg(s, `Played ${label} — move on that rank/file.`);

  if (card.type === 'letter' && !pieceOnUnlockedLines(s.board, player, card)) {
    return finishTurn(msg(s, 'No pieces on those lines — turn ends.'), false);
  }

  if (getMovablePieceSquares(s, s.activeCard!).length === 0) {
    const inCheck = isInCheck(s.board, player);
    if (inCheck) {
      const winner = opponent(player);
      return msg(
        { ...s, phase: 'gameOver', result: winner, resultReason: 'Checkmate.' },
        `Checkmate! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`,
      );
    }
    return finishTurn(msg(s, 'All pieces are pinned on those lines — turn ends.'), false);
  }

  return s;
}

function handleReverseCard(state: GameState, player: Player): GameState {
  const oppMove = state.lastChessMove;
  if (!oppMove || oppMove.by !== opponent(player)) {
    return finishTurn(msg(state, 'Reverse — nothing to undo. Turn ends.'), false);
  }

  const restored = restoreFromRecord(oppMove.record);
  let s: GameState = {
    ...state,
    board: restored.board,
    enPassantTarget: restored.enPassantTarget,
    castlingRights: restored.castlingRights,
    lastChessMove: null,
    phase: 'playCard',
    activeCard: null,
    selectedSquare: null,
  };

  const { state: withDraw, drawn } = drawToPlayer(s, player, 1);
  if (drawn.length === 0) {
    return finishTurn(
      msg(withDraw, 'Reverse — draw pile empty. Turn ends.'),
      false,
    );
  }

  const drawnCard = drawn[drawn.length - 1]!;
  return msg(
    {
      ...withDraw,
      pendingCardId: drawnCard.id,
      lastEvent: { type: 'draw', player, cardId: drawnCard.id },
    },
    "Reverse — opponent's move undone. Play the card you drew.",
  );
}

/**
 * Returns true if `player` has at least one legal chess move with any card in their hand.
 * Used to detect checkmate / stalemate before the player picks a card.
 */
function hasAnyLegalMoveWithHand(state: GameState, player: Player): boolean {
  const hand = state.hands[player];
  const stateAs = { ...state, currentPlayer: player };
  for (const card of hand) {
    if (getMovablePieceSquares(stateAs, card).length > 0) return true;
  }
  return false;
}

/** After Reverse: must play the card just drawn from the pile. */
export function isReverseBonusPending(state: GameState): boolean {
  return (
    state.phase === 'playCard' &&
    state.playedCard?.type === 'reverse' &&
    state.pendingCardId != null
  );
}

/** End chess phase when no legal moves exist (avoids soft-lock). */
export function endTurnWithoutMove(state: GameState): GameState {
  if (state.phase !== 'chess') return state;
  return finishTurn(state, false);
}

/** Clear a broken reverse-bonus state and pass the turn. */
export function abandonReverseBonus(state: GameState): GameState {
  if (!isReverseBonusPending(state)) return state;
  return finishTurn({ ...state, pendingCardId: null, activeCard: null }, false);
}

function finishTurn(state: GameState, pieceMoved: boolean): GameState {
  const player = state.currentPlayer;
  const next = opponent(player);
  let idle = state.idleTurns;
  if (!pieceMoved) idle += 1;
  else idle = 0;

  if (idle >= 6) {
    return msg(
      {
        ...state,
        phase: 'gameOver',
        result: 'draw',
        resultReason: 'Six turns with no piece moved.',
        playedCard: null,
        activeCard: null,
        idleTurns: idle,
      },
      'Draw.',
    );
  }

  let s: GameState = {
    ...state,
    playedCard: null,
    activeCard: null,
    selectedSquare: null,
    wildPendingColor: null,
    pendingCardId: null,
    idleTurns: idle,
  };

  const { state: withDraw } = drawToPlayer(s, player, 1);
  s = withDraw;

  const nextState: GameState = {
    ...s,
    currentPlayer: next,
    phase: 'playCard',
  };

  // Check if the incoming player is in checkmate or stalemate before they even pick a card.
  const inCheck = isInCheck(nextState.board, next);
  if (!hasAnyLegalMoveWithHand(nextState, next)) {
    if (inCheck) {
      const winner = player;
      return msg(
        {
          ...nextState,
          phase: 'gameOver',
          result: winner,
          resultReason: 'Checkmate.',
        },
        `Checkmate! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`,
      );
    }
    // Stalemate — no legal move but not in check
    return msg(
      {
        ...nextState,
        phase: 'gameOver',
        result: 'draw',
        resultReason: 'Stalemate — no legal moves.',
      },
      'Stalemate! Draw.',
    );
  }

  const checkMsg = inCheck ? ' You are in check!' : '';
  return msg(
    nextState,
    `${next === 'white' ? 'White' : 'Black'} — play a card.${checkMsg}`,
  );
}

export function playCard(state: GameState, cardId: string, wildColor?: Color): GameState {
  if (state.phase !== 'playCard' && state.phase !== 'pickWildColor') return state;

  const player = state.currentPlayer;
  const hand = state.hands[player];
  const card = hand.find((c) => c.id === cardId);
  if (!card) return state;

  const reverseBonusPending =
    state.phase === 'playCard' && state.playedCard?.type === 'reverse' && state.pendingCardId;

  if (reverseBonusPending) {
    if (cardId !== state.pendingCardId) return state;
    if (card.type === 'wild' && !wildColor) {
      return msg(
        { ...state, phase: 'pickWildColor', pendingCardId: cardId },
        'Wild — choose a color.',
      );
    }
    return playBonusCardAfterReverse(state, player, card, wildColor);
  }

  if (card.type === 'wild' && !wildColor && state.phase === 'playCard') {
    return {
      ...state,
      phase: 'pickWildColor',
      pendingCardId: cardId,
      message: 'Wild — choose a color.',
    };
  }

  const newHand = hand.filter((c) => c.id !== cardId);
  const played: UnoCard = card;

  let s: GameState = {
    ...state,
    hands: { ...state.hands, [player]: newHand },
    playedCard: played,
    activeCard: played,
    wildPendingColor: card.type === 'wild' ? (wildColor ?? card.color) : null,
    pendingCardId: null,
    phase: 'chess',
    lastEvent: { type: 'play', player, cardId: card.id },
    selectedSquare: null,
  };

  if (card.type === 'reverse') {
    return handleReverseCard(s, player);
  }

  if (card.type === 'skip') {
    return finishTurn(msg(s, 'Skip — turn ends.'), false);
  }

  const label = card.type === 'letter' ? card.letter : cardLabel(card);
  s = msg(s, `Played ${label} — move on that rank/file.`);

  if (card.type === 'letter' && !pieceOnUnlockedLines(s.board, player, card)) {
    return finishTurn(msg(s, 'No pieces on those lines — turn ends.'), false);
  }

  // All pieces on those lines may be pinned — check for legal moves.
  if (getMovablePieceSquares(s, s.activeCard!).length === 0) {
    const inCheck = isInCheck(s.board, player);
    if (inCheck) {
      const winner = opponent(player);
      return msg(
        { ...s, phase: 'gameOver', result: winner, resultReason: 'Checkmate.' },
        `Checkmate! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`,
      );
    }
    return finishTurn(msg(s, 'All pieces are pinned on those lines — turn ends.'), false);
  }

  return s;
}

export function pickWildColor(state: GameState, color: Color): GameState {
  if (state.phase !== 'pickWildColor' || !state.pendingCardId) return state;

  const player = state.currentPlayer;
  const card = state.hands[player].find((c) => c.id === state.pendingCardId);
  if (!card) return state;

  if (state.playedCard?.type === 'reverse') {
    return playBonusCardAfterReverse(state, player, card, color);
  }

  return playCard(state, state.pendingCardId, color);
}

export function selectSquare(state: GameState, sq: Square): GameState {
  if (state.phase !== 'chess' || !state.activeCard) return state;
  const card = state.activeCard;
  const sel = state.selectedSquare;

  if (!sel) {
    const movable = getMovablePieceSquares(state, card);
    if (!movable.some((m) => m.file === sq.file && m.rank === sq.rank)) return state;
    return { ...state, selectedSquare: sq };
  }

  if (sel.file === sq.file && sel.rank === sq.rank) {
    return { ...state, selectedSquare: null };
  }

  const moves = getLegalMovesForPiece(state, sel, card);
  if (!moves.some((m) => m.file === sq.file && m.rank === sq.rank)) {
    const movable = getMovablePieceSquares(state, card);
    if (movable.some((m) => m.file === sq.file && m.rank === sq.rank))
      return { ...state, selectedSquare: sq };
    return { ...state, selectedSquare: null };
  }

  const fromPiece = state.board[sel.rank][sel.file];
  if (fromPiece?.type === 'pawn' && (sq.rank === 0 || sq.rank === 7)) {
    return { ...state, selectedSquare: sel, message: 'Choose promotion.' };
  }

  return executeMove(state, sel, sq, 'queen');
}

export function executeMove(
  state: GameState,
  from: Square,
  to: Square,
  promotion: PieceType,
): GameState {
  if (state.phase !== 'chess' || !state.activeCard) return state;
  const { board, record, kingCaptured, castlingRights, enPassantTarget } = applyChessMove(
    state,
    from,
    to,
    promotion,
  );
  let s: GameState = {
    ...state,
    board,
    castlingRights,
    enPassantTarget,
    selectedSquare: null,
    lastChessMove: { by: state.currentPlayer, record },
  };

  if (kingCaptured) {
    return {
      ...s,
      currentPlayer: kingCaptured,
      phase: 'kingCaptureVeto',
      pendingCapture: { by: state.currentPlayer, move: record },
      message: 'King captured! Opponent may Reverse.',
    };
  }

  return finishTurn(msg(s, 'Move done.'), true);
}

export function vetoWithReverse(state: GameState, cardId: string): GameState {
  if (state.phase !== 'kingCaptureVeto' || !state.pendingCapture) return state;
  const opp = opponent(state.pendingCapture.by);
  if (state.currentPlayer !== opp) return state;
  const card = state.hands[opp].find((c) => c.id === cardId);
  if (!card || card.type !== 'reverse') return state;

  const restored = restoreFromRecord(state.pendingCapture.move);
  const hand = state.hands[opp].filter((c) => c.id !== cardId);
  return msg(
    {
      ...state,
      board: restored.board,
      enPassantTarget: restored.enPassantTarget,
      castlingRights: restored.castlingRights,
      hands: { ...state.hands, [opp]: hand },
      phase: 'playCard',
      pendingCapture: null,
      playedCard: null,
      activeCard: null,
      currentPlayer: state.pendingCapture.by,
    },
    'Reverse — capture vetoed.',
  );
}

export function acceptCapture(state: GameState): GameState {
  if (state.phase !== 'kingCaptureVeto' || !state.pendingCapture) return state;
  const winner = state.pendingCapture.by;
  return msg(
    {
      ...state,
      phase: 'gameOver',
      result: winner,
      resultReason: 'King captured.',
      pendingCapture: null,
    },
    `${winner} wins!`,
  );
}

export function getLegalMoves(state: GameState): Square[] {
  if (!state.activeCard || !state.selectedSquare) return [];
  return getLegalMovesForPiece(state, state.selectedSquare, state.activeCard);
}

export function getVetoReverses(state: GameState): UnoCard[] {
  if (state.phase !== 'kingCaptureVeto') return [];
  return state.hands[state.currentPlayer].filter((c) => c.type === 'reverse');
}

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'playCard':
      return playCard(state, action.cardId, action.wildColor);
    case 'pickWild':
      return pickWildColor(state, action.color);
    case 'selectSquare':
      return selectSquare(state, action.square);
    case 'move':
      return executeMove(state, action.from, action.to, action.promotion ?? 'queen');
    case 'veto':
      return vetoWithReverse(state, action.cardId);
    case 'acceptCapture':
      return acceptCapture(state);
    case 'discardForRedraw':
      return discardForRedraw(state, action.cardId);
    default:
      return state;
  }
}

/** Hide opponent hand — only count visible; played card is public. */
export function viewForPlayer(state: GameState, viewer: Player): GameState {
  const opp = opponent(viewer);
  const hidden = state.hands[opp].map((_, i) => ({
    id: `hidden-${opp}-${i}`,
    color: 'red' as Color,
    type: 'letter' as const,
    letter: 'A' as const,
  }));
  return {
    ...state,
    hands: {
      ...state.hands,
      [opp]: hidden,
    },
  };
}
