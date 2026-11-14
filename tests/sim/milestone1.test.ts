import { describe, expect, it } from 'vitest';
import { FIELD, TOWER, UNITS } from '../../src/sim/balance';
import { applyCommand, createState, secondsToTicks, spawnUnit, step, type State } from '../../src/sim/sim';

const MID_X = FIELD.width / 2;
const B = UNITS.boulder;
/** y at which a side-0 melee unit is exactly in reach of the enemy tower. */
const AT_ENEMY_TOWER = FIELD.length - TOWER.inset - TOWER.radius - B.range;

function run(state: State, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(state);
}

describe('movement', () => {
  it('walks toward the enemy tower when no enemy is in sight', () => {
    const state = createState();
    const unit = spawnUnit(state, 'boulder', 0, MID_X, 10);
    run(state, 20);
    expect(unit.x).toBeCloseTo(MID_X);
    expect(unit.y).toBeCloseTo(10 + B.speed);
  });

  it('a melee unit stops at the tower edge and does not walk through it', () => {
    const state = createState();
    const unit = spawnUnit(state, 'boulder', 0, MID_X, 10);
    run(state, 400);
    expect(unit.y).toBeCloseTo(AT_ENEMY_TOWER);
  });
});

describe('damage', () => {
  it('a hit removes exactly the attack value from the tower', () => {
    const state = createState();
    spawnUnit(state, 'boulder', 0, MID_X, AT_ENEMY_TOWER);
    step(state);
    expect(state.towers[1].hp).toBe(TOWER.hp - B.damage);
  });

  it('does not attack again until the attack cooldown has passed', () => {
    const state = createState();
    spawnUnit(state, 'boulder', 0, MID_X, AT_ENEMY_TOWER);
    const interval = secondsToTicks(B.attackInterval);
    run(state, interval);
    expect(state.towers[1].hp).toBe(TOWER.hp - B.damage);
    step(state);
    expect(state.towers[1].hp).toBe(TOWER.hp - 2 * B.damage);
  });

  it('tower health never goes below 0', () => {
    const state = createState();
    state.towers[1].hp = 1;
    spawnUnit(state, 'boulder', 0, MID_X, AT_ENEMY_TOWER);
    step(state);
    expect(state.towers[1].hp).toBe(0);
  });

  it('a unit attacks an enemy unit in reach instead of walking on, and dead units are removed', () => {
    const state = createState();
    const mine = spawnUnit(state, 'boulder', 0, MID_X, 40);
    const theirs = spawnUnit(state, 'boulder', 1, MID_X, 40 + B.range);
    theirs.hp = B.damage;
    step(state);
    expect(mine.y).toBe(40);
    expect(mine.hp).toBe(B.hp - B.damage);
    expect(state.units).toEqual([mine]);
  });
});

describe('placement', () => {
  it('placing in my own half spawns the unit at that point', () => {
    const state = createState();
    expect(applyCommand(state, { type: 'place', side: 0, card: 'boulder', x: 7, y: 30 })).toBe(true);
    expect(state.units).toHaveLength(1);
    expect(state.units[0]).toMatchObject({ kind: 'boulder', side: 0, x: 7, y: 30, hp: B.hp });
  });

  it.each([
    ['the enemy half', 7, 60],
    ['off the side of the field', -1, 30],
    ['behind my end of the field', 7, -1],
  ])('placement in %s is rejected and changes nothing', (_where, x, y) => {
    const state = createState();
    const before = structuredClone(state);
    expect(applyCommand(state, { type: 'place', side: 0, card: 'boulder', x, y })).toBe(false);
    expect(state).toEqual(before);
  });

  it('side 1 may place only in the far half', () => {
    const state = createState();
    expect(applyCommand(state, { type: 'place', side: 1, card: 'boulder', x: 7, y: 30 })).toBe(false);
    expect(applyCommand(state, { type: 'place', side: 1, card: 'boulder', x: 7, y: 70 })).toBe(true);
  });
});

describe('win condition', () => {
  it('a tower at 0 ends the match with the attacker as winner, and nothing changes afterwards', () => {
    const state = createState();
    state.towers[1].hp = B.damage;
    spawnUnit(state, 'boulder', 0, MID_X, AT_ENEMY_TOWER);
    step(state);
    expect(state.winner).toBe(0);
    const after = structuredClone(state);
    step(state, [{ type: 'place', side: 0, card: 'boulder', x: 7, y: 30 }]);
    expect(state).toEqual(after);
  });

  it('side 1 wins when side 0 loses its tower', () => {
    const state = createState();
    state.towers[0].hp = B.damage;
    spawnUnit(state, 'boulder', 1, MID_X, TOWER.inset + TOWER.radius + B.range);
    step(state);
    expect(state.winner).toBe(1);
  });
});
