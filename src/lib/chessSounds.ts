import type { ChessMoveRecord, GameState, Player } from '../game/types';
import { isInCheck } from '../game/chess';

export type ChessSoundId = 'move-self' | 'move-check' | 'capture' | 'castle' | 'promote';

const BASE = `${import.meta.env.BASE_URL}ChessAudio/`;

const SOURCES: Record<ChessSoundId, string> = {
  'move-self': `${BASE}move-self.mp3`,
  'move-check': `${BASE}move-check.mp3`,
  capture: `${BASE}capture.mp3`,
  castle: `${BASE}castle.mp3`,
  promote: `${BASE}promote.mp3`,
};

let muted = false;

export function setChessSoundsMuted(value: boolean): void {
  muted = value;
}

export function playChessSound(id: ChessSoundId, volume = 0.55): void {
  if (muted) return;
  try {
    const audio = new Audio(SOURCES[id]);
    audio.volume = volume;
    void audio.play();
  } catch {
    /* autoplay policy or missing file */
  }
}

/** Pick SFX from the move that just landed on the board. */
export function soundForChessMove(record: ChessMoveRecord, after: GameState): ChessSoundId {
  if (record.promotion) return 'promote';
  if (record.castling) return 'castle';
  if (record.captured || record.enPassant) return 'capture';

  const mover = record.piece.player;
  const opp: Player = mover === 'white' ? 'black' : 'white';
  if (isInCheck(after.board, opp)) return 'move-check';

  return 'move-self';
}

function lastChessMoveKey(move: GameState['lastChessMove']): string | null {
  if (!move) return null;
  const r = move.record;
  return [
    move.by,
    r.from.file,
    r.from.rank,
    r.to.file,
    r.to.rank,
    r.promotion ?? '',
    r.castling ?? '',
    r.enPassant ? 1 : 0,
  ].join('|');
}

export function playSoundForStateTransition(prev: GameState, next: GameState): void {
  const last = next.lastChessMove;
  if (!last) return;
  if (lastChessMoveKey(last) === lastChessMoveKey(prev.lastChessMove)) return;
  playChessSound(soundForChessMove(last.record, next));
}

let audioUnlocked = false;

/** Call after a user gesture so later opponent/bot sounds are not blocked by autoplay policy. */
export function unlockChessAudio(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  for (const id of Object.keys(SOURCES) as ChessSoundId[]) {
    const audio = new Audio(SOURCES[id]);
    audio.volume = 0;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {});
  }
}
