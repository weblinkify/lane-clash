import { describe, expect, it } from 'vitest';
import { CARDS, TOWER, UNITS } from '../../src/sim/balance';
import { MATCH_TICKS, applyCommand, createState, spawnUnit, step } from '../../src/sim/sim';
import { MID_X, TOWER_Y, play, run } from './helpers';

const B = UNITS.boulder;
const REACH = TOWER.radius + B.range;

describe('tower destroyed', () => {
  it('side 0 wins the moment the side 1 tower reaches 0', () => {
    const state = createState();
    state.towers[1].hp = B.damage;
    spawnUnit(state, 'boulder', 0, MID_X, TOWER_Y[1] - REACH);
    step(state);
    expect(state.winner).toBe(0);
    expect(state.tick).toBeLessThan(MATCH_TICKS);
  });

  it('side 1 wins the moment the side 0 tower reaches 0', () => {
    const state = createState();
    state.towers[0].hp = B.damage;
    spawnUnit(state, 'boulder', 1, MID_X, TOWER_Y[0] + REACH);
    step(state);
    expect(state.winner).toBe(1);
  });

  it('a spell that finishes the tower ends the match immediately', () => {
    const state = createState();
    state.towers[1].hp = CARDS.zap.towerDamage;
    applyCommand(state, play(0, 'zap', MID_X, TOWER_Y[1]));
    expect(state.winner).toBe(0);
  });

  it('is a draw when both towers fall on the same tick', () => {
    const state = createState();
    state.towers[0].hp = state.towers[1].hp = B.damage;
    spawnUnit(state, 'boulder', 0, MID_X, TOWER_Y[1] - REACH);
    spawnUnit(state, 'boulder', 1, MID_X, TOWER_Y[0] + REACH);
    step(state);
    expect(state.winner).toBe('draw');
  });
});

describe('time-out', () => {
  it('the match is still running one tick before the time limit', () => {
    const state = createState();
    run(state, MATCH_TICKS - 1);
    expect(state.winner).toBeNull();
  });

  it('side 0 wins at time-out with more tower health', () => {
    const state = createState();
    state.towers[1].hp = TOWER.hp - 1;
    run(state, MATCH_TICKS);
    expect(state.winner).toBe(0);
  });

  it('side 1 wins at time-out with more tower health', () => {
    const state = createState();
    state.towers[0].hp = TOWER.hp - 1;
    run(state, MATCH_TICKS);
    expect(state.winner).toBe(1);
  });

  it('equal tower health at time-out is a draw', () => {
    const state = createState();
    run(state, MATCH_TICKS);
    expect(state.winner).toBe('draw');
  });
});

describe('after the match ends', () => {
  it('no commands are accepted', () => {
    const state = createState();
    run(state, MATCH_TICKS);
    const after = structuredClone(state);
    expect(applyCommand(state, play(0, 'slinger', 10, 30))).toBe(false);
    expect(applyCommand(state, play(1, 'zap', 10, 30))).toBe(false);
    expect(state).toEqual(after);
  });

  it('stepping changes nothing, with or without commands', () => {
    const state = createState();
    state.towers[1].hp = B.damage;
    spawnUnit(state, 'boulder', 0, MID_X, TOWER_Y[1] - REACH);
    step(state);
    const after = structuredClone(state);
    step(state, [play(0, 'slinger', 10, 30)]);
    step(state);
    expect(state).toEqual(after);
  });
});
