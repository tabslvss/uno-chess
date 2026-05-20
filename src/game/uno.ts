import type { CardLetter, Color, GameState, Player, Square, UnoCard, UnoCardType } from './types';
import { COLORS, FILES, LETTER_INDEX } from './constants';

let cardId = 0;
function nextId(): string {
  return `c-${++cardId}`;
}

export const CARD_LETTERS: CardLetter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function makeCard(color: Color, type: UnoCardType, letter?: CardLetter): UnoCard {
  return { id: nextId(), color, type, letter };
}

/** Compact deck: A–G, Skip, Reverse, Wild per color (no +2 / +4). */
export function createDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  for (const color of COLORS) {
    for (const letter of CARD_LETTERS) {
      deck.push(makeCard(color, 'letter', letter));
    }
    deck.push(makeCard(color, 'skip'));
    deck.push(makeCard(color, 'reverse'));
    deck.push(makeCard(color, 'wild'));
  }
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function topDiscard(state: GameState): UnoCard | null {
  return state.playedCard;
}

export function matchesTop(card: UnoCard, top: UnoCard | null, wildColor: Color | null): boolean {
  if (!top) return true;
  if (card.type === 'wild') return true;
  if (top.type === 'wild') {
    return wildColor ? card.color === wildColor : true;
  }
  if (card.color === top.color) return true;
  if (card.type === top.type && card.type !== 'letter') return true;
  if (card.type === 'letter' && top.type === 'letter' && card.letter === top.letter) return true;
  return false;
}

/** Letter unlocks matching rank & file (A→rank1/a-file … G→rank7/g-file). */
export function unlockedLines(card: UnoCard): { ranks: Set<number>; files: Set<number> } {
  const ranks = new Set<number>();
  const files = new Set<number>();
  if (card.type === 'wild') {
    for (let i = 0; i < 8; i++) {
      ranks.add(i);
      files.add(i);
    }
    return { ranks, files };
  }
  if (card.type === 'reverse' || card.type === 'skip') {
    return { ranks, files };
  }
  const idx = LETTER_INDEX[card.letter ?? 'A'];
  ranks.add(idx);
  files.add(idx);
  return { ranks, files };
}

export function pieceOnUnlockedLines(
  board: (import('./types').Piece | null)[][],
  player: Player,
  card: UnoCard,
): boolean {
  if (card.type === 'wild') return hasAnyPiece(board, player);
  if (card.type === 'reverse' || card.type === 'skip') return true;
  const { ranks, files } = unlockedLines(card);
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p && p.player === player && (ranks.has(r) || files.has(f))) return true;
    }
  }
  return false;
}

function hasAnyPiece(board: (import('./types').Piece | null)[][], player: Player): boolean {
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) if (board[r][f]?.player === player) return true;
  return false;
}

export function squareUnlocked(sq: Square, card: UnoCard): boolean {
  if (card.type === 'wild') return true;
  if (card.type === 'reverse' || card.type === 'skip') return false;
  const { ranks, files } = unlockedLines(card);
  return ranks.has(sq.rank) || files.has(sq.file);
}

export function drawCards(deck: UnoCard[], count: number): { deck: UnoCard[]; drawn: UnoCard[] } {
  const d = [...deck];
  const drawn: UnoCard[] = [];
  for (let i = 0; i < count; i++) {
    if (d.length === 0) break;
    drawn.push(d.pop()!);
  }
  return { deck: d, drawn };
}

export function cardLabel(card: UnoCard): string {
  if (card.type === 'letter') return card.letter ?? '?';
  if (card.type === 'wild') return 'W';
  if (card.type === 'reverse') return '↺';
  if (card.type === 'skip') return '⊘';
  return '?';
}

export function squareLabel(sq: Square): string {
  return `${FILES[sq.file]}${8 - sq.rank}`;
}
