import { describe, expect, it } from 'vitest';
import { CARDS, CARD_IDS, ENERGY, MATCH_SECONDS, TOWER, UNITS, type Card, type UnitStats } from '../../src/sim/balance';

const units = Object.entries(UNITS) as [string, UnitStats][];
const cards = CARD_IDS.map((id) => [id, CARDS[id] as Card] as const);

describe('balance data', () => {
  it.each(units)('unit %s has positive health, damage, range, speed and attack interval', (_name, u) => {
    for (const value of [u.hp, u.damage, u.range, u.speed, u.attackInterval]) expect(value).toBeGreaterThan(0);
  });

  it.each(units)('unit %s can see at least as far as it can hit', (_name, u) => {
    expect(u.sight).toBeGreaterThanOrEqual(u.range);
  });

  it.each(cards)('card %s has a positive cost that fits within max energy', (_id, card) => {
    expect(card.cost).toBeGreaterThan(0);
    expect(card.cost).toBeLessThanOrEqual(ENERGY.max);
  });

  it.each(cards)('card %s spawns at least one unit, or is a spell with positive damage and radius', (_id, card) => {
    if (card.type === 'unit') {
      expect(card.count).toBeGreaterThanOrEqual(1);
      expect(card.spread).toBeGreaterThanOrEqual(0);
    } else {
      for (const value of [card.damage, card.towerDamage, card.radius]) expect(value).toBeGreaterThan(0);
    }
  });

  it('there are exactly four cards: tank, ranged, swarm and spell', () => {
    expect(CARD_IDS).toEqual(['boulder', 'slinger', 'gnats', 'zap']);
  });

  it('at least one card is affordable with starting energy', () => {
    expect(Math.min(...cards.map(([, c]) => c.cost))).toBeLessThanOrEqual(ENERGY.start);
  });

  it('energy, tower health and match length are positive', () => {
    for (const value of [ENERGY.start, ENERGY.max, ENERGY.perSecond, TOWER.hp, MATCH_SECONDS]) {
      expect(value).toBeGreaterThan(0);
    }
    expect(ENERGY.start).toBeLessThanOrEqual(ENERGY.max);
  });
});
