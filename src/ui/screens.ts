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

// The win count lives in localStorage. Storage can be unavailable (private mode), so every
// access is guarded and the game simply shows 0.
const WINS_KEY = 'lane-clash:wins';

export function getWins(): number {
  try {
    return Number(localStorage.getItem(WINS_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function addWin(): number {
  const wins = getWins() + 1;
  try {
    localStorage.setItem(WINS_KEY, String(wins));
  } catch {
    // Nothing to do: the count just will not persist.
  }
  return wins;
}
