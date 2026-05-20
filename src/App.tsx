import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Board } from './components/Board';
import { Hand } from './components/Hand';
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
import { DrawPile } from './components/DrawPile';
import { PlaySlot } from './components/PlaySlot';
import { TopNav } from './components/TopNav';
import { PlayerBar } from './components/PlayerBar';
import { GameTimer } from './components/GameTimer';
import { UnoChess } from './game/api';
import { COLORS } from './game/constants';
import { useGameStore } from './store/gameStore';
import type { Color, Player } from './game/types';
import './styles/global.css';

const overlayAnim = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
const modalAnim  = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit:    { opacity: 0, scale: 0.97, y: 6 },
  transition: { duration: 0.18 },
};

export default function App() {
  const {
    screen, gameMode, tutorialDone, promotionPending, myColor,
    roomId, onlineError, waitingForOpponent, eloMessage, onlineLoading,
    openLobby, showBotPicker, showFriendMenu, showJoinCode, showAuth,
    startBot, startCreateGame, startJoinGame, startRandomMatch,
    finishTutorial, playCard, pickWild, tapSquare, movePiece, promote,
    veto, concedeCapture, aiThinking, leaveGame, displayState,
    timers, canDiscardRedraw, discardAndRedraw,
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

  const [showRules, setShowRules] = useState(false);
  const rawState  = useGameStore((s) => s.state);
  const state     = displayState();
  const vetoCards = UnoChess.vetoCards(rawState);

  const canControl =
    myColor !== null && rawState.currentPlayer === myColor && !aiThinking;
  const boardOrientation: Player = myColor ?? 'white';

  const statusMessage = aiThinking ? 'Bot is thinking…' : rawState.message;

  const reverseBonusCardId =
    rawState.playedCard?.type === 'reverse' && rawState.phase === 'playCard'
      ? rawState.pendingCardId
      : null;

  const showRedrawBanner = canDiscardRedraw();

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
      {!tutorialDone && <Tutorial onDone={finishTutorial} onSkip={finishTutorial} />}

      <TopNav
        breadcrumbs={[{ label: 'Home' }, { label: modeLabel }, { label: youLabel, current: true }]}
        onMenu={leaveGame}
        showMenu
      />

      {onlineError && <div className="error-banner">{onlineError}</div>}

      {/* Status pill */}
      <div className="status-pill-wrap">
        <motion.span
          key={statusMessage}
          className={`status-pill${aiThinking ? ' thinking' : canControl ? ' active-turn' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {statusMessage}
        </motion.span>
      </div>

      {/* 3-column game shell */}
      <div className="game-shell">

        {/* LEFT — Opponent hand */}
        <aside className="sidebar sidebar-left">
          <p className="sidebar-section-label">Opponent</p>
          <Hand
            state={state}
            player={topPlayer}
            hidden={myColor !== topPlayer}
            isActive={rawState.currentPlayer === topPlayer}
            canControl={canControl && myColor === topPlayer}
            onPlay={playCard}
            compact
            mustPlayCardId={myColor === topPlayer ? reverseBonusCardId : null}
          />
        </aside>

        {/* CENTER — Board */}
        <main className="board-column">
          {/* Top player bar with timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '560px' }}>
            <PlayerBar
              player={topPlayer}
              isYou={myColor === topPlayer}
              isActive={rawState.currentPlayer === topPlayer}
              cardCount={state.hands[topPlayer].length}
            />
            <GameTimer
              seconds={timers[topPlayer]}
              isActive={rawState.currentPlayer === topPlayer && rawState.phase !== 'gameOver'}
            />
          </div>

          <Board
            state={rawState}
            orientation={boardOrientation}
            canInteract={canControl && rawState.phase === 'chess'}
            locked={aiThinking}
            onMove={movePiece}
            onSquareClick={tapSquare}
          />

          {/* Bottom player bar with timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '560px' }}>
            <PlayerBar
              player={bottomPlayer}
              isYou={myColor === bottomPlayer}
              isActive={rawState.currentPlayer === bottomPlayer}
              cardCount={state.hands[bottomPlayer].length}
            />
            <GameTimer
              seconds={timers[bottomPlayer]}
              isActive={rawState.currentPlayer === bottomPlayer && rawState.phase !== 'gameOver'}
            />
          </div>
        </main>

        {/* RIGHT — Your hand + pile + actions */}
        <aside className="sidebar sidebar-right">
          <p className="sidebar-section-label">Your Hand</p>

          {/* Redraw banner when all cards unplayable */}
          {showRedrawBanner && (
            <div className="redraw-banner">
              <strong>All cards are stuck!</strong>
              Click any card below to discard it and draw a playable replacement.
            </div>
          )}

          <Hand
            state={state}
            player={bottomPlayer}
            hidden={myColor !== bottomPlayer}
            isActive={rawState.currentPlayer === bottomPlayer}
            canControl={canControl && myColor === bottomPlayer}
            onPlay={showRedrawBanner ? discardAndRedraw : playCard}
            mustPlayCardId={!showRedrawBanner && myColor === bottomPlayer ? reverseBonusCardId : null}
          />

          <div className="pile-row">
            <PlaySlot card={rawState.playedCard} />
            <DrawPile state={rawState} />
          </div>

          <div className="sidebar-footer">
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%' }}
              onClick={() => setShowRules(true)}
            >
              Rules
            </button>
            <button
              type="button"
              className="btn btn-ghost menu-btn"
              style={{ width: '100%' }}
              onClick={leaveGame}
            >
              <Icon name="arrow-left" size={14} />
              <span>Menu</span>
            </button>
          </div>
        </aside>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {rawState.phase === 'pickWildColor' && canControl && (
          <motion.div className="overlay" {...overlayAnim}>
            <motion.div className="modal" {...modalAnim}>
              <h2>Choose a Color</h2>
              <p>Pick the active color for your Wild card.</p>
              <div className="color-grid">
                {COLORS.map((c: Color) => (
                  <button key={c} type="button" className={`color-btn ${c}`} onClick={() => pickWild(c)}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {promotionPending && canControl && (
          <motion.div className="overlay" {...overlayAnim}>
            <motion.div className="modal" {...modalAnim}>
              <h2>Promote Pawn</h2>
              <p>Choose a piece to promote to.</p>
              <div className="promo-grid">
                {(['queen', 'rook', 'bishop', 'knight'] as const).map((p) => (
                  <button key={p} type="button" className="promo-btn" onClick={() => promote(p)}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rawState.phase === 'kingCaptureVeto' && canControl && (
          <motion.div className="overlay" {...overlayAnim}>
            <motion.div className="modal" {...modalAnim}>
              <h2>King Captured</h2>
              <p>Your king was captured! Play a Reverse to undo it, or accept the result.</p>
              <div className="actions">
                {vetoCards.map((c) => (
                  <button key={c.id} type="button" className="btn btn-amber" onClick={() => veto(c.id)}>
                    Play Reverse
                  </button>
                ))}
                <button type="button" className="btn" onClick={concedeCapture}>
                  Accept
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rawState.phase === 'gameOver' && (
          <motion.div className="overlay" {...overlayAnim}>
            <motion.div className="modal" {...modalAnim}>
              <h2 style={{ fontSize: '1.4rem' }}>
                {rawState.result === 'draw'
                  ? 'Draw'
                  : rawState.result === myColor
                  ? 'You Win'
                  : 'You Lose'}
              </h2>
              <p style={{ marginBottom: '0.75rem' }}>{rawState.resultReason}</p>
              {eloMessage && gameMode === 'online' && (
                <p className="elo-result">{eloMessage}</p>
              )}
              <button type="button" className="btn" onClick={leaveGame} style={{ width: '100%' }}>
                Back to Menu
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRules && (
          <motion.div className="overlay" {...overlayAnim}>
            <motion.div className="modal" {...modalAnim}>
              <h2>How to Play</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                <p><strong>Setup:</strong> 7 cards each. White moves first.</p>
                <p><strong>Your turn:</strong> Play a card → move a piece on that rank or file → draw 1 card.</p>
                <p><strong>Letters A–G</strong> unlock the matching rank & file (A = rank 1 & a-file, etc.).</p>
                <p><strong>Wild:</strong> Move on any rank or file.</p>
                <p><strong>Reverse:</strong> Undo opponent's last move. Draw a card and move with it.</p>
                <p><strong>Skip:</strong> No move this turn.</p>
                <p><strong>Stuck?</strong> If all your cards are unplayable, click one to swap it for a playable card.</p>
                <p><strong>Clock:</strong> Each player has 10 minutes total. Run out and you lose.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowRules(false)}>Got it</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
