// The computer opponent. Like a player it only reads the state and returns a command; it keeps
// its own seeded random numbers so it never disturbs the match's generator.
import { CARDS, CARD_IDS, FIELD, TICK_RATE, type Card, type CardId } from './balance';
import { nextRandom, seedRng } from './rng';
import { canApply, enemyOf, type Command, type Side, type State, type Unit } from './sim';

export type Difficulty = 'easy' | 'hard';

export interface Bot {
  difficulty: Difficulty;
  side: Side;
  rng: number;
  /** The tick at which the bot next considers playing. */
  nextThink: number;
}

/** Tuning for the bots' behaviour (not game rules, so it lives here rather than in balance.ts). */
const EASY = { thinkMin: 1.0, thinkMax: 2.5 };
const HARD = {
  think: 0.3,
  /** Cast the spell only if it removes at least this much enemy health. */
  zapValue: 170,
  /** Start an attack once energy reaches this. */
  pushEnergy: 8,
};
/** Rough worth of one unit, used to compare the forces in the bot's half. */
const UNIT_WORTH = { boulder: 5, slinger: 3, gnat: 0.75 } as const;

export function createBot(difficulty: Difficulty, side: Side, seed: number): Bot {
  return { difficulty, side, rng: seedRng(Math.imul(seed, 2) + side + 0x9e3779b9), nextThink: 0 };
}

/** How far up the field a point is from this side's own end (0 = own end, 100 = enemy end). */
function depth(side: Side, y: number): number {
  return side === 0 ? y : FIELD.length - y;
}

function fromDepth(side: Side, d: number): number {
  return side === 0 ? d : FIELD.length - d;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function command(bot: Bot, card: CardId, x: number, y: number): Command {
  return { type: 'play', side: bot.side, card, x: clamp(x, 0, FIELD.width), y: clamp(y, 0, FIELD.length) };
}

/** A unit card placed at a depth in the bot's own half (never on or past the middle line). */
function place(bot: Bot, card: CardId, x: number, d: number): Command {
  return command(bot, card, x, fromDepth(bot.side, clamp(d, 2, FIELD.length / 2 - 1)));
}

function affordable(state: State, bot: Bot, card: CardId): boolean {
  return state.energy[bot.side] >= CARDS[card].cost;
}

/** Returns the command the bot wants to play this tick, or null. Never one it cannot afford. */
export function botDecide(bot: Bot, state: State): Command | null {
  if (state.winner !== null || state.tick < bot.nextThink) return null;
  const choice = bot.difficulty === 'easy' ? decideEasy(bot, state) : decideHard(bot, state);
  return choice && canApply(state, choice) ? choice : null;
}

/** Easy: every second or two, picks a card at random and drops it somewhere in its half. */
function decideEasy(bot: Bot, state: State): Command | null {
  const wait = EASY.thinkMin + nextRandom(bot) * (EASY.thinkMax - EASY.thinkMin);
  bot.nextThink = state.tick + Math.round(wait * TICK_RATE);

  const id = CARD_IDS[Math.floor(nextRandom(bot) * CARD_IDS.length)]!;
  const card: Card = CARDS[id];
  if (!affordable(state, bot, id)) return null;
  if (card.type === 'spell') {
    const enemies = state.units.filter((u) => u.side !== bot.side);
    if (enemies.length === 0) return null;
    const target = enemies[Math.floor(nextRandom(bot) * enemies.length)]!;
    return command(bot, id, target.x, target.y);
  }
  return place(bot, id, 5 + nextRandom(bot) * (FIELD.width - 10), 15 + nextRandom(bot) * 30);
}

/** Hard: spends the spell only on good targets, answers attacks with the right counter, and
 *  saves energy to attack with a tank in front and damage behind it. */
function decideHard(bot: Bot, state: State): Command | null {
  bot.nextThink = state.tick + Math.round(HARD.think * TICK_RATE);
  const me = bot.side;
  const enemies = state.units.filter((u) => u.side !== me);
  const friends = state.units.filter((u) => u.side === me);
  const jitter = (nextRandom(bot) - 0.5) * 6;

  // 1. Spell: finish the tower, or hit the best cluster if it is worth the energy.
  if (affordable(state, bot, 'zap')) {
    const zap = CARDS.zap;
    const tower = state.towers[enemyOf(me)];
    if (tower.hp <= zap.towerDamage) return command(bot, 'zap', tower.x, tower.y);
    let best: Unit | null = null;
    let bestValue = HARD.zapValue;
    for (const centre of enemies) {
      let value = 0;
      for (const other of enemies) {
        if (Math.hypot(other.x - centre.x, other.y - centre.y) <= zap.radius) value += Math.min(other.hp, zap.damage);
      }
      if (value >= bestValue) {
        best = centre;
        bestValue = value;
      }
    }
    if (best) return command(bot, 'zap', best.x, best.y);
  }

  // 2. Defence: if the enemy has more force in my half than I do, counter their lead unit.
  const half = FIELD.length / 2;
  const worth = (units: Unit[]): number =>
    units.filter((u) => depth(me, u.y) < half + 5).reduce((sum, u) => sum + UNIT_WORTH[u.kind], 0);
  if (worth(enemies) > worth(friends)) {
    const threat = enemies.reduce((a, b) => (depth(me, a.y) < depth(me, b.y) ? a : b));
    const counters: CardId[] =
      threat.kind === 'boulder' ? ['gnats', 'slinger'] : threat.kind === 'gnat' ? ['boulder', 'gnats'] : ['gnats', 'boulder'];
    for (const id of counters) {
      if (!affordable(state, bot, id)) continue;
      // Ranged defenders stand back; melee defenders land on top of the threat.
      const d = depth(me, threat.y) - (id === 'slinger' ? 12 : 0);
      return place(bot, id, threat.x + jitter, d);
    }
    return null;
  }

  // 3. Attack: wait for a full bar, lead with a tank, then feed damage in behind it.
  const tank = friends.find((u) => u.kind === 'boulder');
  if (tank && depth(me, tank.y) < FIELD.length - 20) {
    const support: CardId = nextRandom(bot) < 0.5 ? 'slinger' : 'gnats';
    if (affordable(state, bot, support) && state.energy[me] >= CARDS[support].cost + 1) {
      return place(bot, support, tank.x + jitter, depth(me, tank.y) - 8);
    }
    return null;
  }
  if (state.energy[me] >= HARD.pushEnergy) {
    return place(bot, 'boulder', 8 + nextRandom(bot) * (FIELD.width - 16), half - 4);
  }
  return null;
}
