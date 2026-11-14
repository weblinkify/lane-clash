import { describe, expect, it } from 'vitest';
import { CARDS, ENERGY, TICK_RATE } from '../../src/sim/balance';
import { applyCommand, createState, step } from '../../src/sim/sim';
import { play, run } from './helpers';

describe('energy', () => {
  it('starts at the configured value for both sides', () => {
    expect(createState().energy).toEqual([ENERGY.start, ENERGY.start]);
  });

  it('recharges at the configured rate', () => {
    const state = createState();
    run(state, TICK_RATE);
    expect(state.energy[0]).toBeCloseTo(ENERGY.start + ENERGY.perSecond);
    expect(state.energy[1]).toBeCloseTo(ENERGY.start + ENERGY.perSecond);
  });

  it('caps at the maximum', () => {
    const state = createState();
    run(state, TICK_RATE * 30);
    expect(state.energy).toEqual([ENERGY.max, ENERGY.max]);
  });

  it('placing a card deducts exactly its cost, from that side only', () => {
    const state = createState();
    expect(applyCommand(state, play(0, 'slinger', 10, 30))).toBe(true);
    expect(state.energy).toEqual([ENERGY.start - CARDS.slinger.cost, ENERGY.start]);
  });

  it('a card that costs more than current energy is rejected and changes nothing', () => {
    const state = createState();
    state.energy[0] = CARDS.boulder.cost - 0.01;
    const before = structuredClone(state);
    expect(applyCommand(state, play(0, 'boulder', 10, 30))).toBe(false);
    expect(state).toEqual(before);
  });

  it('a rejected command passed to step spawns nothing and costs nothing', () => {
    const state = createState();
    state.energy[0] = 0;
    step(state, [play(0, 'gnats', 10, 30)]);
    expect(state.units).toEqual([]);
    expect(state.energy[0]).toBeCloseTo(ENERGY.perSecond / TICK_RATE);
  });
});

describe('placement', () => {
  it('a unit card placed in my own half spawns at that point', () => {
    const state = createState();
    expect(applyCommand(state, play(0, 'boulder', 7, 30))).toBe(true);
    expect(state.units).toHaveLength(1);
    expect(state.units[0]).toMatchObject({ kind: 'boulder', side: 0, x: 7, y: 30 });
  });

  it.each([
    ['the enemy half', 7, 60],
    ['exactly on the middle line', 7, 50],
    ['off the side of the field', -1, 30],
    ['behind my end of the field', 7, -1],
  ])('a unit card placed in %s is rejected and changes nothing', (_where, x, y) => {
    const state = createState();
    const before = structuredClone(state);
    expect(applyCommand(state, play(0, 'boulder', x, y))).toBe(false);
    expect(state).toEqual(before);
  });

  it('side 1 may place units only in the far half', () => {
    const state = createState();
    expect(applyCommand(state, play(1, 'slinger', 7, 30))).toBe(false);
    expect(applyCommand(state, play(1, 'slinger', 7, 70))).toBe(true);
  });

  it('a spell may be placed in the enemy half', () => {
    const state = createState();
    expect(applyCommand(state, play(0, 'zap', 7, 80))).toBe(true);
    expect(state.energy[0]).toBe(ENERGY.start - CARDS.zap.cost);
  });

  it('a spell placed off the field is rejected and changes nothing', () => {
    const state = createState();
    const before = structuredClone(state);
    expect(applyCommand(state, play(0, 'zap', 7, 101))).toBe(false);
    expect(state).toEqual(before);
  });
});
