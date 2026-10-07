import { expect, test } from '@playwright/test';
import { takeTurn } from './helpers';

test('home → bot game: play turns against the bot', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Play UNO Chess Online/ })).toBeVisible();
  await page.getByTestId('cta-play').click();
  await page.getByRole('tab', { name: /Bots/ }).click();
  await page.getByTestId('bot-pebble').click();
  await page.getByRole('radio', { name: /White/ }).click();
  await page.getByTestId('start-bot').click();

  await expect(page).toHaveURL(/\/bot$/);
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.locator('[data-testid=hand] button')).toHaveCount(7);

  for (let i = 0; i < 4; i++) {
    if (await page.getByTestId('result-dialog').isVisible().catch(() => false)) break;
    await takeTurn(page);
  }
  // The move list has entries for both sides.
  await expect(page.getByRole('list', { name: 'Move history' }).locator('li')).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test('bot games survive a page refresh', async ({ page }) => {
  await page.goto('/play?tab=bot');
  await page.getByRole('radio', { name: /White/ }).click();
  await page.getByTestId('start-bot').click();
  await takeTurn(page);
  const historyBefore = await page.getByRole('list', { name: 'Move history' }).locator('li').count();
  await page.reload();
  await expect(page.getByTestId('board')).toBeVisible();
  expect(await page.getByRole('list', { name: 'Move history' }).locator('li').count()).toBeGreaterThanOrEqual(historyBefore);
  await page.goto('/play');
  await expect(page.getByText('You have a game in progress')).toBeVisible();
});

test('resigning shows the result dialog', async ({ page }) => {
  await page.goto('/play?tab=bot');
  await page.getByTestId('start-bot').click();
  await page.getByTestId('resign').filter({ visible: true }).first().click();
  await page.getByTestId('confirm-resign').click();
  await expect(page.getByTestId('result-dialog')).toBeVisible();
  await expect(page.getByText('You lost')).toBeVisible();
});
