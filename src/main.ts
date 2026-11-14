// Game loop: collects commands from input, steps the simulation at a fixed rate, renders.
import { onFieldTap } from './input/input';
import { fitCanvas, render } from './render/render';
import { TICK_RATE } from './sim/balance';
import { createState, step, type Command } from './sim/sim';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let view = fitCanvas(canvas);
new ResizeObserver(() => (view = fitCanvas(canvas))).observe(canvas);

let state = createState();
let pending: Command[] = [];
let previous = new Map<number, { x: number; y: number }>();

onFieldTap(canvas, () => view, (x, y) => {
  if (state.winner !== null) {
    state = createState();
    previous = new Map();
    return;
  }
  pending.push({ type: 'place', side: 0, card: 'boulder', x, y });
});

const TICK_MS = 1000 / TICK_RATE;
let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  // Clamp so a backgrounded tab does not fast-forward the match on return.
  accumulator += Math.min(now - last, 250);
  last = now;
  while (accumulator >= TICK_MS) {
    previous = new Map(state.units.map((u) => [u.id, { x: u.x, y: u.y }]));
    step(state, pending);
    pending = [];
    accumulator -= TICK_MS;
  }
  const message =
    state.winner !== null
      ? 'Tower destroyed! Tap to restart'
      : state.units.length === 0
        ? 'Tap your half to send a 🪨'
        : '';
  render(ctx, view, state, previous, accumulator / TICK_MS, message);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
