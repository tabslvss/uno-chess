import { motion } from 'framer-motion';
import './CardBack.css';

interface CardBackProps {
  index?: number;
  small?: boolean;
}

export function CardBack({ index = 0, small }: CardBackProps) {
  return (
    <motion.div
      className={`card-back ${small ? 'small' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, rotate: (index % 5) - 2 }}
      transition={{ delay: index * 0.04 }}
    >
      <span className="card-back-title">UNO</span>
      <span className="card-back-sub">Chess</span>
    </motion.div>
  );
}
