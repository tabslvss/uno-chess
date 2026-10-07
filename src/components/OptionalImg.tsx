import { useState, type ImgHTMLAttributes } from 'react';

/**
 * Tries each source in order and shows the first one that loads.
 * Lets designers drop in higher-quality art (e.g. /bots/sage.png) without code changes —
 * see docs/ASSET_PROMPTS.md.
 */
export function OptionalImg({ srcs, ...rest }: { srcs: string[] } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const [i, setI] = useState(0);
  if (i >= srcs.length) return null;
  return <img {...rest} src={srcs[i]} onError={() => setI((n) => n + 1)} />;
}
