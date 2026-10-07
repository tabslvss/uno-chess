import { expect, type Page } from '@playwright/test';

/** Take one full turn for the local player: play a card (or discard / Draw Two) and make a move. */
export async function takeTurn(page: Page): Promise<void> {
  const prompt = page.getByTestId('prompt');
  await expect(prompt).not.toHaveText(/thinking|Waiting/, { timeout: 20_000 });
  const text = (await prompt.textContent()) ?? '';
  const cards = page.locator('[data-testid=hand] button');

  if (/discard/i.test(text)) {
    await cards.first().click();
    return;
  }
  if (/Play a card/.test(text)) {
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      await cards.nth(i).click({ force: true });
      if (await page.getByTestId('wild-red').isVisible().catch(() => false)) await page.getByTestId('wild-red').click();
      if (!/Play a card/.test((await prompt.textContent()) ?? '')) break;
    }
  }
  const after = (await prompt.textContent()) ?? '';
  if (/Draw Two/.test(after)) {
    await cards.nth(0).click();
    await cards.nth(1).click();
    await page.getByTestId('confirm-draw2').click();
    return;
  }
  if (/Move|Wild/.test(after)) {
    const pieces = page.locator('[data-movable]');
    const n = await pieces.count();
    for (let i = 0; i < n; i++) {
      await pieces.nth(i).click();
      if (await page.locator('[data-target]').count()) {
        await page.locator('[data-target]').first().click();
        break;
      }
    }
    if (await page.getByRole('button', { name: 'Queen' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Queen' }).click();
    }
  }
}
