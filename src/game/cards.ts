import type { Card, Color } from './types';

export const COLORS: readonly Color[] = ['red', 'yellow', 'green', 'blue'];
export const LETTERS = 'ABCDEFGH';
export const HAND_SIZE = 7;
export const NO_MOVE_DRAW_LIMIT = 6;

/**
 * The UNO Chess deck (76 cards):
 * - two each of 1–8 per colour (shown as A–H; A = 1 = a-file / rank 1)
 * - one Reverse and one Draw Two per colour
 * - four Wilds
 * (0s, 9s, Skips, Wild Draw Fours, and the second Reverse/Draw Two are removed.)
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  let n = 0;
  const id = () => `k${(n++).toString(36)}`;
  for (const color of COLORS) {
    for (let value = 1; value <= 8; value++) {
      deck.push({ id: id(), kind: 'number', color, value });
      deck.push({ id: id(), kind: 'number', color, value });
    }
    deck.push({ id: id(), kind: 'reverse', color });
    deck.push({ id: id(), kind: 'draw2', color });
  }
  for (let i = 0; i < 4; i++) deck.push({ id: id(), kind: 'wild', color: null });
  return deck;
}

export const DECK_SIZE = 76;

/** Does `card` match the top of the discard pile? */
export function cardMatches(card: Card, top: Card | null, activeColor: Color | null): boolean {
  if (card.kind === 'wild') return true;
  if (!top) return true;
  if (activeColor === null) return true;
  if (card.color === activeColor) return true;
  if (top.kind === 'wild') return false;
  if (card.kind === 'number') return top.kind === 'number' && top.value === card.value;
  return card.kind === top.kind;
}

/** The file/rank index (0–7) a number card unlocks. */
export function cardLine(card: Card): number | null {
  return card.kind === 'number' && card.value ? card.value - 1 : null;
}

/** Can a piece standing on `sq` be moved with this card? */
export function cardUnlocksSquare(card: Card, sq: number): boolean {
  if (card.kind === 'wild') return true;
  const line = cardLine(card);
  if (line === null) return false;
  return sq % 8 === line || Math.floor(sq / 8) === line;
}

export function cardLetter(card: Card): string {
  return card.value ? LETTERS[card.value - 1]! : '';
}

export function cardShortLabel(card: Card): string {
  switch (card.kind) {
    case 'number':
      return cardLetter(card);
    case 'reverse':
      return '⟲';
    case 'draw2':
      return '+2';
    case 'wild':
      return 'W';
  }
}

export function cardName(card: Card): string {
  const color = card.color ? card.color[0]!.toUpperCase() + card.color.slice(1) : '';
  switch (card.kind) {
    case 'number':
      return `${color} ${cardLetter(card)} (${card.value})`;
    case 'reverse':
      return `${color} Reverse`;
    case 'draw2':
      return `${color} Draw Two`;
    case 'wild':
      return 'Wild';
  }
}

/** "a-file & rank 1" for a number card. */
export function cardLinesText(card: Card): string {
  const line = cardLine(card);
  if (line === null) return card.kind === 'wild' ? 'any piece' : '';
  return `${'abcdefgh'[line]}-file & rank ${line + 1}`;
}
