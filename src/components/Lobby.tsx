import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { Icon } from './Icon';

type LobbyChoice = 'friend' | 'random' | 'bot';

interface LobbyProps {
  onSelect: (choice: LobbyChoice) => void;
}

const cards: Array<{
  key: LobbyChoice;
  cls: string;
  icon: 'users' | 'bolt' | 'cpu';
  title: string;
  desc: string;
  badge?: string;
  requiresAuth: boolean;
}> = [
  {
    key: 'friend',
    cls: 'card-primary',
    icon: 'users',
    title: 'Play a Friend',
    desc: 'Create a private room or enter a code.',
    requiresAuth: true,
  },
  {
    key: 'random',
    cls: 'card-ranked',
    icon: 'bolt',
    title: 'Ranked Match',
    desc: 'Climb the ELO ladder against real players.',
    badge: 'Online',
    requiresAuth: true,
  },
  {
    key: 'bot',
    cls: 'card-bot',
    icon: 'cpu',
    title: 'vs Bot',
    desc: 'No login required. Easy to Extreme.',
    requiresAuth: false,
  },
];

export function Lobby({ onSelect }: LobbyProps) {
  const session = useAuthStore((s) => s.session);

  return (
    <motion.div
      className="hero"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="hero-eyebrow glass-pill"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Icon name="pawn" size={14} />
        <span>Hybrid Card &amp; Board Game</span>
      </motion.div>

      <motion.h1
        className="hero-title"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08 }}
      >
        UNO <span>Chess</span>
      </motion.h1>

      <motion.p
        className="hero-subtitle"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.16 }}
      >
        Play a card, unlock a rank or file, then make your move. The twist of UNO
        meets the depth of chess.
      </motion.p>

      <motion.div
        className="hero-actions"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >
        {cards.map((card, i) => (
          <motion.button
            key={card.key}
            type="button"
            className={`glass-card hero-card ${card.cls}`}
            onClick={() => onSelect(card.key)}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 + i * 0.08, duration: 0.45, ease: 'easeOut' }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            {card.badge && <span className="hero-card-badge">{card.badge}</span>}
            {card.requiresAuth && !session && (
              <span className="hero-card-lock" aria-label="Login required">
                <Icon name="lock" size={14} />
              </span>
            )}
            <span className="hero-card-icon" aria-hidden>
              <Icon name={card.icon} size={22} />
            </span>
            <span className="hero-card-title">{card.title}</span>
            <span className="hero-card-desc">{card.desc}</span>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
