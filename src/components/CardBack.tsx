import { motion } from 'framer-motion';
import { FACEDOWN_SRC } from '../assets/cardAssets';
import './CardBack.css';

interface CardBackProps {
  index?: number;
  small?: boolean;
}

export function CardBack({ index = 0, small }: CardBackProps) {
  return (
    <motion.img
      src={FACEDOWN_SRC}
      alt=""
      className={['card-surface', 'card-back-img', small ? 'card-surface--sm' : ''].filter(Boolean).join(' ')}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, rotate: (index % 5) - 2 }}
      transition={{ delay: index * 0.04 }}
      draggable={false}
    />
  );
}
