// Game loop: collects commands from input, steps the simulation at a fixed rate, renders.
import './style.css';
import { lockPageGestures, onFieldTap } from './input/input';
import { fitCanvas, render } from './render/render';
import { CARDS, TICK_RATE, type CardId } from './sim/balance';
import { canApply, createState, step, type Command, type State } from './sim/sim';
import { createHud } from './ui/hud';
import { hideOverlay, showOverlay } from './ui/screens';

const params = new URLSearchParams(location.search);
const fixedSeed = params.has('seed') ? Number(params.get('seed')) : null;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let view = fitCanvas(canvas);
new ResizeObserver(() => (view = fitCanvas(canvas))).observe(canvas);

let state: State = createState(1);
let playing = false;
let selected: CardId | null = null;
let hasPlaced = false;
let pending: Command[] = [];
let previous = new Map<number, { x: number; y: number }>();

const hud = createHud((card) => {
  if (playing) selected = selected === card ? null : card;
});

lockPageGestures();
onFieldTap(canvas, () => view, (x, y) => {
  if (!playing || !selected) return;
  const command: Command = { type: 'play', side: 0, card: selected, x, y };
  // Checked here only so the card stays selected on a bad tap; the simulation checks again.
  if (!canApply(state, command)) return;
  pending.push(command);
  selected = null;
  hasPlaced = true;
});

function startMatch(): void {
  state = createState(fixedSeed ?? (Date.now() & 0x7fffffff));
  pending = [];
  previous = new Map();
  selected = null;
  playing = true;
  hideOverlay();
}

function endMatch(): void {
  playing = false;
  selected = null;
  const title = state.winner === 0 ? 'Victory!' : state.winner === 1 ? 'Defeat' : 'Draw';
  const [mine, theirs] = state.towers;
  showOverlay(title, `Your tower ${mine.hp} · Enemy tower ${theirs.hp}`, [
    { id: 'play-again', label: 'Play Again', onClick: startMatch },
  ]);
}

function tick(): void {
  previous = new Map(state.units.map((u) => [u.id, { x: u.x, y: u.y }]));
  step(state, pending);
  pending = [];
  if (state.winner !== null) endMatch();
}

const TICK_MS = 1000 / TICK_RATE;
let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  // Clamp so a backgrounded tab does not fast-forward the match on return.
  accumulator += Math.min(now - last, 250);
  last = now;
  while (accumulator >= TICK_MS) {
    if (playing) tick();
    accumulator -= TICK_MS;
  }
  const hint = !playing || hasPlaced
    ? ''
    : !selected
      ? 'Pick a card below'
      : CARDS[selected].type === 'unit'
        ? 'Tap your half to place it'
        : 'Tap anywhere to cast it';
  render(ctx, view, state, { previous, alpha: playing ? accumulator / TICK_MS : 1, selected, hint });
  hud.update(state, selected);
  requestAnimationFrame(frame);
}

showOverlay('Lane Clash', 'Destroy the red tower before time runs out.', [
  { id: 'play', label: 'Play', onClick: startMatch },
]);
requestAnimationFrame(frame);
