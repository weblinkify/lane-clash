// The menu / result overlay.

export interface OverlayButton {
  id: string;
  label: string;
  secondary?: boolean;
  onClick: () => void;
}

const overlay = document.getElementById('overlay')!;
const titleEl = document.getElementById('overlay-title')!;
const subEl = document.getElementById('overlay-sub')!;
const buttonsEl = document.getElementById('overlay-buttons')!;

export function showOverlay(title: string, subtitle: string, buttons: OverlayButton[]): void {
  titleEl.textContent = title;
  subEl.textContent = subtitle;
  buttonsEl.replaceChildren(
    ...buttons.map((spec) => {
      const button = document.createElement('button');
      button.id = spec.id;
      button.textContent = spec.label;
      if (spec.secondary) button.className = 'secondary';
      button.addEventListener('click', spec.onClick);
      return button;
    }),
  );
  overlay.hidden = false;
}

export function hideOverlay(): void {
  overlay.hidden = true;
}
