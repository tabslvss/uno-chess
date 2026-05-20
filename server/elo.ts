import { getSupabaseAdmin } from './supabaseAdmin.ts';
import type { GameResult } from '../src/game/types.ts';

const K = 32;

export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));
}

export function eloDelta(playerElo: number, opponentElo: number, score: number): number {
  const expected = expectedScore(playerElo, opponentElo);
  return Math.round(K * (score - expected));
}

function scoreForResult(result: GameResult, color: 'white' | 'black'): number {
  if (result === 'draw' || result === null) return 0.5;
  if (result === color) return 1;
  return 0;
}

type EloRow = {
  user_id: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
};

export async function applyMatchElo(
  whiteUserId: string,
  blackUserId: string,
  result: GameResult,
): Promise<{ whiteElo: number; blackElo: number; whiteDelta: number; blackDelta: number } | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !result) return null;
  if (whiteUserId === blackUserId) return null;

  const { data: rows, error } = await sb
    .from('profiles')
    .select('user_id, elo, wins, losses, draws')
    .in('user_id', [whiteUserId, blackUserId]);

  if (error || !rows || rows.length < 2) {
    console.error('[server] applyMatchElo fetch', error?.message);
    return null;
  }

  const typed = rows as EloRow[];
  const whiteRow = typed.find((r) => r.user_id === whiteUserId)!;
  const blackRow = typed.find((r) => r.user_id === blackUserId)!;

  const whiteScore = scoreForResult(result, 'white');
  const blackScore = scoreForResult(result, 'black');

  const whiteDelta = eloDelta(whiteRow.elo, blackRow.elo, whiteScore);
  const blackDelta = eloDelta(blackRow.elo, whiteRow.elo, blackScore);

  const newWhiteElo = Math.max(0, whiteRow.elo + whiteDelta);
  const newBlackElo = Math.max(0, blackRow.elo + blackDelta);

  const whiteWins = whiteRow.wins + (whiteScore === 1 ? 1 : 0);
  const whiteLosses = whiteRow.losses + (whiteScore === 0 ? 1 : 0);
  const whiteDraws = whiteRow.draws + (whiteScore === 0.5 ? 1 : 0);

  const blackWins = blackRow.wins + (blackScore === 1 ? 1 : 0);
  const blackLosses = blackRow.losses + (blackScore === 0 ? 1 : 0);
  const blackDraws = blackRow.draws + (blackScore === 0.5 ? 1 : 0);

  const [whiteRes, blackRes] = await Promise.all([
    sb
      .from('profiles')
      .update({
        elo: newWhiteElo,
        wins: whiteWins,
        losses: whiteLosses,
        draws: whiteDraws,
      })
      .eq('user_id', whiteUserId),
    sb
      .from('profiles')
      .update({
        elo: newBlackElo,
        wins: blackWins,
        losses: blackLosses,
        draws: blackDraws,
      })
      .eq('user_id', blackUserId),
  ]);

  if (whiteRes.error || blackRes.error) {
    console.error('[server] applyMatchElo update', whiteRes.error?.message, blackRes.error?.message);
    return null;
  }

  return { whiteElo: newWhiteElo, blackElo: newBlackElo, whiteDelta, blackDelta };
}
