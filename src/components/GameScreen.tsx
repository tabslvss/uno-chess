import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Board } from './Board';
import { Hand } from './Hand';
import { DrawPile } from './DrawPile';
import { PlaySlot } from './PlaySlot';
import { PlayerBar } from './PlayerBar';
import { GameTimer } from './GameTimer';
import { Icon } from './Icon';
import { ClickSpark } from './reactbits';
import { UnoChess } from '../game/api';
import { COLORS } from '../game/constants';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import type { Color, Player } from '../game/types';

const overlayAnim = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
const modalAnim = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 6 },
  transition: { duration: 0.18 },
};

interface GameScreenProps {
  topPlayer: Player;
  bottomPlayer: Player;
  boardOrientation: Player;
  statusMessage: string;
}

export function GameScreen({
  topPlayer,
  bottomPlayer,
  boardOrientation,
  statusMessage,
}: GameScreenProps) {
  const {
    gameMode,
    promotionPending,
    myColor,
    onlineError,
    eloMessage,
    playerNames,
    playCard,
    pickWild,
    tapSquare,
    movePiece,
    promote,
    veto,
    concedeCapture,
    aiThinking,
    leaveGame,
    displayState,
    timers,
    canDiscardRedraw,
    discardAndRedraw,
  } = useGameStore();

  const profileUsername = useAuthStore((s) => s.profile?.username);
  const rawState = useGameStore((s) => s.state);
  const state = displayState();
  const vetoCards = UnoChess.vetoCards(rawState);
  const canControl =
    myColor !== null && rawState.currentPlayer === myColor && !aiThinking;
  const reverseBonusCardId =
    rawState.playedCard?.type === 'reverse' && rawState.phase === 'playCard'
      ? rawState.pendingCardId
      : null;
  const showRedrawBanner = canDiscardRedraw();
  const [showRules, setShowRules] = useState(false);

  const displayName = useMemo(() => {
    return (player: Player): string => {
      if (gameMode === 'online' && playerNames) {
        return playerNames[player];
      }
      if (gameMode === 'bot') {
        if (player === myColor) return profileUsername ?? 'You';
        return 'Bot';
      }
      if (player === myColor) return profileUsername ?? 'You';
      return player === 'white' ? 'White' : 'Black';
    };
  }, [gameMode, playerNames, myColor, profileUsername]);

  const playerStrip = (player: Player) => (
    <div className="play-player-strip">
      <PlayerBar
        player={player}
        displayName={displayName(player)}
        isYou={myColor === player}
        isActive={rawState.currentPlayer === player}
        cardCount={state.hands[player].length}
      />
      <GameTimer
        seconds={timers[player]}
        isActive={rawState.currentPlayer === player && rawState.phase !== 'gameOver'}
      />
    </div>
  );

  return (
    <>
      {onlineError ? <motion.div className="error-banner">{onlineError}</motion.div> : null}

      <motion.div className="status-pill-wrap">
        <motion.span
          key={statusMessage}
          className={`status-pill${aiThinking ? ' thinking' : canControl ? ' active-turn' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {statusMessage}
        </motion.span>
      </motion.div>

      <motion.div className="play-layout">
        <motion.div className="play-main">
          <header className="play-opponent-zone">{playerStrip(topPlayer)}</header>

          <div className="play-board-stage">
            <motion.div className="play-flank play-flank-left">
              <div className="play-card-slot">
                <span className="play-slot-label">Draw pile</span>
                <DrawPile state={rawState} />
              </div>
            </motion.div>

            <motion.div className="play-board-center">
              <Board
                state={rawState}
                orientation={boardOrientation}
                canInteract={canControl && rawState.phase === 'chess'}
                locked={aiThinking}
                onMove={movePiece}
                onSquareClick={tapSquare}
              />
            </motion.div>

            <motion.div className="play-flank play-flank-right">
              <motion.div className="play-card-slot">
                <span className="play-slot-label">Last played</span>
                <PlaySlot card={rawState.playedCard} />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        <footer className="play-hand-bar">
          <div className="play-you-zone">{playerStrip(bottomPlayer)}</div>

          {showRedrawBanner ? (
            <motion.div className="redraw-banner redraw-banner-inline">
              <strong>All cards are stuck!</strong>
              Click a card to swap it for a playable one.
            </motion.div>
          ) : null}

          <Hand
            state={state}
            player={bottomPlayer}
            hidden={myColor !== bottomPlayer}
            isActive={rawState.currentPlayer === bottomPlayer}
            canControl={canControl && myColor === bottomPlayer}
            onPlay={showRedrawBanner ? discardAndRedraw : playCard}
            horizontal
            mustPlayCardId={
              !showRedrawBanner && myColor === bottomPlayer ? reverseBonusCardId : null
            }
          />

          <motion.div className="play-hand-actions">
            <ClickSpark sparkColor="#D31211" sparkCount={6}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowRules(true)}>
                Rules
              </button>
            </ClickSpark>
            <ClickSpark sparkColor="#0063B1" sparkCount={6}>
              <button type="button" className="btn btn-ghost btn-sm menu-btn" onClick={leaveGame}>
                <Icon name="arrow-left" size={14} />
                <span>Menu</span>
              </button>
            </ClickSpark>
          </motion.div>
        </footer>
      </motion.div>

      <AnimatePresence>
        {rawState.phase === 'pickWildColor' && canControl && (
          <motion.div className="overlay" {...overlayAnim}>
            <motion.div className="modal" {...modalAnim}>
              <h2>Choose a Color</h2>
              <p>Pick the active color for your Wild card.</p>
              <motion.div className="color-grid">
                {COLORS.map((c: Color) => (
                  <button key={c} type="button" className={`color-btn ${c}`} onClick={() => pickWild(c)}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </motion.div>
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
              <motion.div className="promo-grid">
                {(['queen', 'rook', 'bishop', 'knight'] as const).map((p) => (
                  <button key={p} type="button" className="promo-btn" onClick={() => promote(p)}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </motion.div>
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
              <motion.div className="actions">
                {vetoCards.map((c) => (
                  <button key={c.id} type="button" className="btn btn-amber" onClick={() => veto(c.id)}>
                    Play Reverse
                  </button>
                ))}
                <button type="button" className="btn" onClick={concedeCapture}>
                  Accept
                </button>
              </motion.div>
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
              {eloMessage && gameMode === 'online' && <p className="elo-result">{eloMessage}</p>}
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
              <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                <p><strong>Setup:</strong> 7 cards each.</p>
                <p><strong>Your turn:</strong> Play a card, move, draw 1.</p>
              </motion.div>
              <motion.div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowRules(false)}>
                  Got it
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
