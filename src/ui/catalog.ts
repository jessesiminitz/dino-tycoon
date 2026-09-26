import type { Simulation } from '../sim/Simulation';
import { FENCE_TYPES } from '../sim/data/fences';
import { SPECIES, SPECIES_IDS, type SpeciesId } from '../sim/data/species';
import { paintDino } from '../render/dinoArt';
import { formatMoney } from './hud';
import type { UiState } from './uiState';

/** "Buy Dinosaurs" sheet: one card per species. Buying switches to placement mode. */
export function mountCatalog(sim: Simulation, ui: UiState): { open(): void } {
  const modal = document.getElementById('catalog')!;
  const grid = modal.querySelector<HTMLElement>('.species-grid')!;
  const buttons = new Map<SpeciesId, HTMLButtonElement>();

  for (const id of SPECIES_IDS) {
    const sp = SPECIES[id];
    const card = document.createElement('article');
    card.className = 'species-card';
    const art = document.createElement('img');
    art.className = 'species-art';
    art.alt = '';
    art.src = paintDino(sp).toDataURL();
    card.innerHTML = `
      <header>
        <h3>${sp.name}</h3>
        <span class="diet ${sp.diet}">${sp.diet === 'carnivore' ? '🥩 Carnivore' : '🌿 Herbivore'}</span>
      </header>
      <dl>
        <dt>Fence</dt><dd>${FENCE_TYPES[sp.fenceNeeded].name}+</dd>
        <dt>Space</dt><dd>${sp.space} tiles</dd>
        <dt>Size</dt><dd>${sp.lengthM} m</dd>
        <dt>Period</dt><dd>${sp.period}</dd>
      </dl>
      <p class="fact">${sp.fact}</p>`;
    card.querySelector('header')!.before(art);
    const buy = document.createElement('button');
    buy.className = 'action-btn';
    buy.addEventListener('click', () => {
      close();
      ui.startPlacing(id);
    });
    card.appendChild(buy);
    buttons.set(id, buy);
    grid.appendChild(card);
  }

  const refresh = () => {
    for (const [id, btn] of buttons) {
      const sp = SPECIES[id];
      const unlocked = sim.state.unlockedSpecies.includes(id);
      btn.disabled = !unlocked || sp.price > sim.state.money;
      btn.textContent = unlocked
        ? `Buy · ${formatMoney(sp.price)}`
        : `🦴 Fossils ${sim.state.fossils[id] ?? 0}/${sp.fossilsNeeded}${sim.state.buildings.some((b) => b.kind === 'digsite') ? ' · keep digging' : ' · build a dig site'}`;
      btn.closest('.species-card')!.classList.toggle('locked', !unlocked);
    }
  };

  const close = () => modal.classList.add('hidden');
  modal.querySelector('.modal-close')!.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  return {
    open() {
      refresh();
      modal.classList.remove('hidden');
      grid.scrollTop = 0;
    },
  };
}
