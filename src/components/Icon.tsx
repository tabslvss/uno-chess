import type { ReactNode, SVGProps } from 'react';

type IconName =
  | 'pawn'
  | 'users'
  | 'bolt'
  | 'cpu'
  | 'plus'
  | 'key'
  | 'lock'
  | 'logout'
  | 'arrow-left'
  | 'arrow-right'
  | 'eye'
  | 'eye-off'
  | 'copy'
  | 'check'
  | 'x'
  | 'cards'
  | 'reverse'
  | 'clock'
  | 'rook'
  | 'cpu-spark';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

const PATHS: Record<IconName, ReactNode> = {
  pawn: (
    <path
      d="M12 2.4a3.4 3.4 0 0 1 2.7 5.45c1.05.65 1.78 1.78 1.94 3.07h-.04c.04.27.06.55.06.83 0 1.7-.78 3.22-2 4.21V18h1.5a1 1 0 0 1 1 1v.5h1a1 1 0 0 1 1 1V21H6v-.5a1 1 0 0 1 1-1h1V19a1 1 0 0 1 1-1h1.5v-2.04A5.49 5.49 0 0 1 8.5 11.75c0-.28.02-.56.06-.83h-.04A4.5 4.5 0 0 1 9.3 7.85 3.4 3.4 0 0 1 12 2.4Z"
      fill="currentColor"
    />
  ),
  users: (
    <>
      <path
        d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7 .5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        fill="currentColor"
      />
      <path
        d="M2.5 19.2c0-2.6 2.9-4.7 6.5-4.7s6.5 2.1 6.5 4.7v.8h-13v-.8Zm14.5-3.7c2.5.4 4.5 2 4.5 4v.5h-4v-.8c0-1.4-.5-2.7-1.4-3.7h.9Z"
        fill="currentColor"
      />
    </>
  ),
  bolt: (
    <path d="M13.5 2 4 13.5h6L9 22l10-12h-6l.5-8Z" fill="currentColor" />
  ),
  cpu: (
    <>
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
      <path
        d="M10 2v2M14 2v2M10 20v2M14 20v2M2 10h2M2 14h2M20 10h2M20 14h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),
  'cpu-spark': (
    <>
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m11 9-1.6 3.4 3 .3-1.4 3.3 3.6-4.3-3-.3L13 9h-2Z"
        fill="currentColor"
      />
    </>
  ),
  plus: (
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  ),
  key: (
    <>
      <circle cx="8" cy="14" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M11 12 21 2m-3 3 2 2m-5 5 2 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </>
  ),
  lock: (
    <>
      <rect
        x="5"
        y="11"
        width="14"
        height="9"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  logout: (
    <>
      <path
        d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M9 8 5 12l4 4M5 12h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  'arrow-left': (
    <path
      d="m14 6-6 6 6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'arrow-right': (
    <path
      d="m10 6 6 6-6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  eye: (
    <>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </>
  ),
  'eye-off': (
    <>
      <path
        d="M3 3l18 18M10.5 6.2a10 10 0 0 1 1.5-.2c6.5 0 10 7 10 7a14.6 14.6 0 0 1-3.3 4M6.6 6.6C3.7 8.6 2 12 2 12s3.5 7 10 7c1.7 0 3.3-.4 4.6-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  copy: (
    <>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  check: (
    <path
      d="m5 12 4 4 10-10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  x: (
    <path
      d="M6 6l12 12M18 6 6 18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  ),
  cards: (
    <>
      <rect
        x="3"
        y="6"
        width="11"
        height="14"
        rx="1.5"
        transform="rotate(-8 8.5 13)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="10"
        y="4"
        width="11"
        height="14"
        rx="1.5"
        transform="rotate(8 15.5 11)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </>
  ),
  reverse: (
    <>
      <path
        d="M3 12a9 9 0 0 1 15.5-6.3L21 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M21 3v5h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 12a9 9 0 0 1-15.5 6.3L3 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M3 21v-5h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7v5l3 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </>
  ),
  rook: (
    <path
      d="M6 4h2v2h2V4h4v2h2V4h2v6l-2 2v6h2v2H4v-2h2v-6L4 10V4h2Z"
      fill="currentColor"
    />
  ),
};

export function Icon({ name, size = 18, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
