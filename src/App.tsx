import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Tutorial } from './components/Tutorial';
import { Lobby } from './components/Lobby';
import { FriendMenu } from './components/FriendMenu';
import { OnlineJoin } from './components/OnlineJoin';
import { AuthPage } from './components/AuthPage';
import { AccountBar } from './components/AccountBar';
import { BotDifficultyPicker } from './components/BotDifficulty';
import { Icon } from './components/Icon';
import { RoomCodeBlock } from './components/RoomCodeBlock';
import { useAuthStore } from './store/authStore';
import type { Screen } from './store/gameStore';
import { GameScreen } from './components/GameScreen';
import { ToastStack } from './components/ToastStack';
import { TopNav } from './components/TopNav';
import { useGameStore } from './store/gameStore';
import type { Player } from './game/types';
import './styles/global.css';
import './styles/cards.css';
import './styles/reactbits-overrides.css';

export default function App() {
  const {
    screen, gameMode, tutorialDone, myColor,
    roomId, onlineError, waitingForOpponent, onlineLoading,
    openLobby, showBotPicker, showFriendMenu, showJoinCode, showAuth,
    startBot, startCreateGame, startJoinGame, startRandomMatch,
    finishTutorial, aiThinking, leaveGame,
  } = useGameStore();

  const session = useAuthStore((s) => s.session);
  const pendingReturn = useAuthStore((s) => s.pendingReturn);
  const setPendingReturn = useAuthStore((s) => s.setPendingReturn);

  const requireAuth = (returnScreen: Screen, action: () => void) => {
    if (session) action();
    else showAuth(returnScreen);
  };

  const afterAuth = () => {
    const target = (pendingReturn as Screen | null) ?? 'lobby';
    setPendingReturn(null);
    if (target === 'friend-menu') showFriendMenu();
    else if (target === 'join-code') showJoinCode();
    else if (target === 'waiting') void startRandomMatch();
    else useGameStore.setState({ screen: target });
  };

  const rawState = useGameStore((s) => s.state);
  const boardOrientation: Player = myColor ?? 'white';
  const statusMessage = aiThinking ? 'Bot is thinking…' : rawState.message;

  const { topPlayer, bottomPlayer } = useMemo(() => {
    const you: Player = myColor ?? 'white';
    const opp: Player = you === 'white' ? 'black' : 'white';
    return boardOrientation === you
      ? { topPlayer: opp, bottomPlayer: you }
      : { topPlayer: you, bottomPlayer: opp };
  }, [myColor, boardOrientation]);

  /* ── Lobby ─────────────────────────────────────────────────── */
  if (screen === 'lobby') {
    return (
      <div className="app-shell landing-page">
        {!tutorialDone && <Tutorial onDone={finishTutorial} onSkip={finishTutorial} />}
        <TopNav right={<AccountBar onLogin={() => showAuth('lobby')} />} />
        <Lobby
          onSelect={(c) => {
            if (c === 'friend') requireAuth('friend-menu', showFriendMenu);
            else if (c === 'random') requireAuth('waiting', () => void startRandomMatch());
            else showBotPicker();
          }}
        />
        <footer className="feature-strip">
          <div className="feature-item">
            <Icon name="cards" size={14} />
            <span>7 cards each</span>
          </div>
          <div className="feature-item">
            <Icon name="pawn" size={14} />
            <span>Play a card, move on that line</span>
          </div>
          <div className="feature-item">
            <Icon name="reverse" size={14} />
            <span>Reverse undoes opponent&apos;s last move</span>
          </div>
          <div className="feature-item">
            <Icon name="clock" size={14} />
            <span>10-minute chess clock</span>
          </div>
        </footer>
        {onlineError && <div className="error-banner">{onlineError}</div>}
      </div>
    );
  }

  if (screen === 'auth') {
    return (
      <div className="app-shell landing-page">
        <TopNav breadcrumbs={[{ label: 'Home' }, { label: 'Account', current: true }]} />
        <AuthPage onBack={openLobby} onSuccess={afterAuth} />
      </div>
    );
  }

  if (screen === 'friend-menu') {
    return (
      <div className="app-shell landing-page">
        <TopNav
          breadcrumbs={[{ label: 'Home' }, { label: 'Play a Friend', current: true }]}
          right={<AccountBar onLogin={() => showAuth('friend-menu')} />}
        />
        <FriendMenu
          onCreate={() => void startCreateGame()}
          onJoin={showJoinCode}
          onBack={openLobby}
        />
        {onlineError && <motion.div className="error-banner">{onlineError}</motion.div>}
      </div>
    );
  }

  if (screen === 'join-code') {
    return (
      <div className="app-shell landing-page">
        <TopNav
          breadcrumbs={[{ label: 'Home' }, { label: 'Join', current: true }]}
          right={<AccountBar onLogin={() => showAuth('join-code')} />}
        />
        <OnlineJoin
          onJoin={(code) => void startJoinGame(code)}
          onBack={showFriendMenu}
          error={onlineError ?? undefined}
          loading={onlineLoading}
          onClearError={() => useGameStore.setState({ onlineError: null })}
        />
      </div>
    );
  }

  /* ── Bot pick ───────────────────────────────────────────────── */
  if (screen === 'bot-pick') {
    return (
      <div className="app-shell landing-page">
        <TopNav breadcrumbs={[{ label: 'Home' }, { label: 'vs Bot', current: true }]} />
        <BotDifficultyPicker onPick={startBot} onBack={openLobby} />
        <div className="feature-strip" />
      </div>
    );
  }

  /* ── Waiting ────────────────────────────────────────────────── */
  if (screen === 'waiting') {
    const headline = roomId
      ? 'Waiting for your opponent…'
      : waitingForOpponent
      ? 'Finding a ranked opponent…'
      : 'Connecting…';
    return (
      <div className="app-shell landing-page">
        <TopNav
          breadcrumbs={[{ label: 'Home' }, { label: 'Online', current: true }]}
          right={<AccountBar onLogin={() => showAuth('lobby')} />}
        />
        <div className="waiting-page">
          <motion.div
            className="waiting-card"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <div className="waiting-spinner" />
            <h2>{headline}</h2>
            {roomId && <RoomCodeBlock code={roomId} />}
            <p className="waiting-hint">
              {roomId
                ? 'Share the code with your friend. The game will start as soon as they join.'
                : 'We’re matching you with someone close to your ELO.'}
            </p>
            <button type="button" className="btn btn-ghost" onClick={leaveGame}>
              Cancel
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── Game ───────────────────────────────────────────────────── */
  const modeLabel = gameMode === 'bot' ? 'vs Bot' : roomId ? `Room ${roomId}` : 'Online';
  const youLabel  = myColor
    ? `You · ${myColor.charAt(0).toUpperCase() + myColor.slice(1)}`
    : '';

  return (
    <div className="app-shell">
      <ToastStack />
      {!tutorialDone && <Tutorial onDone={finishTutorial} onSkip={finishTutorial} />}

      <TopNav
        breadcrumbs={[{ label: 'Home' }, { label: modeLabel }, { label: youLabel, current: true }]}
        onMenu={leaveGame}
        showMenu
      />

      <GameScreen
        topPlayer={topPlayer}
        bottomPlayer={bottomPlayer}
        boardOrientation={boardOrientation}
        statusMessage={statusMessage}
      />
    </div>
  );
}
