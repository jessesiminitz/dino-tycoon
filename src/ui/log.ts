import { START_HOUR, type LogEntry } from '../sim/GameState';
import type { Simulation } from '../sim/Simulation';

type Filter = 'all' | 'problems' | 'good' | 'reports';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'problems', label: 'Problems' },
  { id: 'good', label: 'Good news' },
  { id: 'reports', label: 'Daily & monthly reports' },
];

const isReport = (e: LogEntry) => /^(Day \d+:|Month \d+ closed)/.test(e.text);

function matches(e: LogEntry, f: Filter): boolean {
  if (f === 'all') return true;
  if (f === 'reports') return isReport(e);
  if (isReport(e)) return false;
  return f === 'problems' ? e.kind === 'bad' : e.kind === 'good';
}

function when(hour: number): string {
  const total = hour + START_HOUR;
  return `Day ${Math.floor(total / 24) + 1} · ${String(total % 24).padStart(2, '0')}:00`;
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

/** 🔔 Every park alert, newest first, with filters and an unread badge on the button. */
export function mountLog(sim: Simulation): void {
  const modal = document.getElementById('log')!;
  const list = modal.querySelector<HTMLElement>('.log-list')!;
  const chips = modal.querySelector<HTMLElement>('.log-filters')!;
  const badge = document.getElementById('log-badge')!;
  const button = document.getElementById('btn-log')!;
  let filter: Filter = 'all';
  let unread = 0;
  let open = false;

  const setBadge = () => {
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.classList.toggle('hidden', unread === 0);
  };

  const render = () => {
    chips.innerHTML = FILTERS.map(
      (f) => `<button class="chip ${f.id === filter ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>`,
    ).join('');
    const rows = sim.state.log
      .filter((e) => matches(e, filter))
      .reverse()
      .map(
        // "kind-…" class names: a bare "info" would pick up the bottom-left info panel's fixed position.
        (e) => `<li class="log-entry kind-${isReport(e) ? 'report' : e.kind}">
          <span class="log-when">${when(e.hour)}</span><span>${esc(e.text)}</span></li>`,
      );
    list.innerHTML = rows.length ? rows.join('') : '<li class="note">Nothing here yet.</li>';
  };

  chips.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter as Filter;
    render();
    list.scrollTop = 0;
  });
  button.addEventListener('click', () => {
    open = true;
    unread = 0;
    setBadge();
    render();
    list.scrollTop = 0;
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

  sim.onEvent(() => {
    if (open) render();
    else {
      unread++;
      setBadge();
    }
  });
}
