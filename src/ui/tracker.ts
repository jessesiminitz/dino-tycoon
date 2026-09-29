import type { Simulation } from '../sim/Simulation';
import { MEDALS, SCENARIOS } from '../sim/data/scenarios';
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
    // The volcano's mood, when one is waking.
    const e = state.eruption;
    const volcano = !e || e.stage === 'over'
      ? ''
      : e.stage === 'rumbling'
        ? `<small class="volcano ${e.eruptHour - state.hours <= 12 ? 'urgent' : ''}">🌋 erupts in ~${Math.max(1, e.eruptHour - state.hours)}h</small>`
        : e.stage === 'erupting'
          ? '<small class="volcano urgent">🌋 ERUPTING!</small>'
          : '<small class="volcano">🌋 lava cooling</small>';
    // The river's mood, in the rainy season.
    const f = state.flood;
    const cfg = SCENARIOS[state.scenario.id].floods;
    const nextFlood = f && cfg ? cfg.starts[f.survived] : undefined;
    const river = !f || !cfg
      ? ''
      : f.level > 0
        ? '<small class="volcano urgent">🌊 FLOOD!</small>'
        : nextFlood !== undefined
          ? `<small class="volcano ${nextFlood - state.hours <= 12 ? 'urgent' : ''}">🌧️ flood in ~${Math.max(1, nextFlood - state.hours)}h</small>`
          : '';
    const extra = volcano + river;
    el.hidden = false;
    if (html + extra !== last) {
      el.innerHTML = html + extra;
      last = html + extra;
    }
  };
  sim.onChange(render);
  render();
}
