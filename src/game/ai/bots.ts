import type { BotLevel } from './bot';

export interface BotPersona {
  id: string;
  name: string;
  level: BotLevel;
  /** Approximate playing strength shown in the UI (not a real rating). */
  rating: number;
  tagline: string;
  avatar: string;
  accent: string;
}

export const BOTS: BotPersona[] = [
  {
    id: 'pebble',
    name: 'Pebble',
    level: 0,
    rating: 400,
    tagline: 'Just happy to be here. Forgets to say UNO a lot.',
    avatar: '/bots/pebble.svg',
    accent: '#7fb069',
  },
  {
    id: 'biscuit',
    name: 'Biscuit',
    level: 1,
    rating: 900,
    tagline: 'Loves a capture. Sometimes leaves the door open.',
    avatar: '/bots/biscuit.svg',
    accent: '#e6a23c',
  },
  {
    id: 'sage',
    name: 'Sage',
    level: 2,
    rating: 1400,
    tagline: 'Counts the cards and guards the king.',
    avatar: '/bots/sage.svg',
    accent: '#5b8def',
  },
  {
    id: 'dealer',
    name: 'The Dealer',
    level: 3,
    rating: 1800,
    tagline: 'Knows exactly what you’re holding. Probably.',
    avatar: '/bots/dealer.svg',
    accent: '#c0392b',
  },
];

export function botById(id: string | null | undefined): BotPersona {
  return BOTS.find((b) => b.id === id) ?? BOTS[1]!;
}
