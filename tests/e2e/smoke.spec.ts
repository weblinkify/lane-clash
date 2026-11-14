import { expect, test, type Page } from '@playwright/test';
import type { State } from '../../src/sim/sim';

/** The hook the game exposes when the URL has ?test=1. */
interface TestHook {
  state(): State;
  fastForward(): void;
}
declare global {
  interface Window {
    __laneClash: TestHook;
  }
}

const title = (page: Page) => page.locator('#overlay-title');
const subtitle = (page: Page) => page.locator('#overlay-sub');

/** Taps the canvas at a fraction of its width and height. */
async function tapField(page: Page, fx: number, fy: number): Promise<void> {
  const box = (await page.locator('#game').boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
}

test('a match can be played by touch from menu to result, and the win count survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // The page loads on a touch-enabled phone viewport and shows the menu.
  await page.goto('/?test=1&bot=idle&seed=1');
  await expect(title(page)).toHaveText('Lane Clash');
  await expect(subtitle(page)).toContainText('Wins: 0');
  expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);

  await page.locator('#play-easy').tap();
  await expect(page.locator('#overlay')).toBeHidden();

  // A card can be tapped...
  const boulder = page.locator('.card[data-card="boulder"]');
  await boulder.tap();
  await expect(boulder).toHaveClass(/selected/);

  // ...a tap on the enemy half is refused...
  await tapField(page, 0.5, 0.2);
  await expect(boulder).toHaveClass(/selected/);
  expect(await page.evaluate(() => window.__laneClash.state().units.length)).toBe(0);

  // ...and a tap on my half places it and spends the energy.
  await tapField(page, 0.5, 0.75);
  await expect.poll(() => page.evaluate(() => window.__laneClash.state().units.length)).toBe(1);
  expect(await page.evaluate(() => window.__laneClash.state().energy[0])).toBeLessThan(1);
  await expect(boulder).not.toHaveClass(/selected/);

  // The match reaches the result screen.
  await page.evaluate(() => window.__laneClash.fastForward());
  await expect(title(page)).toHaveText('Victory!');
  await expect(subtitle(page)).toContainText('Wins: 1');

  // Play Again starts a fresh match.
  await page.locator('#play-again').tap();
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => window.__laneClash.state().winner)).toBeNull();
  expect(await page.evaluate(() => window.__laneClash.state().units.length)).toBe(0);

  // The win count survives a reload.
  await page.reload();
  await expect(subtitle(page)).toContainText('Wins: 1');

  expect(errors).toEqual([]);
});

test('the page fits the phone screen without scrolling', async ({ page }) => {
  await page.goto('/');
  const size = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    scrollH: document.documentElement.scrollHeight,
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  expect(size.scrollW).toBeLessThanOrEqual(size.w);
  expect(size.scrollH).toBeLessThanOrEqual(size.h);
  // All four cards are on screen.
  for (const card of await page.locator('.card').all()) await expect(card).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.card')).toHaveCount(4);
});

test('the game is installable and loads offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  // Wait until the service worker has taken control and precached the build.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await expect(title(page)).toHaveText('Lane Clash');
  await page.locator('#play-easy').tap();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('.card')).toHaveCount(4);
});
