// Every tunable number in the game lives here.
// Distances are in field units, times in seconds, speeds in field units per second.

export const TICK_RATE = 20;

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
  boulder: {
    emoji: '🪨',
    hp: 600,
    damage: 45,
    attackInterval: 1.5,
    range: 2,
    sight: 20,
    speed: 6,
  },
} as const satisfies Record<string, UnitStats>;

export type UnitKind = keyof typeof UNITS;
