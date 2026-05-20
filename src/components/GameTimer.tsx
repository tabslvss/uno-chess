interface GameTimerProps {
  seconds: number;
  isActive: boolean;
}

export function GameTimer({ seconds, isActive }: GameTimerProps) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const display = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const low = seconds < 60;

  return (
    <span
      className={`timer${low ? ' low' : ''}${isActive ? ' active' : ''}`}
      aria-label={`${m} minutes ${s} seconds`}
    >
      {display}
    </span>
  );
}
