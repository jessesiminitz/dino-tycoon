import type { Simulation } from '../sim/Simulation';
import { MEDALS } from '../sim/data/scenarios';
import { daysLeft, goalProgress, goalShown } from '../sim/goals';

/**
 * A little bar under the money showing the current medal's next unmet goal,
 * its progress and the days left. Tap it for the full list (Park → Goals).
 */
export function mountTracker(sim: Simulation, openGoals: () => void): void {
  const el = document.getElementById('goal-tracker')!;
  el.addEventListener('click', openGoals);
  let last = '';
  const render = () => {
    const { state } = sim;
    const playing = state.scenario.status === 'playing';
    document.body.classList.toggle('has-tracker', playing);
    if (!playing) {
      el.hidden = true;
      return;
    }
    const goals = goalProgress(state);
    const next = goals.find((g) => !g.done) ?? goals[0];
    if (!next) {
      el.hidden = true;
      return;
    }
    const medal = MEDALS[Math.min(state.scenario.round, MEDALS.length - 1)];
    const left = daysLeft(state);
    const done = goals.filter((g) => g.done).length;
    const html = `<span class="tracker-medal">${medal.icon}</span>
      <span class="tracker-goal">${next.label}</span>
      <b>${goalShown(state, next.goal, next.value)}</b>
      ${goals.length > 1 ? `<small>${done}/${goals.length} done</small>` : ''}
      ${left !== null ? `<small class="${left <= 2 ? 'urgent' : ''}">⏳ ${left} day${left === 1 ? '' : 's'}</small>` : ''}`;
    el.hidden = false;
    if (html !== last) {
      el.innerHTML = html;
      last = html;
    }
  };
  sim.onChange(render);
  render();
}
