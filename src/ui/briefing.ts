import type { Simulation } from '../sim/Simulation';
import { holdPause, releasePause } from './pause';
import { MEDALS, SCENARIOS } from '../sim/data/scenarios';
import { goalLabel } from '../sim/goals';

/** A challenge's story card: what's gone wrong, what to do first, and the Bronze goals. Shown once. */
export function mountBriefing(sim: Simulation): void {
  const { state } = sim;
  const sc = SCENARIOS[state.scenario.id];
  if (state.scenario.briefed || !sc.briefing) return;
  const modal = document.getElementById('briefing')!;
  const round = sc.rounds[0];
  modal.querySelector('.briefing-body')!.innerHTML = `
    <h2><span class="briefing-icon" aria-hidden="true">${sc.briefing.icon}</span> ${sc.name}</h2>
    <p>${sc.briefing.story}</p>
    <h3>${MEDALS[0].icon} ${MEDALS[0].name} goal${round.days ? ` (within ${round.days} days)` : ''}</h3>
    <ul class="outcome-goals">${round.goals.map((g) => `<li>⬜ ${goalLabel(g)}</li>`).join('')}</ul>
    <p class="briefing-tip">💡 ${sc.briefing.tip}</p>
    <div class="outcome-actions"><button class="action-btn" data-go>Let’s go!</button></div>`;
  holdPause(sim, modal);
  modal.classList.remove('hidden');
  modal.querySelector('[data-go]')!.addEventListener('click', () => {
    state.scenario.briefed = true;
    modal.classList.add('hidden');
    releasePause(sim, modal);
  });
}
