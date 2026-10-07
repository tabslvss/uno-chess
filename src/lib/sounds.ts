import { Howl, Howler } from 'howler';
import moveUrl from '@/assets/sounds/move.mp3';
import captureUrl from '@/assets/sounds/capture.mp3';
import castleUrl from '@/assets/sounds/castle.mp3';
import promoteUrl from '@/assets/sounds/promote.mp3';
import checkUrl from '@/assets/sounds/check.mp3';
import cardPlayUrl from '@/assets/sounds/card-play.mp3';
import cardDrawUrl from '@/assets/sounds/card-draw.mp3';
import shuffleUrl from '@/assets/sounds/shuffle.mp3';
import unoUrl from '@/assets/sounds/uno.mp3';
import winUrl from '@/assets/sounds/win.mp3';
import loseUrl from '@/assets/sounds/lose.mp3';
import notifyUrl from '@/assets/sounds/notify.mp3';
import tickUrl from '@/assets/sounds/tick.mp3';

const urls = {
  move: moveUrl,
  capture: captureUrl,
  castle: castleUrl,
  promote: promoteUrl,
  check: checkUrl,
  cardPlay: cardPlayUrl,
  cardDraw: cardDrawUrl,
  shuffle: shuffleUrl,
  uno: unoUrl,
  win: winUrl,
  lose: loseUrl,
  notify: notifyUrl,
  tick: tickUrl,
} as const;

export type SoundName = keyof typeof urls;

const cache = new Map<SoundName, Howl>();
let enabled = true;
let volume = 0.7;

export function configureSounds(opts: { enabled: boolean; volume: number }): void {
  enabled = opts.enabled;
  volume = opts.volume;
  Howler.volume(volume);
}

export function playSound(name: SoundName): void {
  if (!enabled || typeof window === 'undefined') return;
  let h = cache.get(name);
  if (!h) {
    h = new Howl({ src: [urls[name]], preload: true, volume: name === 'tick' ? 0.5 : 1 });
    cache.set(name, h);
  }
  h.play();
}

/** Warm the cache so the first sounds aren't delayed. */
export function preloadSounds(): void {
  for (const n of ['move', 'capture', 'cardPlay', 'cardDraw'] as SoundName[]) {
    if (!cache.has(n)) cache.set(n, new Howl({ src: [urls[n]], preload: true }));
  }
}
