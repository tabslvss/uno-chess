import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { Icon } from './Icon';
import { StarBorder, ClickSpark } from './reactbits';

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
      <ClickSpark sparkColor="#D31211" sparkCount={8}>
        <StarBorder
          as="button"
          type="button"
          className="nav-login-border"
          color="#F9D71C"
          speed="5s"
          onClick={onLogin}
        >
          Log in
        </StarBorder>
      </ClickSpark>
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
