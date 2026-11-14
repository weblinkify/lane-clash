import { describe, expect, it } from 'vitest';
import { CARDS, TOWER, UNITS } from '../../src/sim/balance';
import { applyCommand, createState, secondsToTicks, spawnUnit, step } from '../../src/sim/sim';
import { MID_X, TOWER_Y, play, run } from './helpers';

const B = UNITS.boulder;
const ZAP = CARDS.zap;
/** y at which a side-0 boulder is exactly in reach of the enemy tower. */
const AT_ENEMY_TOWER = TOWER_Y[1] - TOWER.radius - B.range;

describe('unit attacks', () => {
  it('a hit removes exactly the attack value from an enemy unit', () => {
    const state = createState();
    spawnUnit(state, 'boulder', 0, MID_X, 40);
    const theirs = spawnUnit(state, 'boulder', 1, MID_X, 40 + B.range);
    step(state);
    expect(theirs.hp).toBe(B.hp - B.damage);
  });

  it('a hit removes exactly the attack value from the tower', () => {
    const state = createState();
    spawnUnit(state, 'boulder', 0, MID_X, AT_ENEMY_TOWER);
    step(state);
    expect(state.towers[1].hp).toBe(TOWER.hp - B.damage);
  });

  it('unit health never goes below 0', () => {
    const state = createState();
    spawnUnit(state, 'boulder', 0, MID_X, 40);
    const theirs = spawnUnit(state, 'gnat', 1, MID_X, 41);
    theirs.hp = 1;
    step(state);
    expect(theirs.hp).toBe(0);
  });

  it('tower health never goes below 0', () => {
    const state = createState();
    state.towers[1].hp = 1;
    spawnUnit(state, 'boulder', 0, MID_X, AT_ENEMY_TOWER);
    step(state);
    expect(state.towers[1].hp).toBe(0);
  });

  it('dead units are removed from the match', () => {
    const state = createState();
    const mine = spawnUnit(state, 'boulder', 0, MID_X, 40);
    const theirs = spawnUnit(state, 'gnat', 1, MID_X, 41);
    theirs.hp = B.damage;
    step(state);
    expect(state.units).toEqual([mine]);
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

  it('two units that kill each other on the same tick both die', () => {
    const state = createState();
    const mine = spawnUnit(state, 'gnat', 0, MID_X, 40);
    const theirs = spawnUnit(state, 'gnat', 1, MID_X, 41);
    mine.hp = theirs.hp = 1;
    step(state);
    expect(state.units).toEqual([]);
  });
});

describe('spell', () => {
  it('damages every enemy unit inside its radius', () => {
    const state = createState();
    const centre = spawnUnit(state, 'boulder', 1, 20, 60);
    const edge = spawnUnit(state, 'boulder', 1, 20 + ZAP.radius, 60);
    const diagonal = spawnUnit(state, 'boulder', 1, 20 - 6, 60 + 6);
    expect(applyCommand(state, play(0, 'zap', 20, 60))).toBe(true);
    for (const unit of [centre, edge, diagonal]) expect(unit.hp).toBe(B.hp - ZAP.damage);
  });

  it('damages nothing outside its radius', () => {
    const state = createState();
    const outside = spawnUnit(state, 'boulder', 1, 20 + ZAP.radius + 0.5, 60);
    applyCommand(state, play(0, 'zap', 20, 60));
    expect(outside.hp).toBe(B.hp);
  });

  it('damages no friendly units', () => {
    const state = createState();
    const friend = spawnUnit(state, 'gnat', 0, 20, 60);
    applyCommand(state, play(0, 'zap', 20, 60));
    expect(friend.hp).toBe(UNITS.gnat.hp);
    expect(state.units).toContain(friend);
  });

  it('removes the units it kills', () => {
    const state = createState();
    spawnUnit(state, 'gnat', 1, 20, 60);
    spawnUnit(state, 'gnat', 1, 21, 61);
    applyCommand(state, play(0, 'zap', 20, 60));
    expect(state.units).toEqual([]);
  });

  it('damages the enemy tower when it is in range', () => {
    const state = createState();
    applyCommand(state, play(0, 'zap', MID_X, TOWER_Y[1] - ZAP.radius));
    expect(state.towers[1].hp).toBe(TOWER.hp - ZAP.towerDamage);
  });

  it('does not damage the enemy tower when it is out of range', () => {
    const state = createState();
    applyCommand(state, play(0, 'zap', MID_X, TOWER_Y[1] - ZAP.radius - TOWER.radius - 1));
    expect(state.towers[1].hp).toBe(TOWER.hp);
  });

  it("never damages the caster's own tower", () => {
    const state = createState();
    applyCommand(state, play(0, 'zap', MID_X, TOWER_Y[0]));
    expect(state.towers[0].hp).toBe(TOWER.hp);
  });

  it('leaves an effect for the renderer that expires after a few ticks', () => {
    const state = createState();
    applyCommand(state, play(0, 'zap', 20, 60));
    expect(state.effects).toEqual([{ card: 'zap', side: 0, x: 20, y: 60, tick: 0 }]);
    run(state, 20);
    expect(state.effects).toEqual([]);
  });
});
