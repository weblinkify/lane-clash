// Draws a State. Reads only; never changes the simulation.
import { CARDS, FIELD, TICK_RATE, TOWER, UNITS, type CardId, type UnitKind } from '../sim/balance';
import { EFFECT_TICKS, type Side, type State } from '../sim/sim';

const SIDE_COLOUR: Record<Side, string> = { 0: '#3d8bfd', 1: '#f25c54' };
/** Drawn radius of each unit, in field units. Looks only; the rules treat units as points. */
const UNIT_RADIUS: Record<UnitKind, number> = { boulder: 3.2, slinger: 2.4, gnat: 1.5 };

export interface View {
  /** CSS pixels per field unit. */
  scale: number;
  /** CSS pixel position of field (0, 0); side 0 is at the bottom of the screen. */
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Sizes the canvas backing store for the device pixel ratio and fits the field inside it. */
export function fitCanvas(canvas: HTMLCanvasElement): View {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  // Above 2x the extra pixels cost frame rate on mid-range phones and are not visible here.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const scale = Math.min(width / FIELD.width, height / FIELD.length);
  return {
    scale,
    originX: (width - FIELD.width * scale) / 2,
    originY: (height + FIELD.length * scale) / 2,
    width,
    height,
  };
}

export function toScreen(view: View, x: number, y: number): { sx: number; sy: number } {
  return { sx: view.originX + x * view.scale, sy: view.originY - y * view.scale };
}

export function toField(view: View, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - view.originX) / view.scale, y: (view.originY - sy) / view.scale };
}

function healthBar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  width: number,
  fraction: number,
  colour: string,
): void {
  const h = Math.max(3, width * 0.12);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(cx - width / 2, top, width, h);
  ctx.fillStyle = colour;
  ctx.fillRect(cx - width / 2, top, width * Math.max(0, Math.min(1, fraction)), h);
}

export type Positions = ReadonlyMap<number, { x: number; y: number }>;

export interface Frame {
  /** Unit positions one tick ago, for smooth motion between 20 Hz ticks. */
  previous: Positions;
  /** How far we are from the previous tick (0) to the current one (1). */
  alpha: number;
  /** The card waiting to be placed, if any; its legal area is highlighted. */
  selected: CardId | null;
  hint: string;
}

export function render(ctx: CanvasRenderingContext2D, view: View, state: State, frame: Frame): void {
  const s = view.scale;
  ctx.setTransform(ctx.canvas.width / view.width, 0, 0, ctx.canvas.height / view.height, 0, 0);
  ctx.fillStyle = '#1b2a41';
  ctx.fillRect(0, 0, view.width, view.height);

  // Field: enemy half on top, my half on the bottom.
  const topLeft = toScreen(view, 0, FIELD.length);
  const fieldW = FIELD.width * s;
  const fieldH = FIELD.length * s;
  ctx.fillStyle = '#7cc66b';
  ctx.fillRect(topLeft.sx, topLeft.sy, fieldW, fieldH);
  ctx.fillStyle = '#8ed47c';
  ctx.fillRect(topLeft.sx, topLeft.sy + fieldH / 2, fieldW, fieldH / 2);
  if (frame.selected && CARDS[frame.selected].type === 'unit') {
    // Units may only be placed in my half: dim the rest.
    ctx.fillStyle = 'rgba(13,23,38,0.35)';
    ctx.fillRect(topLeft.sx, topLeft.sy, fieldW, fieldH / 2);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(topLeft.sx, topLeft.sy + fieldH / 2);
  ctx.lineTo(topLeft.sx + fieldW, topLeft.sy + fieldH / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const tower of state.towers) {
    const { sx, sy } = toScreen(view, tower.x, tower.y);
    const r = TOWER.radius * s;
    ctx.fillStyle = SIDE_COLOUR[tower.side];
    ctx.beginPath();
    ctx.roundRect(sx - r, sy - r, r * 2, r * 2, r * 0.3);
    ctx.fill();
    ctx.font = `${r * 1.3}px system-ui, sans-serif`;
    ctx.fillText(tower.hp > 0 ? '🏰' : '💥', sx, sy);
  }

  for (const unit of state.units) {
    const stats = UNITS[unit.kind];
    const before = frame.previous.get(unit.id) ?? unit;
    const x = before.x + (unit.x - before.x) * frame.alpha;
    const y = before.y + (unit.y - before.y) * frame.alpha;
    const { sx, sy } = toScreen(view, x, y);
    // A unit that has just attacked swells for a moment.
    const sinceAttack = stats.attackInterval * TICK_RATE - unit.cooldown;
    const r = UNIT_RADIUS[unit.kind] * s * (sinceAttack < 3 ? 1.25 : 1);
    ctx.fillStyle = SIDE_COLOUR[unit.side];
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${r * 1.3}px system-ui, sans-serif`;
    ctx.fillText(stats.emoji, sx, sy);
    if (unit.hp < stats.hp) healthBar(ctx, sx, sy - r - 6, Math.max(r * 2, 14), unit.hp / stats.hp, '#fff');
  }

  // Tower health is drawn over units so it stays readable in a fight.
  for (const tower of state.towers) {
    const { sx, sy } = toScreen(view, tower.x, tower.y);
    const r = TOWER.radius * s;
    const labelY = tower.side === 0 ? sy + r + s * 2 : sy - r - s * 2;
    const barTop = tower.side === 0 ? sy - r - 8 : sy + r + 4;
    healthBar(ctx, sx, barTop, r * 3, tower.hp / TOWER.hp, SIDE_COLOUR[tower.side]);
    ctx.font = `800 ${Math.max(11, s * 2.6)}px system-ui, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(13,23,38,0.8)';
    ctx.strokeText(String(tower.hp), sx, labelY);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(tower.hp), sx, labelY);
  }

  for (const effect of state.effects) {
    const card = CARDS[effect.card];
    if (card.type !== 'spell') continue;
    const age = (state.tick - effect.tick + frame.alpha) / EFFECT_TICKS;
    if (age >= 1) continue;
    const { sx, sy } = toScreen(view, effect.x, effect.y);
    const r = card.radius * s;
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = 'rgba(255, 221, 87, 0.45)';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.font = `${r * (0.7 + age * 0.5)}px system-ui, sans-serif`;
    ctx.fillText(card.emoji, sx, sy);
    ctx.globalAlpha = 1;
  }

  if (frame.hint) {
    ctx.font = `700 ${Math.max(13, s * 3)}px system-ui, sans-serif`;
    const { sx, sy } = toScreen(view, FIELD.width / 2, FIELD.length * 0.3);
    const w = ctx.measureText(frame.hint).width + 24;
    ctx.fillStyle = 'rgba(13,23,38,0.6)';
    ctx.beginPath();
    ctx.roundRect(sx - w / 2, sy - s * 3.2, w, s * 6.4, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(frame.hint, sx, sy);
  }
}
