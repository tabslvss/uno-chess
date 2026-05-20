import { motion } from 'framer-motion';
import { Icon } from './Icon';

interface FriendMenuProps {
  onCreate: () => void;
  onJoin: () => void;
  onBack: () => void;
}

export function FriendMenu({ onCreate, onJoin, onBack }: FriendMenuProps) {
  return (
    <motion.div
      className="centered-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="glass-card friend-card"
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <h2 className="auth-title">Play a Friend</h2>
        <p className="auth-subtitle">
          Host a private room and share the code, or jump into a friend&apos;s game.
        </p>

        <div className="friend-options">
          <motion.button
            type="button"
            className="option-card option-primary"
            onClick={onCreate}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="option-icon" aria-hidden>
              <Icon name="plus" size={20} />
            </span>
            <span className="option-body">
              <span className="option-title">Create Game</span>
              <span className="option-desc">Generate a code and wait for them.</span>
            </span>
            <span className="option-arrow" aria-hidden>
              <Icon name="arrow-right" size={18} />
            </span>
          </motion.button>

          <motion.button
            type="button"
            className="option-card"
            onClick={onJoin}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="option-icon" aria-hidden>
              <Icon name="key" size={20} />
            </span>
            <span className="option-body">
              <span className="option-title">Enter Code</span>
              <span className="option-desc">Join a friend who is already hosting.</span>
            </span>
            <span className="option-arrow" aria-hidden>
              <Icon name="arrow-right" size={18} />
            </span>
          </motion.button>
        </div>

        <div className="auth-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <Icon name="arrow-left" size={16} />
            <span>Back</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
