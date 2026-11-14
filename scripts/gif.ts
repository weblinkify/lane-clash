// Records the README GIF: plays about ten seconds of a seeded match on a phone-sized screen,
// records video with Playwright, converts it to docs/gameplay.gif with ffmpeg.
//   docker compose run --rm gif
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { State } from '../src/sim/sim';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const SIZE = { width: 360, height: 740 };
const OUTPUT = 'docs/gameplay.gif';
const SECONDS = 10;
/** Seconds into the match at which the GIF starts. */
const RECORD_FROM = 6;
const MAX_BYTES = 5 * 1024 * 1024;

const videoDir = mkdtempSync(join(tmpdir(), 'lane-clash-gif-'));
const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['Pixel 7'],
  viewport: SIZE,
  recordVideo: { dir: videoDir, size: SIZE },
});
const page = await context.newPage();
const startedAt = Date.now();
await page.goto(`${BASE_URL}/?test=1&seed=7`);

const wait = (ms: number) => page.waitForTimeout(ms);
const field = page.locator('#game');

/** Taps a card, then a point given in field coordinates (x 0..50, y 0..100 from my end). */
async function playCard(card: string, x: number, y: number): Promise<void> {
  await page.locator(`.card[data-card="${card}"]`).tap();
  await wait(350);
  const box = (await field.boundingBox())!;
  const scale = Math.min(box.width / 50, box.height / 100);
  const left = box.x + (box.width - 50 * scale) / 2;
  const bottom = box.y + (box.height + 100 * scale) / 2;
  await page.touchscreen.tap(left + x * scale, bottom - y * scale);
}

const state = () => page.evaluate(() => (window as unknown as { __laneClash: { state(): State } }).__laneClash.state());

await wait(600);
await page.locator('#play-hard').tap();
const matchStartedAt = Date.now();
/** Waits until the match has been running for this many seconds. */
const until = (seconds: number) => wait(Math.max(0, seconds * 1000 - (Date.now() - matchStartedAt)));

/** Casts the spell on the enemy unit with the most other enemies around it. */
async function zapBestCluster(): Promise<void> {
  const enemies = (await state()).units.filter((u) => u.side === 1);
  const crowd = (c: { x: number; y: number }) => enemies.filter((u) => Math.hypot(u.x - c.x, u.y - c.y) <= 10).length;
  const centre = enemies.sort((p, q) => crowd(q) - crowd(p))[0];
  await playCard('zap', centre?.x ?? 25, centre?.y ?? 60);
}

// The opening is played but not recorded, so the GIF starts with units already fighting.
await until(0.5);
await playCard('gnats', 18, 40);
await until(4);
await playCard('slinger', 30, 28);
await until(RECORD_FROM + 2.5);
await zapBestCluster();
await until(RECORD_FROM + 6);
await playCard('gnats', 24, 34);
await until(RECORD_FROM + SECONDS + 0.3);

await context.close(); // flushes the video file
await browser.close();

const video = join(videoDir, readdirSync(videoDir).find((name) => name.endsWith('.webm'))!);
const skip = ((matchStartedAt - startedAt) / 1000 + RECORD_FROM).toFixed(2);
mkdirSync('docs', { recursive: true });
execFileSync(
  'ffmpeg',
  [
    '-y', '-loglevel', 'error',
    '-ss', skip, '-t', String(SECONDS), '-i', video,
    '-vf', `fps=12,scale=${SIZE.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    OUTPUT,
  ],
  { stdio: 'inherit' },
);
rmSync(videoDir, { recursive: true, force: true });

const bytes = statSync(OUTPUT).size;
console.log(`${OUTPUT}: ${(bytes / 1024).toFixed(0)} KiB`);
if (bytes > MAX_BYTES) throw new Error(`${OUTPUT} is over 5 MB`);
