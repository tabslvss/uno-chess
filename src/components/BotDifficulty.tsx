import { motion } from 'framer-motion';
import type { BotDifficulty } from '../game/types';
import { Icon } from './Icon';

interface BotDifficultyProps {
  onPick: (d: BotDifficulty) => void;
  onBack: () => void;
}

const LEVELS: { id: BotDifficulty; label: string; desc: string }[] = [
  { id: 'easy', label: 'Easy', desc: 'Random moves, friendly mistakes.' },
  { id: 'medium', label: 'Medium', desc: 'Basic strategy and openings.' },
  { id: 'hard', label: 'Hard', desc: 'Stronger tactical play.' },
  { id: 'extreme', label: 'Extreme', desc: 'Aggressive, unforgiving.' },
];

export function BotDifficultyPicker({ onPick, onBack }: BotDifficultyProps) {
  return (
    <motion.div
      className="hero"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.h1
        className="hero-title"
        style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginBottom: '0.5rem' }}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Choose <span>Difficulty</span>
      </motion.h1>
      <motion.p
        className="hero-subtitle"
        style={{ marginBottom: '2rem' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        You will be assigned White or Black at random.
      </motion.p>

      <motion.div
        className="diff-grid"
        style={{ width: '100%', maxWidth: '440px' }}
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        {LEVELS.map((lv) => (
          <motion.button
            key={lv.id}
            type="button"
            className={`glass-card diff-card ${lv.id}`}
            onClick={() => onPick(lv.id)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="diff-label">{lv.label}</span>
            <span className="diff-desc">{lv.desc}</span>
          </motion.button>
        ))}
      </motion.div>

      <motion.button
        type="button"
        className="btn btn-ghost"
        style={{ marginTop: '1.5rem' }}
        onClick={onBack}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <Icon name="arrow-left" size={14} />
        <span>Back</span>
      </motion.button>
    </motion.div>
  );
}
