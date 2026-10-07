import { describe, expect, it } from 'vitest';
import { AVATAR_STYLES, avatarSrc, avatarUrl, isAvatarUrl, parseAvatar, randomAvatar, randomSeed } from './avatar';

describe('avatars', () => {
  it('builds and parses canonical DiceBear URLs', () => {
    const url = avatarUrl('bottts', 'abc123');
    expect(url).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=abc123');
    expect(parseAvatar(url)).toEqual({ style: 'bottts', seed: 'abc123' });
  });

  it('rejects anything that is not a known DiceBear style URL', () => {
    for (const bad of [
      'https://evil.example/x.png',
      'https://api.dicebear.com/9.x/bottts/svg?seed=abc&backgroundColor=000',
      'https://api.dicebear.com/9.x/unknown-style/svg?seed=abc',
      'http://api.dicebear.com/9.x/bottts/svg?seed=abc',
      'https://api.dicebear.com/9.x/bottts/svg?seed=<script>',
      'javascript:alert(1)',
      null,
      undefined,
      '',
    ]) {
      expect(isAvatarUrl(bad)).toBe(false);
    }
  });

  it('random avatars are always valid and vary', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const a = randomAvatar();
      expect(isAvatarUrl(a)).toBe(true);
      seen.add(a);
    }
    expect(seen.size).toBeGreaterThan(190);
    const styles = new Set([...seen].map((u) => parseAvatar(u)!.style));
    expect(styles.size).toBeGreaterThan(5);
    expect(parseAvatar(randomAvatar('lorelei'))!.style).toBe('lorelei');
    expect(randomSeed()).toMatch(/^[a-z0-9]{9}$/);
    expect(AVATAR_STYLES.length).toBe(10);
  });

  it('render URLs add display options and fall back to a seeded avatar', () => {
    expect(avatarSrc('x', avatarUrl('thumbs', 'q1'))).toMatch(/^https:\/\/api\.dicebear\.com\/9\.x\/thumbs\/svg\?seed=q1&radius=20&backgroundColor=/);
    expect(avatarSrc('Cozy Rook!', 'https://evil.example/x.png')).toContain('seed=CozyRook');
  });
});
