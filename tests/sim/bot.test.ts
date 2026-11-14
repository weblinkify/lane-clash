import { describe, expect, it } from 'vitest';
import { CARDS, ENERGY, FIELD } from '../../src/sim/balance';
import { botDecide, createBot, type Difficulty } from '../../src/sim/bot';
import { runBotMatch } from '../../src/sim/match';
import { canApply, createState, isInOwnHalf, spawnUnit, step, type Command, type State } from '../../src/sim/sim';
import { MID_X, TOWER_Y } from './helpers';

/** Plays whole matches, handing every command the bots produce to `check` before it is applied. */
function watchMatches(left: Difficulty, right: Difficulty, matches: number, check: (state: State, cmd: Command) => void): number {
  let commands = 0;
  for (let seed = 1; seed <= matches; seed++) {
    const state = createState(seed);
    const bots = [createBot(left, 0, seed), createBot(right, 1, seed)];
    while (state.winner === null) {
      const batch: Command[] = [];
      for (const bot of bots) {
        const cmd = botDecide(bot, state);
        if (cmd) {
          check(state, cmd);
          batch.push(cmd);
          commands++;
        }
      }
      step(state, batch);
    }
  }
  return commands;
}

describe.each(['easy', 'hard'] as const)('%s bot', (difficulty) => {
  it('never plays a card it cannot afford', () => {
    const commands = watchMatches(difficulty, difficulty, 10, (state, cmd) => {
      expect(CARDS[cmd.card].cost).toBeLessThanOrEqual(state.energy[cmd.side]);
    });
    expect(commands).toBeGreaterThan(100);
  });

  it('only ever issues commands the simulation accepts', () => {
    watchMatches(difficulty, difficulty, 10, (state, cmd) => {
      expect(canApply(state, cmd)).toBe(true);
    });
  });

  it('only places units in its own half', () => {
    watchMatches(difficulty, difficulty, 10, (_state, cmd) => {
      if (CARDS[cmd.card].type === 'unit') expect(isInOwnHalf(cmd.side, cmd.x, cmd.y)).toBe(true);
    });
  });

  it('plays only for its own side', () => {
    const state = createState(3);
    const bot = createBot(difficulty, 1, 3);
    for (let i = 0; i < 600; i++) {
      const cmd = botDecide(bot, state);
      if (cmd) expect(cmd.side).toBe(1);
      step(state, cmd ? [cmd] : []);
    }
  });

  it('does not change the match state while deciding', () => {
    const state = createState(5);
    state.energy = [ENERGY.max, ENERGY.max];
    spawnUnit(state, 'boulder', 0, MID_X, 60);
    const before = structuredClone(state);
    botDecide(createBot(difficulty, 1, 5), state);
    expect(state).toEqual(before);
  });

  it('plays nothing once the match is over', () => {
    const state = createState(5);
    state.energy = [ENERGY.max, ENERGY.max];
    state.winner = 'draw';
    expect(botDecide(createBot(difficulty, 0, 5), state)).toBeNull();
  });
});

describe('bot strength', () => {
  it('hard beats easy in a clear majority over 50 seeded matches, playing both sides', () => {
    let hardWins = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const hardSide = seed % 2 === 0 ? 0 : 1;
      const { state } = hardSide === 0 ? runBotMatch(seed, 'hard', 'easy') : runBotMatch(seed, 'easy', 'hard');
      if (state.winner === hardSide) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(35);
  });

  it('the same seed produces the same match', () => {
    expect(runBotMatch(11, 'hard', 'easy')).toEqual(runBotMatch(11, 'hard', 'easy'));
  });

  it('different seeds produce different matches', () => {
    expect(runBotMatch(11, 'easy', 'easy').plays).not.toEqual(runBotMatch(12, 'easy', 'easy').plays);
  });

  it('a match records every deployment it made', () => {
    const { state, plays } = runBotMatch(4, 'easy', 'easy');
    expect(state.winner).not.toBeNull();
    const total = Object.values(plays).reduce((sum, [a, b]) => sum + a + b, 0);
    expect(total).toBeGreaterThan(10);
  });
});

describe('hard bot decisions', () => {
  it('casts the spell on a cluster of enemies', () => {
    const state = createState();
    for (let i = 0; i < 4; i++) spawnUnit(state, 'gnat', 0, 20 + i, 40);
    const cmd = botDecide(createBot('hard', 1, 1), state);
    expect(cmd).toMatchObject({ card: 'zap', side: 1 });
    expect(Math.abs(cmd!.x - 21.5)).toBeLessThanOrEqual(2);
  });

  it('does not waste the spell on a single weak unit', () => {
    const state = createState();
    spawnUnit(state, 'gnat', 0, 20, 40);
    expect(botDecide(createBot('hard', 1, 1), state)?.card).not.toBe('zap');
  });

  it('finishes a nearly dead tower with the spell', () => {
    const state = createState();
    state.towers[0].hp = CARDS.zap.towerDamage;
    expect(botDecide(createBot('hard', 1, 1), state)).toMatchObject({ card: 'zap', x: MID_X, y: TOWER_Y[0] });
  });

  it('answers a tank in its half with the swarm', () => {
    const state = createState();
    spawnUnit(state, 'boulder', 0, 20, 70);
    expect(botDecide(createBot('hard', 1, 1), state)).toMatchObject({ card: 'gnats', side: 1 });
  });

  it('answers a scattered swarm in its half with a tank', () => {
    const state = createState();
    state.energy[1] = CARDS.boulder.cost;
    spawnUnit(state, 'gnat', 0, 20, 70);
    spawnUnit(state, 'gnat', 0, 40, 75);
    // Two gnats far apart are not worth a spell, so the bot defends with a unit instead.
    expect(botDecide(createBot('hard', 1, 1), state)).toMatchObject({ card: 'boulder', side: 1 });
  });

  it('saves energy when it cannot afford any counter', () => {
    const state = createState();
    state.energy[1] = 1;
    spawnUnit(state, 'boulder', 0, 20, 70);
    expect(botDecide(createBot('hard', 1, 1), state)).toBeNull();
  });

  it('waits rather than attacking on a part-filled energy bar', () => {
    const state = createState();
    state.energy[1] = 6;
    expect(botDecide(createBot('hard', 1, 1), state)).toBeNull();
  });

  it('opens an attack with the tank once its energy bar is nearly full', () => {
    const state = createState();
    state.energy[1] = 8;
    const cmd = botDecide(createBot('hard', 1, 1), state);
    expect(cmd).toMatchObject({ card: 'boulder', side: 1 });
    expect(cmd!.y).toBeGreaterThan(FIELD.length / 2);
  });

  it('sends support in behind its own tank', () => {
    const state = createState();
    const tank = spawnUnit(state, 'boulder', 1, 20, 60);
    const cmd = botDecide(createBot('hard', 1, 1), state);
    expect(['slinger', 'gnats']).toContain(cmd?.card);
    expect(cmd!.y).toBeGreaterThan(tank.y);
  });

  it('thinks again only after its thinking interval', () => {
    const state = createState();
    const bot = createBot('hard', 1, 1);
    botDecide(bot, state);
    expect(bot.nextThink).toBeGreaterThan(state.tick);
    state.energy[1] = ENERGY.max;
    expect(botDecide(bot, state)).toBeNull();
  });
});

describe('easy bot decisions', () => {
  it('never casts the spell when there are no enemy units to aim at', () => {
    watchMatches('easy', 'easy', 5, (state, cmd) => {
      if (cmd.card === 'zap') expect(state.units.some((u) => u.side !== cmd.side)).toBe(true);
    });
  });

  it('eventually plays every card', () => {
    const seen = new Set<string>();
    watchMatches('easy', 'easy', 5, (_state, cmd) => seen.add(cmd.card));
    expect([...seen].sort()).toEqual(['boulder', 'gnats', 'slinger', 'zap']);
  });
});
