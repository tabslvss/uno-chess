import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { title: 'Welcome to UNO Chess', body: 'Draw one card per turn, play it, then move on the unlocked rank and file.' },
  { title: 'Cards A–G', body: 'A = rank 1 & a-file, B = rank 2 & b-file, through G = rank 7 & g-file.' },
  {
    title: 'Specials',
    body: 'Wild: any line. Reverse: undo opponent’s last move, draw a card, then move with that card. Skip: no chess move.',
  },
  { title: 'Modes', body: 'Create a game, find a random opponent, or play vs the bot online.' },
];

interface TutorialProps {
  onDone: () => void;
  onSkip: () => void;
}

export function Tutorial({ onDone, onSkip }: TutorialProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <motion.div className="overlay">
      <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <h2>{current.title}</h2>
        <AnimatePresence mode="wait">
          <motion.p key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            {current.body}
          </motion.p>
        </AnimatePresence>
        <motion.div className="tutorial-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'active' : ''} />
          ))}
        </motion.div>
        <motion.div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onSkip}>
            Skip
          </button>
          {!last ? (
            <button type="button" className="btn" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="btn" onClick={onDone}>
              Play
            </button>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
