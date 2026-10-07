import { createElement, useEffect, useState } from 'react';
import type { PieceRenderObject } from 'react-chessboard';

const CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] as const;
let cached: Promise<PieceRenderObject | null> | null = null;

function loads(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/**
 * Custom piece art: if all twelve /pieces/<code>.png files exist (see docs/ASSET_PROMPTS.md),
 * boards use them; otherwise react-chessboard's default set is used.
 */
export function usePieceSet(): PieceRenderObject | undefined {
  const [pieces, setPieces] = useState<PieceRenderObject | null>(null);
  useEffect(() => {
    cached ??= Promise.all(CODES.map((c) => loads(`/pieces/${c}.png`))).then((ok) =>
      ok.every(Boolean)
        ? (Object.fromEntries(
            CODES.map((c) => [
              c,
              () => createElement('img', { src: `/pieces/${c}.png`, alt: '', draggable: false, style: { width: '100%', height: '100%', objectFit: 'contain' } }),
            ]),
          ) as PieceRenderObject)
        : null,
    );
    let live = true;
    void cached.then((p) => live && setPieces(p));
    return () => {
      live = false;
    };
  }, []);
  return pieces ?? undefined;
}
