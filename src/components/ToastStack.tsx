import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import './ToastStack.css';

export function ToastStack() {
  const toasts = useGameStore((s) => s.toasts);

  return (
    <motion.div className="toast-stack" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast--${t.kind}`}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
