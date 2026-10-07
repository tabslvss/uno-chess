import { expect, test } from '@playwright/test';
import { mockDiceBear } from './helpers';

const DICEBEAR = /^https:\/\/api\.dicebear\.com\/9\.x\/adventurer\/svg\?seed=[a-z0-9]+/;

test('guests get a random avatar that persists, and can pick, shuffle and randomize it', async ({ page }) => {
  await mockDiceBear(page);
  await page.goto('/settings');
  const avatarImg = page.getByTestId('my-avatar').locator('img');
  await expect(avatarImg).toHaveAttribute('src', DICEBEAR);
  const first = await avatarImg.getAttribute('src');

  // Persisted across reloads.
  await page.reload();
  await expect(page.getByTestId('my-avatar').locator('img')).toHaveAttribute('src', first!);

  // One-tap randomize changes it immediately.
  await page.getByTestId('avatar-randomize').click();
  await expect(avatarImg).not.toHaveAttribute('src', first!);
  const randomized = await avatarImg.getAttribute('src');

  // Picker: switch style, shuffle, pick from the grid, save.
  await page.getByTestId('my-avatar').click();
  const picker = page.getByTestId('avatar-picker');
  await expect(picker).toBeVisible();
  await expect(picker.getByTestId('avatar-option')).toHaveCount(12);
  await picker.getByTestId('avatar-shuffle').click();
  const optionsBefore = await picker.getByTestId('avatar-option').locator('img').first().getAttribute('src');
  await picker.getByTestId('avatar-more').click();
  await expect(picker.getByTestId('avatar-option').locator('img').first()).not.toHaveAttribute('src', optionsBefore!);
  await picker.getByTestId('avatar-option').nth(3).click();
  await picker.getByTestId('avatar-save').click();
  await expect(picker).toBeHidden();
  await expect(avatarImg).toHaveAttribute('src', /\/adventurer\/svg\?seed=/);
  expect(await avatarImg.getAttribute('src')).not.toBe(randomized);

  // The navbar shows the same avatar, and it's used in games.
  const chosen = (await avatarImg.getAttribute('src'))!;
  await expect(page.getByTestId('account-menu').locator('img')).toHaveAttribute('src', chosen);
  await page.goto('/play?tab=bot');
  await page.getByRole('radio', { name: /White/ }).click();
  await page.getByTestId('start-bot').click();
  await expect(page.getByTestId('strip-w').locator('img')).toHaveAttribute('src', chosen);
});

test('online opponents see each other’s avatars', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await mockDiceBear(a);
  await mockDiceBear(b);
  await a.goto('/play?tab=friend');
  await a.getByRole('radio', { name: /White/ }).click();
  const aAvatar = await a.getByTestId('account-menu').locator('img').getAttribute('src');
  await a.getByTestId('create-invite').click();
  const link = await a.getByRole('textbox', { name: 'Invite link' }).inputValue();
  await b.goto('/');
  const bAvatar = await b.getByTestId('account-menu').locator('img').getAttribute('src');
  await b.goto(link);
  await expect(b.getByTestId('strip-w').locator('img').first()).toHaveAttribute('src', aAvatar!);
  await expect(a.getByTestId('strip-b').locator('img').first()).toHaveAttribute('src', bAvatar!);
});
