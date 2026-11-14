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
  // Belt and braces against pinch zoom, double-tap zoom and long-press menus on iOS.
  for (const type of ['gesturestart', 'dblclick', 'contextmenu'] as const) {
    document.addEventListener(type, (event) => event.preventDefault());
  }
  document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
}
