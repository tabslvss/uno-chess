/** Friendly generated avatars from the public DiceBear API (no account needed). */
export function avatarFor(seed: string, url?: string | null): string {
  if (url) return url;
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}&radius=30&backgroundColor=f0d9b5,e7f0dc,dfe8f5,f6dcd6,fbecd3`;
}
