// Draws a State. Reads only; never changes the simulation.
import { FIELD, TOWER, UNITS } from '../sim/balance';
import type { Side, State } from '../sim/sim';

const SIDE_COLOUR: Record<Side, string> = { 0: '#3d8bfd', 1: '#f25c54' };

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
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
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
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(cx - width / 2, top, width, h);
  ctx.fillStyle = colour;
  ctx.fillRect(cx - width / 2, top, width * Math.max(0, Math.min(1, fraction)), h);
}

export type Positions = ReadonlyMap<number, { x: number; y: number }>;

/**
 * @param previous unit positions one tick ago, for smooth motion between 20 Hz ticks
 * @param alpha how far we are from the previous tick (0) to the current one (1)
 */
export function render(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: State,
  previous: Positions,
  alpha: number,
  message: string,
): void {
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
    healthBar(ctx, sx, sy - r - 8, r * 2.6, tower.hp / TOWER.hp, SIDE_COLOUR[tower.side]);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(10, s * 2.4)}px system-ui, sans-serif`;
    ctx.fillText(String(tower.hp), sx, sy + r + s * 2);
  }

  for (const unit of state.units) {
    const stats = UNITS[unit.kind];
    const before = previous.get(unit.id) ?? unit;
    const x = before.x + (unit.x - before.x) * alpha;
    const y = before.y + (unit.y - before.y) * alpha;
    const { sx, sy } = toScreen(view, x, y);
    const r = 2.2 * s;
    ctx.fillStyle = SIDE_COLOUR[unit.side];
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${r * 1.3}px system-ui, sans-serif`;
    ctx.fillText(stats.emoji, sx, sy);
    healthBar(ctx, sx, sy - r - 6, r * 2, unit.hp / stats.hp, '#fff');
  }

  if (message) {
    ctx.font = `bold ${Math.max(14, s * 3.2)}px system-ui, sans-serif`;
    const { sx, sy } = toScreen(view, FIELD.width / 2, FIELD.length / 2);
    const w = ctx.measureText(message).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(sx - w / 2, sy - s * 3.5, w, s * 7, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(message, sx, sy);
  }
}
