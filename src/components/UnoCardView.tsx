import { motion } from 'framer-motion';
import { cardLabel } from '../game/uno';
import { cardImage } from '../assets/CardImages/manifest';
import type { UnoCard } from '../game/types';
import './UnoCardView.css';

interface Props {
  card: UnoCard;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
  large?: boolean;
  onClick?: () => void;
}

export function UnoCardView({ card, selected, disabled, small, large, onClick }: Props) {
  const label = cardLabel(card);
  const isLetter = card.type === 'letter';
  const img = cardImage(card);

  return (
    <motion.button
      type="button"
      className={[
        'uno-card',
        card.color,
        selected ? 'selected' : '',
        small ? 'small' : '',
        large ? 'large' : '',
        isLetter ? 'letter-card' : '',
        img ? 'has-image' : '',
        !onClick ? 'no-hover' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled || !onClick ? {} : { y: -12, scale: 1.04 }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      layout
    >
      {img ? (
        <img className="uno-card-img" src={img} alt={label} draggable={false} />
      ) : (
        <>
          <span className="uno-corner">{label}</span>
          <span className={`uno-center${isLetter ? ' letter-big' : ''}`}>{label}</span>
        </>
      )}
    </motion.button>
  );
}
