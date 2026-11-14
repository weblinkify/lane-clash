// Game loop: collects commands from input and the bot, steps the simulation at a fixed rate,
// renders. This file owns the clock; the simulation never sees real time.
import './style.css';
import { lockPageGestures, onFieldTap } from './input/input';
import { fitCanvas, render } from './render/render';
import { CARDS, TICK_RATE, type CardId } from './sim/balance';
import { botDecide, createBot, type Bot, type Difficulty } from './sim/bot';
import { canApply, createState, step, type Command, type State } from './sim/sim';
import { createHud } from './ui/hud';
import { addWin, getWins, hideOverlay, showOverlay } from './ui/screens';

const params = new URLSearchParams(location.search);
const fixedSeed = params.has('seed') ? Number(params.get('seed')) : null;
const testMode = params.has('test');
/** Test-only: an opponent that never plays, so a smoke test can win reliably. */
const idleBot = testMode && params.get('bot') === 'idle';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let view = fitCanvas(canvas);
new ResizeObserver(() => (view = fitCanvas(canvas))).observe(canvas);

let state: State = createState(1);
let bot: Bot | null = null;
let difficulty: Difficulty = 'easy';
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

function startMatch(chosen: Difficulty): void {
  difficulty = chosen;
  const seed = fixedSeed ?? (Date.now() & 0x7fffffff);
  state = createState(seed);
  bot = idleBot ? null : createBot(difficulty, 1, seed);
  pending = [];
  previous = new Map();
  selected = null;
  playing = true;
  hideOverlay();
}

function showMenu(): void {
  showOverlay('Lane Clash', `Destroy the red tower before time runs out.\n🏆 Wins: ${getWins()}`, [
    { id: 'play-easy', label: 'Easy', onClick: () => startMatch('easy') },
    { id: 'play-hard', label: 'Hard', onClick: () => startMatch('hard') },
  ]);
}

function endMatch(): void {
  playing = false;
  selected = null;
  const wins = state.winner === 0 ? addWin() : getWins();
  const title = state.winner === 0 ? 'Victory!' : state.winner === 1 ? 'Defeat' : 'Draw';
  const [mine, theirs] = state.towers;
  showOverlay(title, `Your tower ${mine.hp} · Enemy tower ${theirs.hp}\n🏆 Wins: ${wins}`, [
    { id: 'play-again', label: 'Play Again', onClick: () => startMatch(difficulty) },
    { id: 'menu', label: 'Menu', secondary: true, onClick: showMenu },
  ]);
}

function tick(): void {
  previous = new Map(state.units.map((u) => [u.id, { x: u.x, y: u.y }]));
  const botCommand = bot ? botDecide(bot, state) : null;
  if (botCommand) pending.push(botCommand);
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

if (testMode) {
  // Hooks for the Playwright smoke test and the GIF recorder; absent in normal play.
  Object.assign(window, {
    __laneClash: {
      state: () => state,
      /** Runs the rest of the match instantly. */
      fastForward: () => {
        while (playing) tick();
      },
    },
  });
}

showMenu();
requestAnimationFrame(frame);
