// Every tunable number in the game lives here.
// Distances are in field units, times in seconds, speeds in field units per second.
// After changing anything, run `npm run sim` and read the table.

export const TICK_RATE = 20;
export const MATCH_SECONDS = 120;

export const FIELD = {
  width: 50,
  length: 100,
} as const;

export const TOWER = {
  hp: 1000,
  /** Units hit the tower from its edge, not its centre. */
  radius: 4,
  /** Distance from the tower centre to its own end of the field. */
  inset: 8,
} as const;

export const ENERGY = {
  start: 5,
  max: 10,
  perSecond: 1 / 1.4,
} as const;

export interface UnitStats {
  emoji: string;
  hp: number;
  damage: number;
  /** Seconds between attacks. */
  attackInterval: number;
  /** Attack reach. */
  range: number;
  /** How far the unit notices enemies; beyond this it walks at the tower. */
  sight: number;
  speed: number;
}

export const UNITS = {
  boulder: { emoji: '🪨', hp: 600, damage: 45, attackInterval: 1.5, range: 2, sight: 20, speed: 6 },
  slinger: { emoji: '🎯', hp: 140, damage: 35, attackInterval: 1.0, range: 22, sight: 26, speed: 9 },
  gnat: { emoji: '🐝', hp: 45, damage: 14, attackInterval: 0.6, range: 2, sight: 20, speed: 14 },
} as const satisfies Record<string, UnitStats>;

export type UnitKind = keyof typeof UNITS;

export interface UnitCard {
  type: 'unit';
  name: string;
  emoji: string;
  cost: number;
  unit: UnitKind;
  /** How many units one card spawns. */
  count: number;
  /** Units of a multi-unit card land within this distance of the placement point. */
  spread: number;
}

export interface SpellCard {
  type: 'spell';
  name: string;
  emoji: string;
  cost: number;
  radius: number;
  /** Damage to every enemy unit in the radius. */
  damage: number;
  /** Damage to the enemy tower when it is in the radius (lower, or spells alone would win). */
  towerDamage: number;
}

export type Card = UnitCard | SpellCard;

export const CARDS = {
  boulder: { type: 'unit', name: 'Boulder', emoji: '🪨', cost: 5, unit: 'boulder', count: 1, spread: 0 },
  slinger: { type: 'unit', name: 'Slinger', emoji: '🎯', cost: 3, unit: 'slinger', count: 1, spread: 0 },
  gnats: { type: 'unit', name: 'Gnats', emoji: '🐝', cost: 3, unit: 'gnat', count: 4, spread: 3 },
  zap: { type: 'spell', name: 'Zap', emoji: '⚡', cost: 4, radius: 10, damage: 160, towerDamage: 50 },
} as const satisfies Record<string, Card>;

export type CardId = keyof typeof CARDS;
export const CARD_IDS = Object.keys(CARDS) as CardId[];
