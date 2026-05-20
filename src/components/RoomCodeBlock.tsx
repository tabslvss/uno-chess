import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';

interface RoomCodeBlockProps {
  code: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function RoomCodeBlock({ code }: RoomCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(code);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="room-code-block">
      <span className="room-code-label">Room code</span>
      <motion.button
        type="button"
        className={`room-code-pill${copied ? ' copied' : ''}`}
        onClick={() => void handleCopy()}
        title="Click to copy"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
      >
        <span className="room-code-text">{code}</span>
        <span className="room-code-action" aria-hidden>
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="copied"
                className="rc-icon rc-copied"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.18 }}
              >
                <Icon name="check" size={16} />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                className="rc-icon"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.18 }}
              >
                <Icon name="copy" size={16} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </motion.button>
      <AnimatePresence>
        {copied && (
          <motion.span
            key="hint-copied"
            className="copy-hint copy-hint-success"
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            Copied to clipboard
          </motion.span>
        )}
      </AnimatePresence>
      {!copied && <span className="copy-hint">Click code to copy</span>}
    </div>
  );
}
