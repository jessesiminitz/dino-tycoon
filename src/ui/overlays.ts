import type { Simulation } from '../sim/Simulation';
import { holdPause, releasePause } from './pause';
import { MEDALS, SCENARIOS } from '../sim/data/scenarios';
import { calendar } from '../sim/GameState';
import { daysLeft, goalProgress } from '../sim/goals';
import { renderSettings } from './settings';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

/** "A new version is ready · Update" banner; works on the title screen and in a park. */
export function offerUpdate(apply: () => void): void {
  $('update-banner').classList.remove('hidden');
  $('update-apply').onclick = apply;
}

export interface PauseHandlers {
  save(): void;
  mainMenu(): void;
  toast(text: string): void;
}

/** ☰ menu: pauses the park while open. */
export function mountPauseMenu(sim: Simulation, handlers: PauseHandlers): void {
  const modal = $('pause');
  const settings = modal.querySelector<HTMLElement>('.settings')!;
  const open = () => {
    holdPause(sim, modal);
    settings.hidden = true;
    modal.classList.remove('hidden');
  };
  const close = () => {
    modal.classList.add('hidden');
    releasePause(sim, modal);
  };

  $('btn-menu').addEventListener('click', open);
  modal.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pause]');
    if (e.target === modal) return close();
    if (!el) return;
    switch (el.dataset.pause) {
      case 'resume':
        return close();
      case 'save':
        handlers.save();
        handlers.toast('Park saved');
        return close();
      case 'settings':
        settings.hidden = !settings.hidden;
        if (!settings.hidden) renderSettings(settings);
        return;
      case 'menu':
        return handlers.mainMenu();
    }
  });
}

/** Scenario won or lost: a summary with the choice to keep playing or go back to the menu. */
export function showOutcome(sim: Simulation, outcome: 'won' | 'lost' | 'milestone', mainMenu: () => void, text = ''): void {
  const modal = $('outcome');
  const { state } = sim;
  const sc = SCENARIOS[state.scenario.id];
  const reward = /Reward: (.*)\.$/.exec(text)?.[1];
  const listGoals = () =>
    goalProgress(state)
      .map((g) => `<li class="${g.done ? 'done' : ''}">${g.done ? '✅' : outcome === 'lost' ? '❌' : '⬜'} ${g.label}</li>`)
      .join('');
  let html: string;
  if (outcome === 'milestone') {
    // A round done: celebrate, show the reward, and what the next (harder) round asks for.
    const earned = MEDALS[state.scenario.round - 1];
    const next = MEDALS[state.scenario.round];
    const left = daysLeft(state);
    html = `
      <h2>${earned.icon} ${earned.name} milestone!</h2>
      <p>You reached the ${earned.name.toLowerCase()} milestone in <b>${sc.name}</b> on day ${calendar(state).day}.</p>
      ${reward ? `<p class="reward">🎁 ${reward}</p>` : ''}
      <h3>Next up: ${next.icon} ${next.name}${left !== null ? ` · ${left} days` : ''}</h3>
      <ul class="outcome-goals">${listGoals()}</ul>
      <div class="outcome-actions"><button class="action-btn" data-outcome="keep">Let's go!</button></div>`;
  } else {
    html = `
      <h2>${outcome === 'won' ? '🏆 Scenario complete!' : 'Scenario over'}</h2>
      <p>${outcome === 'won' ? `You earned all three medals in <b>${sc.name}</b> by day ${calendar(state).day}. 🥉🥈🥇` : `<b>${sc.name}</b> has ended.`}</p>
      ${outcome === 'won' && reward ? `<p class="reward">🎁 ${reward}</p>` : ''}
      ${outcome === 'lost' ? `<ul class="outcome-goals">${listGoals()}</ul>` : ''}
      <p class="note">${state.dinos.length} dinosaurs · reputation ${Math.round(state.reputation)} ·
        best day ${state.stats.bestDayVisitors} visitors · ${money.format(state.money)} in the bank</p>
      <div class="outcome-actions">
        <button class="action-btn" data-outcome="keep">Keep playing</button>
        <button class="action-btn secondary" data-outcome="menu">Main menu</button>
      </div>`;
  }
  modal.querySelector('.outcome-body')!.innerHTML = html;
  holdPause(sim, modal);
  modal.classList.remove('hidden');
  modal.onclick = (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-outcome]');
    if (!el) return;
    if (el.dataset.outcome === 'menu') return mainMenu();
    // Carry on as free play: the goals stay recorded as won or lost.
    modal.classList.add('hidden');
    releasePause(sim, modal);
  };
}
