import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './Icon';

interface OnlineJoinProps {
  onJoin: (code: string) => void;
  onBack: () => void;
  error?: string;
  loading?: boolean;
  onClearError?: () => void;
}

export function OnlineJoin({
  onJoin,
  onBack,
  error,
  loading,
  onClearError,
}: OnlineJoinProps) {
  const [code, setCode] = useState('');
  const [slow, setSlow] = useState(false);
  const cleanCode = code.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
  const canSubmit = cleanCode.length >= 4 && !loading;

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <motion.div
      className="centered-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="glass-card join-card"
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <h2 className="auth-title">Join a Room</h2>
        <p className="auth-subtitle">Enter the code your friend shared.</p>

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onJoin(cleanCode);
          }}
        >
          <input
            className="glass-input code-input"
            value={cleanCode}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) onClearError?.();
            }}
            placeholder="ABC123"
            maxLength={8}
            autoFocus
            spellCheck={false}
            inputMode="text"
            disabled={loading}
          />

          <AnimatePresence>
            {error && (
              <motion.div
                key={error}
                className="banner banner-error"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.div>
            )}
            {!error && slow && (
              <motion.div
                key="slow"
                className="banner banner-info"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {import.meta.env.PROD ? (
                  <>Still connecting…</>
                ) : (
                  <>
                    Still connecting… Run <code>npm run dev</code> in the project folder (web +
                    game server).
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="auth-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBack}
              disabled={loading}
            >
              <Icon name="arrow-left" size={14} />
              <span>Back</span>
            </button>
            <motion.button
              type="submit"
              className="btn"
              disabled={!canSubmit}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? (
                <>
                  <span className="btn-spinner" aria-hidden />
                  <span>Joining…</span>
                </>
              ) : (
                'Join'
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
