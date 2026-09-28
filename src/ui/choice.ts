import type { Simulation, Speed } from '../sim/Simulation';
import { choiceEvent } from '../sim/systems/choices';
import { playSfx } from '../audio/audio';

/**
 * ❓ Decision cards: when something happens that needs an answer, the card
 * pops up (and the park pauses while it's open). "Decide later" tucks it away
 * behind a pulsing button; left long enough, the cautious answer is taken.
 */
export function mountChoice(sim: Simulation, toast: (text: string, kind?: 'ok' | 'error') => void): void {
  const modal = document.getElementById('choice')!;
  const button = document.getElementById('choice-btn')!;
  const icon = modal.querySelector<HTMLElement>('.choice-icon')!;
  const title = modal.querySelector<HTMLElement>('.choice-title')!;
  const text = modal.querySelector<HTMLElement>('.choice-text')!;
  const options = modal.querySelector<HTMLElement>('.choice-options')!;
  const note = modal.querySelector<HTMLElement>('.choice-note')!;
  let shownFor: string | null = null;
  let resume: Speed = 1;

  const key = () => {
    const c = sim.state.pendingChoice;
    return c ? `${c.eventId}@${c.createdHour}` : null;
  };

  const open = () => {
    const c = sim.state.pendingChoice;
    const ev = c && choiceEvent(c.eventId);
    if (!c || !ev) return;
    shownFor = key();
    icon.textContent = ev.icon;
    title.textContent = ev.title;
    text.textContent = ev.text(sim.state, c);
    options.innerHTML = ev.options.map((o, i) => `<button class="action-btn ${i ? 'secondary' : ''}" data-option="${i}">${o.label}</button>`).join('');
    const left = c.expiresHour - sim.state.hours;
    note.textContent = `If you don't decide within ${left} hour${left === 1 ? '' : 's'}, "${ev.options[ev.options.length - 1].label}" will be chosen.`;
    if (sim.speed) resume = sim.speed;
    sim.setSpeed(0);
    modal.classList.remove('hidden');
    button.classList.add('hidden');
  };

  const close = () => {
    modal.classList.add('hidden');
    if (sim.speed === 0) sim.setSpeed(resume);
    button.classList.toggle('hidden', !sim.state.pendingChoice);
  };

  options.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-option]');
    if (!b) return;
    const r = sim.dispatch({ type: 'chooseOption', option: Number(b.dataset.option) });
    close();
    if (r.ok) {
      toast(r.message);
      playSfx('chime');
    }
  });
  modal.querySelector('.choice-later')!.addEventListener('click', close);
  button.addEventListener('click', open);

  // A new decision pops straight up; once answered (or timed out) the button goes away.
  const watch = () => {
    const k = key();
    if (k && k !== shownFor) {
      playSfx('alert');
      open();
    } else if (!k) {
      shownFor = null;
      button.classList.add('hidden');
      if (!modal.classList.contains('hidden')) close();
    }
  };
  sim.onEvent(watch);
  sim.onChange(watch);
}
