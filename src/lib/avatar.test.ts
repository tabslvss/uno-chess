import { describe, expect, it } from 'vitest';
import { avatarSrc, avatarUrl, isAvatarUrl, parseAvatar, randomAvatar, randomSeed } from './avatar';

describe('avatars', () => {
  it('builds and parses canonical adventurer URLs', () => {
    const url = avatarUrl('adventurer', 'abc123');
    expect(url).toBe('https://api.dicebear.com/9.x/adventurer/svg?seed=abc123');
    expect(parseAvatar(url)).toEqual({ style: 'adventurer', seed: 'abc123' });
  });

  it('rejects other styles and anything that is not a DiceBear adventurer URL', () => {
    for (const bad of [
      'https://api.dicebear.com/9.x/bottts/svg?seed=abc',
      'https://api.dicebear.com/9.x/thumbs/svg?seed=abc',
      'https://evil.example/x.png',
      'https://api.dicebear.com/9.x/adventurer/svg?seed=abc&backgroundColor=000',
      'http://api.dicebear.com/9.x/adventurer/svg?seed=abc',
      'https://api.dicebear.com/9.x/adventurer/svg?seed=<script>',
      'javascript:alert(1)',
      null,
      undefined,
      '',
    ]) {
      expect(isAvatarUrl(bad)).toBe(false);
    }
  });

  it('random avatars are always valid adventurers and vary', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const a = randomAvatar();
      expect(parseAvatar(a)?.style).toBe('adventurer');
      seen.add(a);
    }
    expect(seen.size).toBeGreaterThan(190);
    expect(randomSeed()).toMatch(/^[a-z0-9]{9}$/);
  });

  it('render URLs add display options and fall back to a seeded adventurer', () => {
    expect(avatarSrc('x', avatarUrl('adventurer', 'q1'))).toMatch(/^https:\/\/api\.dicebear\.com\/9\.x\/adventurer\/svg\?seed=q1&radius=20&backgroundColor=/);
    expect(avatarSrc('Cozy Rook!', 'https://evil.example/x.png')).toContain('/adventurer/svg?seed=CozyRook');
  });
});
