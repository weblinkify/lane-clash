import { describe, expect, it } from 'vitest';
import { TOWER } from '../../src/sim/balance';
import { nextRandom, seedRng } from '../../src/sim/rng';
import { MATCH_TICKS, createState, step, type Command, type State } from '../../src/sim/sim';
import { play } from './helpers';

/** A fixed script of commands for both sides, keyed by tick. */
const SCRIPT = new Map<number, Command[]>([
  [0, [play(0, 'gnats', 20, 40), play(1, 'slinger', 30, 70)]],
  [60, [play(0, 'slinger', 10, 30), play(1, 'gnats', 25, 60)]],
  [200, [play(0, 'boulder', 25, 45), play(1, 'boulder', 25, 55)]],
  [320, [play(0, 'zap', 25, 55), play(1, 'gnats', 40, 65)]],
  [500, [play(0, 'gnats', 5, 49), play(1, 'zap', 10, 45)]],
  [800, [play(0, 'boulder', 40, 20), play(1, 'slinger', 12, 80)]],
]);

function runScript(seed: number): State {
  const state = createState(seed);
  for (let tick = 0; tick < MATCH_TICKS && state.winner === null; tick++) {
    step(state, SCRIPT.get(tick) ?? []);
  }
  return state;
}

describe('determinism', () => {
  it('two runs with the same seed and commands produce deeply equal final states', () => {
    expect(runScript(1234)).toEqual(runScript(1234));
  });

  it('the scripted match exercises real combat, so the comparison is meaningful', () => {
    const state = runScript(1234);
    expect(state.tick).toBeGreaterThan(300);
    expect(state.towers[0].hp + state.towers[1].hp).toBeLessThan(2 * TOWER.hp);
  });

  it('different seeds diverge', () => {
    const a = runScript(1);
    const b = runScript(2);
    expect({ ...a, seed: 0 }).not.toEqual({ ...b, seed: 0 });
  });
});

describe('seeded random numbers', () => {
  it('the same seed gives the same sequence', () => {
    const a = { rng: seedRng(42) };
    const b = { rng: seedRng(42) };
    expect([nextRandom(a), nextRandom(a), nextRandom(a)]).toEqual([nextRandom(b), nextRandom(b), nextRandom(b)]);
  });

  it('every value is in [0, 1)', () => {
    const owner = { rng: seedRng(7) };
    for (let i = 0; i < 1000; i++) {
      const value = nextRandom(owner);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
