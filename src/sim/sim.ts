// Pure game rules. No DOM, no clocks, no Math.random: same seed and commands in, same state out.
import {
  CARDS,
  ENERGY,
  FIELD,
  MATCH_SECONDS,
  TICK_RATE,
  TOWER,
  UNITS,
  type Card,
  type CardId,
  type UnitKind,
  type UnitStats,
} from './balance';
import { nextRandom, seedRng } from './rng';

/** Side 0 ("left" in the balance table) owns the low-y end of the field, side 1 the high-y end. */
export type Side = 0 | 1;
export type Winner = Side | 'draw';

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

export interface Command {
  type: 'play';
  side: Side;
  card: CardId;
  x: number;
  y: number;
}

/** A spell that was just cast, kept for a few ticks so the renderer can draw it. */
export interface Effect {
  card: CardId;
  side: Side;
  x: number;
  y: number;
  tick: number;
}

export interface State {
  seed: number;
  rng: number;
  tick: number;
  nextId: number;
  units: Unit[];
  towers: [Tower, Tower];
  energy: [number, number];
  effects: Effect[];
  /** null while the match is running. */
  winner: Winner | null;
}

export const MATCH_TICKS = MATCH_SECONDS * TICK_RATE;
export const EFFECT_TICKS = 8;
const EPSILON = 1e-6;

export function enemyOf(side: Side): Side {
  return side === 0 ? 1 : 0;
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

export function createState(seed = 1): State {
  return {
    seed,
    rng: seedRng(seed),
    tick: 0,
    nextId: 1,
    units: [],
    towers: [
      { side: 0, x: FIELD.width / 2, y: TOWER.inset, hp: TOWER.hp },
      { side: 1, x: FIELD.width / 2, y: FIELD.length - TOWER.inset, hp: TOWER.hp },
    ],
    energy: [ENERGY.start, ENERGY.start],
    effects: [],
    winner: null,
  };
}

export function isOnField(x: number, y: number): boolean {
  return x >= 0 && x <= FIELD.width && y >= 0 && y <= FIELD.length;
}

export function isInOwnHalf(side: Side, x: number, y: number): boolean {
  if (!isOnField(x, y)) return false;
  return side === 0 ? y < FIELD.length / 2 : y > FIELD.length / 2;
}

/** Whether a command would be accepted right now. Units go in your own half, spells anywhere. */
export function canApply(state: State, cmd: Command): boolean {
  if (state.winner !== null) return false;
  const card: Card = CARDS[cmd.card];
  if (state.energy[cmd.side] < card.cost) return false;
  return card.type === 'unit' ? isInOwnHalf(cmd.side, cmd.x, cmd.y) : isOnField(cmd.x, cmd.y);
}

/** Applies one command. Returns false, changing nothing, if it is not allowed. */
export function applyCommand(state: State, cmd: Command): boolean {
  if (!canApply(state, cmd)) return false;
  const card: Card = CARDS[cmd.card];
  state.energy[cmd.side] -= card.cost;

  if (card.type === 'unit') {
    for (let i = 0; i < card.count; i++) {
      let { x, y } = cmd;
      if (card.spread > 0) {
        const angle = nextRandom(state) * Math.PI * 2;
        const distance = nextRandom(state) * card.spread;
        x = Math.min(FIELD.width, Math.max(0, x + Math.cos(angle) * distance));
        y = Math.min(FIELD.length, Math.max(0, y + Math.sin(angle) * distance));
      }
      spawnUnit(state, card.unit, cmd.side, x, y);
    }
    return true;
  }

  for (const unit of state.units) {
    if (unit.side === cmd.side) continue;
    if (Math.hypot(unit.x - cmd.x, unit.y - cmd.y) <= card.radius + EPSILON) {
      unit.hp = Math.max(0, unit.hp - card.damage);
    }
  }
  const tower = state.towers[enemyOf(cmd.side)];
  if (Math.hypot(tower.x - cmd.x, tower.y - cmd.y) <= card.radius + TOWER.radius + EPSILON) {
    tower.hp = Math.max(0, tower.hp - card.towerDamage);
  }
  state.effects.push({ card: cmd.card, side: cmd.side, x: cmd.x, y: cmd.y, tick: state.tick });
  removeDead(state);
  checkTowers(state);
  return true;
}

export function spawnUnit(state: State, kind: UnitKind, side: Side, x: number, y: number): Unit {
  const unit: Unit = { id: state.nextId++, kind, side, x, y, hp: UNITS[kind].hp, cooldown: 0 };
  state.units.push(unit);
  return unit;
}

/** The nearest enemy unit within sight, otherwise the enemy tower. Never an ally. */
export function chooseTarget(state: State, unit: Unit): Unit | Tower {
  let best: Unit | null = null;
  let bestDist = UNITS[unit.kind].sight + EPSILON;
  for (const other of state.units) {
    if (other.side === unit.side) continue;
    const d = Math.hypot(other.x - unit.x, other.y - unit.y);
    if (d < bestDist) {
      best = other;
      bestDist = d;
    }
  }
  return best ?? state.towers[enemyOf(unit.side)];
}

function removeDead(state: State): void {
  state.units = state.units.filter((u) => u.hp > 0);
}

function checkTowers(state: State): void {
  const [t0, t1] = state.towers;
  if (t0.hp === 0 && t1.hp === 0) state.winner = 'draw';
  else if (t1.hp === 0) state.winner = 0;
  else if (t0.hp === 0) state.winner = 1;
}

/** Advances the match by one tick, applying this tick's commands first. */
export function step(state: State, commands: readonly Command[] = []): void {
  if (state.winner !== null) return;

  for (const cmd of commands) applyCommand(state, cmd);
  if (state.winner !== null) return;

  for (const side of [0, 1] as const) {
    state.energy[side] = Math.min(ENERGY.max, state.energy[side] + ENERGY.perSecond / TICK_RATE);
  }

  // Everyone chooses and acts on the same snapshot of health; damage lands together afterwards,
  // so neither side gains an edge from update order.
  const hits: { target: Unit | Tower; damage: number }[] = [];
  for (const unit of state.units) {
    const stats: UnitStats = UNITS[unit.kind];
    if (unit.cooldown > 0) unit.cooldown--;

    const target = chooseTarget(state, unit);
    const reach = stats.range + ('kind' in target ? 0 : TOWER.radius);
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
  removeDead(state);
  state.effects = state.effects.filter((e) => state.tick - e.tick < EFFECT_TICKS);
  checkTowers(state);

  state.tick++;
  if (state.winner === null && state.tick >= MATCH_TICKS) {
    const [t0, t1] = state.towers;
    state.winner = t0.hp > t1.hp ? 0 : t1.hp > t0.hp ? 1 : 'draw';
  }
}
