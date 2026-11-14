// Balance table: bot versus bot, no rendering.
//   npm run sim -- --seed 1 --matches 200 [--left hard] [--right hard]
// Same flags always print the same table.
import { CARDS, CARD_IDS, TICK_RATE, type CardId } from '../src/sim/balance';
import type { Difficulty } from '../src/sim/bot';
import { runBotMatch } from '../src/sim/match';

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

function difficulty(name: string): Difficulty {
  const value = flag(name, 'hard');
  if (value !== 'easy' && value !== 'hard') throw new Error(`--${name} must be easy or hard`);
  return value;
}

const seed = Number(flag('seed', '1'));
const matches = Number(flag('matches', '200'));
if (!Number.isInteger(seed) || !Number.isInteger(matches) || matches < 1) {
  throw new Error('--seed and --matches must be whole numbers, with at least 1 match');
}
const left = difficulty('left');
const right = difficulty('right');

const played = Object.fromEntries(CARD_IDS.map((id) => [id, 0])) as Record<CardId, number>;
const playedByWinner = { ...played };
const wins = { left: 0, right: 0, draw: 0 };
let totalTicks = 0;

for (let i = 0; i < matches; i++) {
  const { state, plays } = runBotMatch(seed + i, left, right);
  totalTicks += state.tick;
  if (state.winner === 0) wins.left++;
  else if (state.winner === 1) wins.right++;
  else wins.draw++;
  for (const id of CARD_IDS) {
    played[id] += plays[id][0] + plays[id][1];
    if (state.winner === 0 || state.winner === 1) playedByWinner[id] += plays[id][state.winner];
  }
}

const percent = (part: number, whole: number): string => (whole === 0 ? '   n/a' : `${((100 * part) / whole).toFixed(1)}%`.padStart(6));

console.log(`Lane Clash balance: ${matches} matches, seed ${seed}, left=${left} right=${right}\n`);
console.log('card      cost   played   win rate');
console.log('--------  ----  -------  ---------');
for (const id of CARD_IDS) {
  console.log(
    `${id.padEnd(8)}  ${String(CARDS[id].cost).padStart(4)}  ${String(played[id]).padStart(7)}  ${percent(playedByWinner[id], played[id]).padStart(9)}`,
  );
}
console.log('\nwin rate = deployments by the side that won / all deployments of that card');
console.log(`\nleft wins   ${String(wins.left).padStart(4)}  ${percent(wins.left, matches)}`);
console.log(`right wins  ${String(wins.right).padStart(4)}  ${percent(wins.right, matches)}`);
console.log(`draws       ${String(wins.draw).padStart(4)}  ${percent(wins.draw, matches)}`);
console.log(`average match length  ${(totalTicks / matches / TICK_RATE).toFixed(1)} s`);
