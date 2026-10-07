import type { Card } from '@/game/types';

const modules = import.meta.glob<string>('@/assets/cards/*.webp', { eager: true, import: 'default', query: '?url' });
const byName = new Map<string, string>();
for (const [path, url] of Object.entries(modules)) byName.set(path.split('/').pop()!.replace('.webp', ''), url);

const LETTERS = 'abcdefgh';

export function cardArt(card: Card): string {
  switch (card.kind) {
    case 'wild':
      return byName.get('wild')!;
    case 'number':
      if (!card.color || !card.value) return byName.get('back')!;
      return byName.get(`${card.color}-${LETTERS[card.value - 1]}`)!;
    case 'reverse':
      return byName.get(`${card.color}-reverse`)!;
    case 'draw2':
      return byName.get(`${card.color}-draw2`)!;
  }
}

export const cardBackArt = () => byName.get('back')!;

/** Is this a hidden placeholder card (opponent hand / deck)? */
export const isHidden = (card: Card) => card.kind === 'number' && !card.color;

export const COLOR_HEX: Record<string, string> = {
  red: '#d64534',
  yellow: '#e9b824',
  green: '#2fa660',
  blue: '#2f6fd6',
};
