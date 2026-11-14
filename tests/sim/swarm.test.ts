import { describe, expect, it } from 'vitest';
import { CARDS, FIELD, UNITS } from '../../src/sim/balance';
import { applyCommand, createState } from '../../src/sim/sim';
import { distance, play } from './helpers';

const GNATS = CARDS.gnats;

describe('swarm card', () => {
  it('spawns the configured number of units', () => {
    const state = createState();
    applyCommand(state, play(0, 'gnats', 20, 30));
    expect(state.units).toHaveLength(GNATS.count);
  });

  it('spawns every unit at the placement point, within the configured spread', () => {
    const state = createState();
    applyCommand(state, play(0, 'gnats', 20, 30));
    for (const unit of state.units) {
      expect(distance(unit, { x: 20, y: 30 })).toBeLessThanOrEqual(GNATS.spread);
    }
  });

  it('spawns full-health units of the configured kind on the placing side', () => {
    const state = createState();
    applyCommand(state, play(1, 'gnats', 20, 70));
    for (const unit of state.units) {
      expect(unit).toMatchObject({ kind: GNATS.unit, side: 1, hp: UNITS[GNATS.unit].hp });
    }
  });

  it('gives every spawned unit its own id', () => {
    const state = createState();
    applyCommand(state, play(0, 'gnats', 20, 30));
    expect(new Set(state.units.map((u) => u.id)).size).toBe(GNATS.count);
  });

  it('keeps units on the field when placed in a corner', () => {
    const state = createState();
    applyCommand(state, play(0, 'gnats', 0, 0));
    for (const unit of state.units) {
      expect(unit.x).toBeGreaterThanOrEqual(0);
      expect(unit.x).toBeLessThanOrEqual(FIELD.width);
      expect(unit.y).toBeGreaterThanOrEqual(0);
    }
  });
});
