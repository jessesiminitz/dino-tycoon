import { calendar, type GameState, type ParkRequest } from '../sim/GameState';
import type { Simulation } from '../sim/Simulation';
import { MAX_ACTIVE } from '../sim/systems/requests';
import { formatMoney } from './hud';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function timeLeft(state: GameState, r: ParkRequest): string {
  const h = r.expiresHour - state.hours;
  if (h <= 0) return 'due now';
  return h === 1 ? '1 hour left' : `${h} hours left`;
}

/** Progress as words and a 0–1 fraction (checks at a set time have no bar). */
function progressOf(state: GameState, r: ParkRequest): { text: string; fraction: number | null } {
  switch (r.kind) {
    case 'clean':
      return { text: r.progress === 0 ? 'The paths are spotless right now' : `${r.progress} bit${r.progress === 1 ? '' : 's'} of litter or mess on the paths`, fraction: null };
    case 'feeders':
      return { text: `${r.progress} of ${state.feeders.length} feeders at least half full`, fraction: null };
    case 'see':
      return { text: r.progress ? 'On show!' : 'Not on show from a path yet', fraction: r.progress };
    default:
      return { text: `${Math.min(r.progress, r.target)} / ${r.target}`, fraction: Math.min(1, r.progress / Math.max(1, r.target)) };
  }
}

function card(state: GameState, r: ParkRequest): string {
  const reward = `🎁 ${formatMoney(r.reward.money)}${r.reward.reputation ? ` · +${r.reward.reputation} reputation` : ''}`;
  if (r.status !== 'active') {
    return `<article class="request-card ${r.status}">
      <span class="request-icon">${r.icon}</span>
      <div><p>${esc(r.text)}</p><small>${r.status === 'done' ? `✅ Done! ${reward}` : '⌛ Ran out of time'}</small></div>
    </article>`;
  }
  const p = progressOf(state, r);
  const due = `until ${String(calendar({ ...state, hours: r.expiresHour }).hour).padStart(2, '0')}:00 · ${timeLeft(state, r)}`;
  return `<article class="request-card">
    <span class="request-icon">${r.icon}</span>
    <div>
      <p>${esc(r.text)}</p>
      ${p.fraction !== null ? `<span class="need-bar"><span style="width:${Math.round(p.fraction * 100)}%"></span></span>` : ''}
      <small>${esc(p.text)} · ${due}</small>
      <small class="request-reward">${reward}</small>
    </div>
  </article>`;
}

/** 📋 Today's requests from visitors, critics, the mayor and friends. */
export function mountRequests(sim: Simulation): void {
  const modal = document.getElementById('requests')!;
  const body = modal.querySelector<HTMLElement>('.requests-body')!;
  const badge = document.getElementById('requests-badge')!;
  let open = false;
  let last = '';

  const render = () => {
    const { state } = sim;
    const active = state.requests.filter((r) => r.status === 'active');
    const finished = state.requests.filter((r) => r.status !== 'active').reverse();
    badge.textContent = String(active.length);
    badge.classList.toggle('hidden', active.length === 0);
    if (!open) return;
    const html = `
      ${active.map((r) => card(state, r)).join('') || '<p class="note">No requests right now.</p>'}
      ${finished.length ? `<h3>Earlier today</h3>${finished.map((r) => card(state, r)).join('')}` : ''}
      <p class="note">Up to ${MAX_ACTIVE} requests arrive when the park opens at 08:00, and more at 12:00 and 16:00. Missing one costs nothing.</p>`;
    if (html !== last) body.innerHTML = last = html;
  };

  sim.onChange(render);
  sim.onEvent((e) => {
    if (/^(📋|✅)/.test(e.text)) render();
  });
  document.getElementById('btn-requests')!.addEventListener('click', () => {
    open = true;
    last = '';
    render();
    modal.classList.remove('hidden');
  });
  const close = () => {
    open = false;
    modal.classList.add('hidden');
  };
  modal.querySelector('.modal-close')!.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  render();
}
