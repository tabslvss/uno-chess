import { describe, expect, it } from 'vitest';
import { resolveIdentity, sanitizeName } from './identity.ts';

describe('guest identities', () => {
  it('accepts a valid DiceBear avatar and hides the secret guest id', async () => {
    const { identity } = await resolveIdentity({}, {
      guestId: 'secret-guest-id-123',
      guestName: 'Cozy Rook',
      guestAvatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=abc',
    });
    expect(identity.guest).toBe(true);
    expect(identity.name).toBe('Cozy Rook');
    expect(identity.avatarUrl).toBe('https://api.dicebear.com/9.x/adventurer/svg?seed=abc');
    expect(identity.publicId).not.toContain('secret');
  });

  it('drops avatars that are not DiceBear URLs', async () => {
    const { identity } = await resolveIdentity({}, {
      guestId: 'secret-guest-id-123',
      guestAvatar: 'https://evil.example/track.png',
    });
    expect(identity.avatarUrl).toBeNull();
  });

  it('sanitizes names', () => {
    expect(sanitizeName('<b>Hi</b>', 'Guest')).toBe('bHib');
    expect(sanitizeName('x', 'Guest')).toBe('Guest');
  });

  it('an invalid token falls back to a guest with a warning', async () => {
    const r = await resolveIdentity({ SUPABASE_JWT_SECRET: 'secret' }, { guestId: 'g-12345678', token: 'not-a-jwt' });
    expect(r.identity.guest).toBe(true);
    expect(r.error).toMatch(/session expired/);
  });
});
