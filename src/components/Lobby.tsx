import { useAuthStore } from '../store/authStore';
import { Icon } from './Icon';
import {
  SpotlightCard,
  ShinyText,
  FadeContent,
  ClickSpark,
} from './reactbits';

type LobbyChoice = 'friend' | 'random' | 'bot';

interface LobbyProps {
  onSelect: (choice: LobbyChoice) => void;
}

const cards: Array<{
  key: LobbyChoice;
  cls: string;
  icon: 'users' | 'bolt' | 'cpu';
  title: string;
  desc: string;
  badge?: string;
  requiresAuth: boolean;
}> = [
  {
    key: 'friend',
    cls: 'card-primary',
    icon: 'users',
    title: 'Play a Friend',
    desc: 'Create a private room or enter a code.',
    requiresAuth: true,
  },
  {
    key: 'random',
    cls: 'card-ranked',
    icon: 'bolt',
    title: 'Ranked Match',
    desc: 'Climb the ELO ladder against real players.',
    badge: 'Online',
    requiresAuth: true,
  },
  {
    key: 'bot',
    cls: 'card-bot',
    icon: 'cpu',
    title: 'vs Bot',
    desc: 'No login required. Easy to Extreme.',
    requiresAuth: false,
  },
];

export function Lobby({ onSelect }: LobbyProps) {
  const session = useAuthStore((s) => s.session);

  return (
    <div className="hero">
      <FadeContent playOnMount blur duration={700} delay={0}>
        <div className="hero-eyebrow glass-pill">
          <Icon name="pawn" size={14} />
          <span>Hybrid Card &amp; Board Game</span>
        </div>
      </FadeContent>

      <FadeContent playOnMount blur duration={800} delay={80}>
        <h1 className="hero-title" aria-label="UNO Chess">
          <span className="wm u">U</span>
          <span className="wm n">N</span>
          <span className="wm o">O</span>
          <span className="wm-space" aria-hidden> </span>
          <span className="wm c">C</span>
          <span className="wm h">H</span>
          <span className="wm e">E</span>
          <span className="wm s">S</span>
          <span className="wm s2">S</span>
        </h1>
      </FadeContent>

      <FadeContent playOnMount duration={700} delay={160}>
        <p className="hero-subtitle">
          <ShinyText
            text="Play a card, unlock a rank or file, then make your move."
            speed={3}
            color="#c8cbd1"
            shineColor="#ffffff"
            className="hero-shiny-line"
          />
          <br />
          <ShinyText
            text="The twist of UNO meets the depth of chess."
            speed={3.5}
            delay={0.4}
            color="#8a8f99"
            shineColor="#F9D71C"
            className="hero-shiny-line"
          />
        </p>
      </FadeContent>

      <div className="hero-actions">
        {cards.map((card, i) => (
          <FadeContent key={card.key} playOnMount duration={600} delay={240 + i * 90}>
            <SpotlightCard
              className="hero-card-spotlight"
              spotlightColor="rgba(249, 215, 28, 0.18)"
            >
              <ClickSpark sparkColor="#D31211" sparkCount={10} duration={350}>
                <button
                  type="button"
                  className={`hero-card glass-card ${card.cls}`}
                  onClick={() => onSelect(card.key)}
                >
                  {card.badge && <span className="hero-card-badge">{card.badge}</span>}
                  {card.requiresAuth && !session && (
                    <span className="hero-card-lock" aria-label="Login required">
                      <Icon name="lock" size={14} />
                    </span>
                  )}
                  <span className="hero-card-icon" aria-hidden>
                    <Icon name={card.icon} size={22} />
                  </span>
                  <span className="hero-card-title">{card.title}</span>
                  <span className="hero-card-desc">{card.desc}</span>
                </button>
              </ClickSpark>
            </SpotlightCard>
          </FadeContent>
        ))}
      </div>
    </div>
  );
}
