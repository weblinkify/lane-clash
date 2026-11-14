import { describe, expect, it } from 'vitest';
import { TICK_RATE, TOWER, UNITS } from '../../src/sim/balance';
import { chooseTarget, createState, spawnUnit, step } from '../../src/sim/sim';
import { MID_X, TOWER_Y, distance, run } from './helpers';

const B = UNITS.boulder;
const S = UNITS.slinger;

describe('choosing a target', () => {
  it('targets the nearest enemy in sight', () => {
    const state = createState();
    const me = spawnUnit(state, 'slinger', 0, MID_X, 40);
    spawnUnit(state, 'boulder', 1, MID_X, 55);
    const near = spawnUnit(state, 'boulder', 1, MID_X + 5, 45);
    expect(chooseTarget(state, me)).toBe(near);
  });

  it('targets the enemy tower when no enemy is in sight', () => {
    const state = createState();
    const me = spawnUnit(state, 'boulder', 0, MID_X, 10);
    spawnUnit(state, 'boulder', 1, MID_X, 10 + B.sight + 5);
    expect(chooseTarget(state, me)).toBe(state.towers[1]);
  });

  it('never targets an ally, even one standing right next to it', () => {
    const state = createState();
    const me = spawnUnit(state, 'boulder', 0, MID_X, 40);
    spawnUnit(state, 'boulder', 0, MID_X + 1, 40);
    expect(chooseTarget(state, me)).toBe(state.towers[1]);
  });

  it('allies never damage each other', () => {
    const state = createState();
    const a = spawnUnit(state, 'gnat', 0, MID_X, 40);
    const b = spawnUnit(state, 'gnat', 0, MID_X + 1, 40);
    run(state, 60);
    expect([a.hp, b.hp]).toEqual([UNITS.gnat.hp, UNITS.gnat.hp]);
  });

  it('retargets to the next nearest enemy when its target dies', () => {
    const state = createState();
    const me = spawnUnit(state, 'slinger', 0, MID_X, 40);
    const first = spawnUnit(state, 'boulder', 1, MID_X, 50);
    const second = spawnUnit(state, 'boulder', 1, MID_X, 58);
    first.hp = S.damage;
    expect(chooseTarget(state, me)).toBe(first);
    step(state);
    expect(state.units).not.toContain(first);
    expect(chooseTarget(state, me)).toBe(second);
  });
});

describe('moving', () => {
  it('walks straight toward the enemy tower when nothing is in sight', () => {
    const state = createState();
    const me = spawnUnit(state, 'boulder', 0, MID_X, 10);
    run(state, TICK_RATE);
    expect(me.x).toBeCloseTo(MID_X);
    expect(me.y).toBeCloseTo(10 + B.speed);
  });

  it('side 1 units walk the other way, toward the side 0 tower', () => {
    const state = createState();
    const me = spawnUnit(state, 'boulder', 1, MID_X, 90);
    run(state, TICK_RATE);
    expect(me.y).toBeCloseTo(90 - B.speed);
  });

  it('a ranged unit stops at its range from the tower', () => {
    const state = createState();
    const me = spawnUnit(state, 'slinger', 0, MID_X, 10);
    run(state, 400);
    expect(me.y).toBeCloseTo(TOWER_Y[1] - TOWER.radius - S.range);
  });

  it('a ranged unit attacks from its range without stepping closer', () => {
    const state = createState();
    const me = spawnUnit(state, 'slinger', 0, MID_X, 40);
    const theirs = spawnUnit(state, 'boulder', 1, MID_X, 40 + S.range);
    step(state);
    expect(me.y).toBe(40);
    expect(theirs.hp).toBe(B.hp - S.damage);
  });

  it('a melee unit out of reach deals no damage and closes the distance', () => {
    const state = createState();
    const me = spawnUnit(state, 'boulder', 0, MID_X, 40);
    const theirs = spawnUnit(state, 'boulder', 1, MID_X, 50);
    const before = distance(me, theirs);
    step(state);
    expect(theirs.hp).toBe(B.hp);
    expect(distance(me, theirs)).toBeCloseTo(before - (2 * B.speed) / TICK_RATE);
  });

  it('a melee unit starts hitting once it has closed to its reach', () => {
    const state = createState();
    const me = spawnUnit(state, 'boulder', 0, MID_X, 40);
    const theirs = spawnUnit(state, 'boulder', 1, MID_X, 50);
    while (theirs.hp === B.hp) step(state);
    expect(distance(me, theirs)).toBeLessThanOrEqual(B.range + 1e-6);
    expect(theirs.hp).toBe(B.hp - B.damage);
  });

  it('a melee unit stops at the tower edge and does not walk through it', () => {
    const state = createState();
    const me = spawnUnit(state, 'boulder', 0, MID_X, 10);
    run(state, 400);
    expect(me.y).toBeCloseTo(TOWER_Y[1] - TOWER.radius - B.range);
  });
});
