import { expect, test } from '@playwright/test';
import { takeTurn } from './helpers';

test('friend invite: two browsers play an online game', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto('/play?tab=friend');
  await a.getByRole('radio', { name: /White/ }).click();
  await a.getByTestId('create-invite').click();
  await expect(a.getByText('Waiting for your friend')).toBeVisible();
  const link = await a.getByRole('textbox', { name: 'Invite link' }).inputValue();

  await b.goto(link);
  for (const p of [a, b]) await expect(p.getByTestId('board')).toBeVisible({ timeout: 15_000 });

  // White (a) then Black (b) take turns.
  await takeTurn(a);
  await expect(b.getByTestId('prompt')).not.toHaveText(/Waiting/, { timeout: 10_000 });
  await takeTurn(b);
  await expect(a.getByTestId('prompt')).toHaveText(/Play a card|discard/, { timeout: 10_000 });

  // Spectator joins and sees the same board.
  const c = await (await browser.newContext()).newPage();
  await c.goto(link);
  await expect(c.getByText('Spectating')).toBeVisible();

  // Draw offer accepted ends the game for both.
  await a.getByTestId('offer-draw').filter({ visible: true }).first().click();
  await b.getByRole('button', { name: 'Accept' }).click();
  for (const p of [a, b]) await expect(p.getByTestId('result-dialog')).toBeVisible();
  await expect(a.getByText('Draw by agreement.').first()).toBeVisible();

  // Rematch swaps colours.
  await a.getByTestId('rematch').click();
  await b.getByTestId('rematch').click();
  await expect(b.getByTestId('result-dialog')).toBeHidden({ timeout: 10_000 });
});

test('casual matchmaking pairs two guests', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  for (const p of [a, b]) {
    await p.goto('/play?tab=online');
    await p.getByRole('button', { name: '30 min' }).click();
    await p.getByTestId('find-game').click();
  }
  for (const p of [a, b]) {
    await expect(p).toHaveURL(/\/game\//, { timeout: 15_000 });
    await expect(p.getByTestId('board')).toBeVisible();
  }
  expect(a.url()).toBe(b.url());
});

test('unknown game link shows a friendly message', async ({ page }) => {
  await page.goto('/game/doesnotexist123');
  await expect(page.getByText('Hmm, no game here')).toBeVisible();
});
