import type { Dino, Egg } from '../sim/GameState';
import type { Simulation } from '../sim/Simulation';
import { MAX_NAME } from '../sim/commands';
import { habitatOf, SPECIES } from '../sim/data/species';
import { hoursToHatch } from '../sim/systems/breeding';
import { playCall, playSfx } from '../audio/audio';
import { paintDino, dinoCanvasBounds } from '../render/dinoArt';
import { ART_STYLE } from '../render/artStyle';
import { holdPause, releasePause } from './pause';

/** Ready eggs remain in the save until the third tap. One celebration at a time. */
export function mountHatching(sim: Simulation, save: () => void): void {
  sim.interactiveHatching = true;
  const dialog = document.createElement('dialog');
  dialog.className = 'hatch-dialog';
  dialog.setAttribute('aria-labelledby', 'hatch-title');
  dialog.setAttribute('aria-describedby', 'hatch-message');
  document.body.append(dialog);
  dialog.addEventListener('cancel', e => e.preventDefault());
  let active = false;
  let previousFocus: HTMLElement | null = null;
  const births: number[] = [];

  function open(): void {
    active = true;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    holdPause(sim, dialog);
    dialog.showModal();
  }

  function reveal(baby: Dino): void {
    dialog.innerHTML = `<h2 id="hatch-title">Congratulations!</h2>
      <p id="hatch-message"></p><div class="hatch-stage hatch-revealed"></div>
      <form class="hatch-name-form"><label for="hatch-name">Give your baby a name <span>(optional)</span></label>
      <input id="hatch-name" maxlength="${MAX_NAME}" autocomplete="off" enterkeyhint="done">
      <p class="hatch-error" role="alert"></p><button class="action-btn" type="submit">Welcome to the park!</button></form>`;
    dialog.querySelector('#hatch-message')!.textContent = `Meet your new baby ${SPECIES[baby.species].name}!`;
    const canvas = paintDino(SPECIES[baby.species], 0, true, ART_STYLE);
    const bounds = dinoCanvasBounds(canvas);
    const picture = document.createElement('canvas');
    picture.width = bounds.right - bounds.left;
    picture.height = bounds.bottom - bounds.top;
    picture.getContext('2d')!.drawImage(canvas, bounds.left, bounds.top, picture.width, picture.height, 0, 0, picture.width, picture.height);
    picture.setAttribute('role', 'img');
    picture.setAttribute('aria-label', `Baby ${SPECIES[baby.species].name}`);
    picture.dataset.species = baby.species;
    dialog.querySelector('.hatch-stage')!.append(picture);
    const input = dialog.querySelector<HTMLInputElement>('input')!;
    input.placeholder = baby.name;
    dialog.querySelector('form')!.addEventListener('submit', e => {
      e.preventDefault();
      if (input.value.trim()) {
        const result = sim.dispatch({ type: 'rename', kind: 'dino', id: baby.id, name: input.value });
        if (!result.ok) { dialog.querySelector('.hatch-error')!.textContent = result.message; return; }
      }
      save();
      dialog.close();
      active = false;
      releasePause(sim, dialog);
      if (!active) previousFocus?.focus();
      check();
    });
    dialog.querySelector<HTMLButtonElement>('button')!.focus();
    playCall(baby.species, true);
  }

  function crack(egg: Egg): void {
    open();
    save();
    dialog.innerHTML = `<h2 id="hatch-title">An egg is hatching!</h2><p id="hatch-message">Tap the egg three times to meet your new baby.</p>
      <button type="button" class="hatch-egg" data-hatch-egg data-cracks="0" aria-label="Tap egg to hatch: 0 of 3 taps">
        <svg viewBox="0 0 180 200" aria-hidden="true"><ellipse cx="90" cy="184" rx="65" ry="9" fill="#0002"/>
          <path class="egg-shell" d="M90 10C53 10 24 91 24 129C24 170 53 185 90 185S156 170 156 129C156 91 127 10 90 10Z"/>
          <ellipse cx="65" cy="66" rx="12" ry="24" fill="#fff8" transform="rotate(20 65 66)"/>
          <g fill="#d1af6b"><circle cx="60" cy="126" r="6"/><circle cx="117" cy="89" r="5"/><circle cx="113" cy="155" r="7"/></g>
          <path class="egg-crack crack-one" d="M90 16L81 49L100 65L83 88L97 108"/>
          <path class="egg-crack crack-two" d="M83 88L56 100L66 125L29 143M97 108L120 119L112 138L151 154"/>
        </svg></button><p class="hatch-progress" aria-live="polite">0 of 3 taps</p>`;
    let taps = 0;
    const button = dialog.querySelector<HTMLButtonElement>('[data-hatch-egg]')!;
    button.focus();
    button.addEventListener('click', () => {
      if (taps >= 3) return;
      taps++;
      playSfx('crack');
      button.dataset.cracks = String(taps);
      button.setAttribute('aria-label', `Tap egg to hatch: ${taps} of 3 taps`);
      dialog.querySelector('.hatch-progress')!.textContent = `${taps} of 3 taps`;
      if (taps !== 3) return;
      button.disabled = true;
      const result = sim.dispatch({ type: 'hatchEgg', id: egg.id });
      if (!result.ok) {
        dialog.querySelector('#hatch-message')!.textContent = result.message;
        button.disabled = false; taps = 2; return;
      }
      // hatchEgg adds the baby synchronously; the egg's species/location are preserved.
      const baby = sim.state.dinos[sim.state.dinos.length - 1];
      save();
      reveal(baby);
    });
  }

  function check(): void {
    if (active) return;
    while (births.length) {
      const id = births.shift();
      const baby = sim.state.dinos.find(d => d.id === id);
      if (baby) { open(); reveal(baby); save(); return; }
    }
    const egg = sim.state.eggs.find(e => habitatOf(e.species) !== 'water' && hoursToHatch(sim.state, e.laidHour) === 0);
    if (egg) crack(egg);
  }
  sim.onEvent(e => {
    if (e.birth && sim.state.dinos.find(d => d.id === e.birth!.dinoId && habitatOf(d.species) === 'water')) {
      births.push(e.birth.dinoId);
      queueMicrotask(check);
    }
  });
  sim.onChange(check);
  check();
}
