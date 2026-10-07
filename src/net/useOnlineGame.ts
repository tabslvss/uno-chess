import PartySocket from 'partysocket';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { guestId } from '@/lib/guest';
import { accessToken, useAuth } from '@/stores/auth';
import type { GameAction } from '@/game/types';
import { partyHost } from './config';
import type { CreateOptions, GameClientMessage, GameServerMessage, RoomSnapshot } from './protocol';

export interface ChatLine {
  id: number;
  side: 'w' | 'b' | null;
  name: string;
  text: string;
  at: number;
}

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'unavailable';

export function useOnlineGame(gameId: string, create?: CreateOptions) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [fatal, setFatal] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const socketRef = useRef<PartySocket | null>(null);
  const createRef = useRef(create);
  const userId = useAuth((s) => s.session?.user.id ?? null);

  useEffect(() => {
    const host = partyHost();
    if (!host) {
      setStatus('unavailable');
      return;
    }
    const socket = new PartySocket({ host, party: 'game', room: gameId });
    socketRef.current = socket;
    let opened = false;
    let chatId = 0;

    socket.addEventListener('open', async () => {
      setStatus('open');
      opened = true;
      const token = await accessToken();
      const msg: GameClientMessage = {
        t: 'hello',
        auth: { token: token ?? undefined, guestId: guestId(), guestName: useAuth.getState().guestName, guestAvatar: useAuth.getState().guestAvatar },
        create: createRef.current,
      };
      socket.send(JSON.stringify(msg));
    });
    socket.addEventListener('close', (ev) => {
      if (ev.code === 4004 || ev.code === 4003) {
        setStatus('closed');
        socket.close();
        return;
      }
      setStatus(opened ? 'reconnecting' : 'connecting');
    });
    socket.addEventListener('message', (ev) => {
      let msg: GameServerMessage;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      switch (msg.t) {
        case 'sync':
          setRoom(msg.room);
          setReceivedAt(performance.now());
          // Once the room exists, never ask to create it again on reconnect.
          createRef.current = undefined;
          break;
        case 'error':
          if (/doesn’t exist|Log in to create/.test(msg.message)) setFatal(msg.message);
          else toast.error(msg.message);
          break;
        case 'chat':
          setChat((c) => [...c.slice(-49), { id: ++chatId, side: msg.side, name: msg.name, text: msg.text, at: msg.at }]);
          break;
      }
    });

    // Keep the connection warm on flaky mobile networks.
    const ping = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'ping' }));
    }, 25_000);

    return () => {
      clearInterval(ping);
      socket.close();
      socketRef.current = null;
    };
    // Reconnect with a fresh identity when the user signs in/out.
  }, [gameId, userId]);

  const send = useCallback((msg: GameClientMessage) => {
    const s = socketRef.current;
    if (!s || s.readyState !== WebSocket.OPEN) {
      toast.error('Reconnecting to the game server…');
      return;
    }
    s.send(JSON.stringify(msg));
  }, []);

  const act = useCallback(
    (action: GameAction) => send({ t: 'action', action, seq: room?.state?.seq ?? 0 }),
    [send, room?.state?.seq],
  );

  return { room, receivedAt, status, fatal, chat, send, act };
}
