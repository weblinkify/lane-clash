// Energy bar, timer and card buttons. Reads state; reports card taps through a callback.
import { CARDS, CARD_IDS, ENERGY, TICK_RATE, type CardId } from '../sim/balance';
import { MATCH_TICKS, type State } from '../sim/sim';

export interface Hud {
  update(state: State, selected: CardId | null): void;
}

export function createHud(onCardTap: (card: CardId) => void): Hud {
  const cardsEl = document.getElementById('cards')!;
  const fill = document.getElementById('energy-fill')!;
  const energyText = document.getElementById('energy-text')!;
  const timer = document.getElementById('timer')!;

  const buttons = new Map<CardId, HTMLButtonElement>();
  for (const id of CARD_IDS) {
    const card = CARDS[id];
    const button = document.createElement('button');
    button.className = 'card';
    button.dataset.card = id;
    button.innerHTML = `<span class="cost">${card.cost}</span><span class="emoji">${card.emoji}</span><span class="name">${card.name}</span>`;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      onCardTap(id);
    });
    cardsEl.append(button);
    buttons.set(id, button);
  }

  // Only touch the DOM when a displayed value actually changes.
  let shownEnergy = -1;
  let shownSeconds = -1;

  return {
    update(state, selected) {
      const energy = state.energy[0];
      if (energy !== shownEnergy) {
        shownEnergy = energy;
        fill.style.transform = `scaleX(${energy / ENERGY.max})`;
        energyText.textContent = String(Math.floor(energy));
      }
      for (const [id, button] of buttons) {
        button.classList.toggle('unaffordable', energy < CARDS[id].cost);
        button.classList.toggle('selected', id === selected);
      }
      const seconds = Math.ceil((MATCH_TICKS - state.tick) / TICK_RATE);
      if (seconds !== shownSeconds) {
        shownSeconds = seconds;
        timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        timer.classList.toggle('urgent', seconds <= 20);
      }
    },
  };
}
