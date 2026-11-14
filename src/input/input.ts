// Turns touches into field coordinates. Never touches the simulation directly.
import { toField, type View } from '../render/render';

export function onFieldTap(
  canvas: HTMLCanvasElement,
  getView: () => View,
  handler: (x: number, y: number) => void,
): void {
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const { x, y } = toField(getView(), event.clientX - rect.left, event.clientY - rect.top);
    handler(x, y);
  });
}

/** Stops the page itself from reacting to touches: no zoom, scroll, pull-to-refresh or menus. */
export function lockPageGestures(): void {
  for (const type of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu', 'selectstart'] as const) {
    document.addEventListener(type, (event) => event.preventDefault());
  }
  document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
}
