import type { Simulation } from '../sim/Simulation';
import { FENCE_TYPES } from '../sim/data/fences';
import { SPECIES, SPECIES_IDS, type SpeciesId } from '../sim/data/species';
import { paintDino } from '../render/dinoArt';

/**
 * The Dino Guide: an encyclopedia card for every species. Facts are always
 * readable; species you haven't unlocked show as a silhouette with fossil progress.
 */
export function mountGuide(sim: Simulation): { open(species?: SpeciesId): void } {
  const modal = document.getElementById('guide')!;
  const list = modal.querySelector<HTMLElement>('.guide-list')!;
  const detail = modal.querySelector<HTMLElement>('.guide-detail')!;
  const art = new Map(SPECIES_IDS.map((id) => [id, paintDino(SPECIES[id]).toDataURL()]));
  let current: SpeciesId = SPECIES_IDS[0];

  const buttons = SPECIES_IDS.map((id) => {
    const b = document.createElement('button');
    b.className = 'guide-item';
    b.setAttribute('role', 'tab');
    b.dataset.species = id;
    b.innerHTML = `<img alt="" src="${art.get(id)}"><span>${SPECIES[id].name}</span>`;
    b.addEventListener('click', () => show(id));
    list.appendChild(b);
    return b;
  });

  function show(id: SpeciesId): void {
    current = id;
    const sp = SPECIES[id];
    const { state } = sim;
    const unlocked = state.unlockedSpecies.includes(id);
    for (const b of buttons) {
      const bid = b.dataset.species as SpeciesId;
      b.classList.toggle('active', bid === id);
      b.classList.toggle('locked', !state.unlockedSpecies.includes(bid));
      b.setAttribute('aria-selected', String(bid === id));
    }
    const owned = state.dinos.filter((d) => d.species === id).length;
    const found = state.fossils[id] ?? 0;
    const status = unlocked
      ? `<p class="guide-status">In your park: <b>${owned}</b></p>`
      : `<div class="guide-status">
           <span>🦴 Fossils found: <b>${found}/${sp.fossilsNeeded}</b>. Dig sites unlock this species.</span>
           <span class="meter"><span style="width:${(100 * found) / sp.fossilsNeeded}%"></span></span>
         </div>`;
    detail.innerHTML = `
      <img class="guide-art ${unlocked ? '' : 'locked'}" alt="${sp.name}" src="${art.get(id)}">
      <h3>${sp.name}</h3>
      <p class="guide-tags">
        <span class="diet ${sp.diet}">${sp.diet === 'carnivore' ? '🥩 Carnivore' : '🌿 Herbivore'}</span>
        · ${sp.period}
      </p>
      <ul class="guide-facts">${[sp.fact, ...sp.facts].map((f) => `<li>${f}</li>`).join('')}</ul>
      <dl class="guide-stats">
        <dt>Length</dt><dd>${sp.lengthM} m</dd>
        <dt>Weight</dt><dd>${sp.weight}</dd>
        <dt>Discovered</dt><dd>${sp.discovered}</dd>
        <dt>In the park</dt><dd>${FENCE_TYPES[sp.fenceNeeded].name} fences or stronger · ${sp.space} tiles of space${sp.social ? ' · likes company' : ''}</dd>
      </dl>
      ${status}`;
    detail.scrollTop = 0;
  }

  const close = () => modal.classList.add('hidden');
  modal.querySelector('.modal-close')!.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  return {
    open(species?: SpeciesId) {
      show(species ?? current);
      modal.classList.remove('hidden');
    },
  };
}
