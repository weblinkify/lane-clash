import { FIELD, TOWER, type CardId } from '../../src/sim/balance';
import { step, type Command, type Side, type State } from '../../src/sim/sim';

export const MID_X = FIELD.width / 2;
export const TOWER_Y: Record<Side, number> = { 0: TOWER.inset, 1: FIELD.length - TOWER.inset };

export function run(state: State, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(state);
}

export function play(side: Side, card: CardId, x: number, y: number): Command {
  return { type: 'play', side, card, x, y };
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
