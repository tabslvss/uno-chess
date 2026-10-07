import { expect, test } from '@playwright/test';

test('game screen fits the viewport without scrolling', async ({ page }) => {
  await page.goto('/play?tab=bot');
  await page.getByTestId('start-bot').click();
  await expect(page.getByTestId('board')).toBeVisible();
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    client: window.innerHeight,
  }));
  expect(scroll).toBeLessThanOrEqual(client + 1);
  const hand = await page.getByTestId('hand').boundingBox();
  const vp = page.viewportSize()!;
  expect(hand!.y + hand!.height).toBeLessThanOrEqual(vp.height + 2);
  const board = await page.getByTestId('board').boundingBox();
  expect(board!.width).toBeGreaterThan(Math.min(vp.width, vp.height) * 0.45);
});

test('pages render', async ({ page }) => {
  for (const path of ['/', '/play', '/rules', '/leaderboard', '/settings', '/login', '/nope']) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Leaderboard' }).first()).toBeVisible();
  }
});

test('leaderboard is populated with easy-to-beat players', async ({ page }) => {
  await page.goto('/leaderboard');
  const rows = page.getByTestId('leaderboard').locator('tbody tr');
  await expect(rows).toHaveCount(48);
  const top = Number((await rows.first().locator('td').nth(2).textContent())?.replace(/\D/g, ''));
  expect(top).toBeLessThan(1200);
  await rows.first().getByRole('link').click();
  await expect(page).toHaveURL(/\/u\//);
  await expect(page.getByText('Think you can beat')).toBeVisible();
});
