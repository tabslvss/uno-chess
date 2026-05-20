import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { Icon } from './Icon';

interface AccountBarProps {
  onLogin: () => void;
}

export function AccountBar({ onLogin }: AccountBarProps) {
  const { session, profile, signOut, initialized } = useAuthStore();

  if (!initialized) {
    return <div className="account-pill account-skeleton" aria-hidden />;
  }

  if (!session) {
    return (
      <motion.button
        type="button"
        className="btn btn-sm"
        onClick={onLogin}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
      >
        Log in
      </motion.button>
    );
  }

  const name = profile?.username ?? 'Player';
  const initial = name[0]?.toUpperCase() ?? 'P';
  const elo = profile?.elo ?? 500;

  return (
    <motion.div
      className="account-pill"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span className="account-avatar" aria-hidden>
        {initial}
      </span>
      <span className="account-meta">
        <span className="account-name">{name}</span>
        <span className="account-elo">{elo} ELO</span>
      </span>
      <button
        type="button"
        className="btn-icon"
        onClick={() => void signOut()}
        title="Sign out"
        aria-label="Sign out"
      >
        <Icon name="logout" size={15} />
      </button>
    </motion.div>
  );
}
