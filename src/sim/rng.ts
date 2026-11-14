// Seeded random numbers (mulberry32). The generator's whole state is one integer kept in the
// object that owns it, so a match can be copied, compared and replayed.

export interface HasRng {
  rng: number;
}

export function seedRng(seed: number): number {
  return seed >>> 0;
}

/** Returns a number in [0, 1) and advances the owner's generator. */
export function nextRandom(owner: HasRng): number {
  owner.rng = (owner.rng + 0x6d2b79f5) >>> 0;
  let t = owner.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
