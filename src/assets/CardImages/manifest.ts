import type { UnoCard } from '../../game/types';

const modules = import.meta.glob<{ default: string }>(
  './*.{png,jpg,jpeg,webp,svg,PNG,JPG,JPEG,WEBP,SVG}',
  { eager: true },
);

const images: Record<string, string> = {};
for (const [path, mod] of Object.entries(modules)) {
  const file = path.replace(/^.*\//, '').replace(/\.[^.]+$/, '').toLowerCase();
  images[file] = mod.default;
}

function lookup(...keys: string[]): string | null {
  for (const k of keys) {
    const v = images[k.toLowerCase()];
    if (v) return v;
  }
  return null;
}

export function cardImage(card: UnoCard): string | null {
  if (card.type === 'letter' && card.letter) {
    return lookup(`${card.letter}_${card.color}`, `${card.color}-${card.letter}`);
  }
  if (card.type === 'wild') {
    return lookup('wild', `wild_${card.color}`, `${card.color}-wild`);
  }
  if (card.type === 'skip') {
    return lookup(`skip_${card.color}`, `${card.color}-skip`);
  }
  if (card.type === 'reverse') {
    return lookup(`reverse_${card.color}`, `${card.color}-reverse`);
  }
  return null;
}

export function cardBackImage(): string | null {
  return lookup('back', 'card-back', 'unochess-back');
}
