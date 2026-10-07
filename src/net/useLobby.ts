import PartySocket from 'partysocket';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { guestId } from '@/lib/guest';
import { accessToken, useAuth } from '@/stores/auth';
import { partyHost } from './config';
import type { LobbyClientMessage, LobbyServerMessage } from './protocol';

export type QueueState =
  | { kind: 'idle' }
  | { kind: 'joining'; mode: 'casual' | 'ranked'; tc: string }
  | { kind: 'queued'; mode: 'casual' | 'ranked'; tc: string; since: number; size: number }
  | { kind: 'matched'; gameId: string };

export function useLobby(onMatched: (gameId: string) => void) {
  const [stats, setStats] = useState<{ online: number; queued: number; games: number } | null>(null);
  const [queue, setQueue] = useState<QueueState>({ kind: 'idle' });
  const [ready, setReady] = useState(false);
  const socketRef = useRef<PartySocket | null>(null);
  const pending = useRef<LobbyClientMessage | null>(null);
  const joinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchedRef = useRef(onMatched);
  matchedRef.current = onMatched;
  const userId = useAuth((s) => s.session?.user.id ?? null);

  useEffect(() => {
    const host = partyHost();
    if (!host) return;
    const socket = new PartySocket({ host, party: 'main', room: 'lobby' });
    socketRef.current = socket;
    socket.addEventListener('open', async () => {
      const token = await accessToken();
      socket.send(
        JSON.stringify({
          t: 'hello',
          auth: { token: token ?? undefined, guestId: guestId(), guestName: useAuth.getState().guestName, guestAvatar: useAuth.getState().guestAvatar },
        } satisfies LobbyClientMessage),
      );
    });
    socket.addEventListener('close', () => {
      setReady(false);
      setQueue((q) => (q.kind === 'queued' ? { kind: 'joining', mode: q.mode, tc: q.tc } : q));
    });
    socket.addEventListener('message', (ev) => {
      let msg: LobbyServerMessage;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      switch (msg.t) {
        case 'welcome':
          setReady(true);
          if (pending.current) {
            socket.send(JSON.stringify(pending.current));
          }
          break;
        case 'stats':
          setStats({ online: msg.online, queued: msg.queued, games: msg.games });
          break;
        case 'queued':
          if (joinTimer.current) clearTimeout(joinTimer.current);
          setQueue({ kind: 'queued', mode: msg.mode, tc: msg.tc, since: Date.now(), size: msg.size });
          break;
        case 'matched':
          pending.current = null;
          setQueue({ kind: 'matched', gameId: msg.gameId });
          matchedRef.current(msg.gameId);
          break;
        case 'cancelled':
          pending.current = null;
          setQueue({ kind: 'idle' });
          break;
        case 'error':
          toast.error(msg.message);
          if (/ranked|queue again/i.test(msg.message)) {
            pending.current = null;
            setQueue({ kind: 'idle' });
          }
          break;
      }
    });
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [userId]);

  const join = useCallback(
    (mode: 'casual' | 'ranked', tc: string) => {
      const msg: LobbyClientMessage = { t: 'queue', mode, tc };
      pending.current = msg;
      setQueue({ kind: 'joining', mode, tc });
      if (joinTimer.current) clearTimeout(joinTimer.current);
      joinTimer.current = setTimeout(() => {
        setQueue((q) => {
          if (q.kind !== 'joining') return q;
          pending.current = null;
          toast.error('Couldn’t reach the game server. Please try again in a minute.');
          return { kind: 'idle' };
        });
      }, 10_000);
      const s = socketRef.current;
      if (s && s.readyState === WebSocket.OPEN && ready) s.send(JSON.stringify(msg));
    },
    [ready],
  );

  const cancel = useCallback(() => {
    pending.current = null;
    setQueue({ kind: 'idle' });
    const s = socketRef.current;
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify({ t: 'cancel' } satisfies LobbyClientMessage));
  }, []);

  return { stats, queue, join, cancel, available: partyHost() !== null };
}
