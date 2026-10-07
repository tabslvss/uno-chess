import { expect, test, type Page } from '@playwright/test';
import { boardFromFen } from '../src/game/board';
import { createGame } from '../src/game/engine';
import type { Card, GameState } from '../src/game/types';

const c = (id: string, kind: Card['kind'], color: Card['color'], value?: number): Card => ({ id, kind, color, value });

/** Load a crafted pass & play position straight into local storage. */
async function loadPosition(page: Page, patch: Partial<GameState>) {
  const state = { ...createGame({ seed: 7 }), ...patch };
  await page.goto('/');
  await page.evaluate((s) => {
    localStorage.setItem(
      'unochess-local-game',
      JSON.stringify({ state: { setup: { mode: 'local', tc: null, names: { w: 'Ada', b: 'Bo' } }, state: s, clock: null, gameId: 1 }, version: 2 }),
    );
  }, state);
  await page.goto('/local');
  await expect(page.getByTestId('board')).toBeVisible();
}

async function captureWithWild(page: Page, from: string, to: string) {
  await page.locator('[data-testid=hand] button').first().click();
  await page.getByTestId('wild-red').click();
  await page.locator(`[data-sq=${from}]`).click();
  await page.locator(`[data-sq=${to}]`).click();
}

test('forgetting to call UNO with a lone king gets you caught', async ({ page }) => {
  await loadPosition(page, {
    board: boardFromFen('4k2n/8/8/8/8/8/8/4K2R'),
    hands: { w: [c('w1', 'wild', null), c('w2', 'number', 'green', 3)], b: [c('b1', 'number', 'blue', 2), c('b2', 'number', 'yellow', 6)] },
    discard: [c('top', 'number', 'green', 5)],
    activeColor: 'green',
  });
  await captureWithWild(page, 'h1', 'h8');
  // Bo is now a lone king: hand is hidden until they take the device.
  await page.getByRole('button', { name: /show my cards/ }).click();
  await expect(page.getByTestId('call-uno')).toBeVisible();
  await expect(page.getByText('lone king').first()).toBeVisible();
  // Bo forgets and just discards.
  await page.locator('[data-testid=hand] button').first().click();
  await page.getByRole('button', { name: /show my cards/ }).click();
  await page.getByTestId('catch-uno').click();
  await expect(page.getByTestId('result-dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Ada wins!');
  await expect(page.getByRole('dialog')).toContainText('forgot to call UNO');
});

test('calling UNO keeps you safe', async ({ page }) => {
  await loadPosition(page, {
    board: boardFromFen('4k2n/8/8/8/8/8/8/4K2R'),
    hands: { w: [c('w1', 'wild', null), c('w2', 'number', 'green', 3)], b: [c('b1', 'number', 'blue', 2), c('b2', 'number', 'yellow', 6)] },
    discard: [c('top', 'number', 'green', 5)],
    activeColor: 'green',
  });
  await captureWithWild(page, 'h1', 'h8');
  await page.getByRole('button', { name: /show my cards/ }).click();
  await page.getByTestId('call-uno').click();
  await expect(page.getByText('UNO!').first()).toBeVisible();
  await expect(page.getByTestId('call-uno')).toBeHidden();
});

test('a matching Reverse vetoes a king capture', async ({ page }) => {
  await loadPosition(page, {
    board: boardFromFen('7k/8/8/8/8/8/8/4K2R'),
    hands: { w: [c('w1', 'wild', null), c('w2', 'number', 'green', 3)], b: [c('b1', 'reverse', 'red'), c('b2', 'number', 'yellow', 6)] },
    discard: [c('top', 'number', 'green', 5)],
    activeColor: 'green',
  });
  await captureWithWild(page, 'h1', 'h8');
  await page.getByTestId('veto').click();
  await expect(page.locator('[data-sq=h8] [data-piece]')).toHaveCount(1);
  await expect(page.getByTestId('result-dialog')).toBeHidden();
  await expect(page.getByTestId('prompt')).toHaveText(/Play a card|discard/);
});

test('Draw Two swaps two cards', async ({ page }) => {
  await loadPosition(page, {
    hands: {
      w: [c('w1', 'draw2', 'green'), c('w2', 'number', 'blue', 8), c('w3', 'number', 'yellow', 8), c('w4', 'number', 'red', 2)],
      b: [c('b1', 'number', 'blue', 2)],
    },
    discard: [c('top', 'number', 'green', 5)],
    activeColor: 'green',
  });
  const cards = page.locator('[data-testid=hand] button');
  await cards.first().click();
  await expect(page.getByTestId('prompt')).toContainText('Draw Two');
  await expect(page.getByTestId('confirm-draw2')).toBeDisabled();
  await cards.nth(0).click();
  await cards.nth(1).click();
  await page.getByTestId('confirm-draw2').click();
  await page.getByRole('button', { name: /show my cards/ }).click();
  await expect(page.getByTestId('prompt')).toContainText(/Play a card|discard/);
});
