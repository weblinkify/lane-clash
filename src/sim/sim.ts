// Pure game rules. No DOM, no clocks, no Math.random: same commands in, same state out.
import { FIELD, TICK_RATE, TOWER, UNITS, type UnitKind, type UnitStats } from './balance';

/** Side 0 owns the low-y end of the field, side 1 the high-y end. */
export type Side = 0 | 1;

export interface Unit {
  id: number;
  kind: UnitKind;
  side: Side;
  x: number;
  y: number;
  hp: number;
  /** Ticks until this unit may attack again. */
  cooldown: number;
}

export interface Tower {
  side: Side;
  x: number;
  y: number;
  hp: number;
}

export interface PlaceCommand {
  type: 'place';
  side: Side;
  card: UnitKind;
  x: number;
  y: number;
}

export type Command = PlaceCommand;

export interface State {
  tick: number;
  nextId: number;
  units: Unit[];
  towers: [Tower, Tower];
  winner: Side | null;
}

const EPSILON = 1e-6;

export function enemyOf(side: Side): Side {
  return side === 0 ? 1 : 0;
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

export function createState(): State {
  return {
    tick: 0,
    nextId: 1,
    units: [],
    towers: [
      { side: 0, x: FIELD.width / 2, y: TOWER.inset, hp: TOWER.hp },
      { side: 1, x: FIELD.width / 2, y: FIELD.length - TOWER.inset, hp: TOWER.hp },
    ],
    winner: null,
  };
}

export function isInOwnHalf(side: Side, x: number, y: number): boolean {
  if (!(x >= 0 && x <= FIELD.width)) return false;
  const half = FIELD.length / 2;
  return side === 0 ? y >= 0 && y < half : y > half && y <= FIELD.length;
}

/** Applies one command. Returns false, changing nothing, if it is not allowed. */
export function applyCommand(state: State, cmd: Command): boolean {
  if (state.winner !== null) return false;
  if (!isInOwnHalf(cmd.side, cmd.x, cmd.y)) return false;
  spawnUnit(state, cmd.card, cmd.side, cmd.x, cmd.y);
  return true;
}

export function spawnUnit(state: State, kind: UnitKind, side: Side, x: number, y: number): Unit {
  const unit: Unit = { id: state.nextId++, kind, side, x, y, hp: UNITS[kind].hp, cooldown: 0 };
  state.units.push(unit);
  return unit;
}

function nearestEnemyInSight(state: State, unit: Unit, sight: number): Unit | null {
  let best: Unit | null = null;
  let bestDist = sight + EPSILON;
  for (const other of state.units) {
    if (other.side === unit.side) continue;
    const d = Math.hypot(other.x - unit.x, other.y - unit.y);
    if (d < bestDist) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

/** Advances the match by one tick, applying this tick's commands first. */
export function step(state: State, commands: readonly Command[] = []): void {
  if (state.winner !== null) return;

  for (const cmd of commands) applyCommand(state, cmd);

  // Everyone chooses and acts on the same snapshot of health; damage lands together afterwards,
  // so neither side gains an edge from update order.
  const hits: { target: Unit | Tower; damage: number }[] = [];
  for (const unit of state.units) {
    const stats: UnitStats = UNITS[unit.kind];
    if (unit.cooldown > 0) unit.cooldown--;

    const enemy = nearestEnemyInSight(state, unit, stats.sight);
    const target = enemy ?? state.towers[enemyOf(unit.side)];
    const reach = stats.range + (enemy ? 0 : TOWER.radius);
    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= reach + EPSILON) {
      if (unit.cooldown === 0) {
        hits.push({ target, damage: stats.damage });
        unit.cooldown = secondsToTicks(stats.attackInterval);
      }
    } else {
      const stride = Math.min(stats.speed / TICK_RATE, dist - reach);
      unit.x += (dx / dist) * stride;
      unit.y += (dy / dist) * stride;
    }
  }

  for (const hit of hits) hit.target.hp = Math.max(0, hit.target.hp - hit.damage);
  state.units = state.units.filter((u) => u.hp > 0);

  const [t0, t1] = state.towers;
  if (t1.hp === 0 && t0.hp > 0) state.winner = 0;
  else if (t0.hp === 0 && t1.hp > 0) state.winner = 1;

  state.tick++;
}
