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

/**
 * Serve DiceBear avatars locally (same library the API uses) so tests don't
 * depend on the network.
 */
export async function mockDiceBear(page: Page): Promise<void> {
  const { createAvatar } = await import('@dicebear/core');
  const collection = (await import('@dicebear/collection')) as unknown as Record<string, Parameters<typeof createAvatar>[0]>;
  await page.route('https://api.dicebear.com/**', async (route) => {
    const url = new URL(route.request().url());
    const styleId = url.pathname.split('/')[2] ?? 'thumbs';
    const camel = styleId.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const style = collection[camel] ?? collection.thumbs!;
    const svg = createAvatar(style, {
      seed: url.searchParams.get('seed') ?? 'x',
      radius: Number(url.searchParams.get('radius') ?? 0),
      backgroundColor: url.searchParams.get('backgroundColor')?.split(',') ?? [],
    }).toString();
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
  });
}
