import { START_HOUR, type Dino, type GameState, type Staff, type Visitor } from '../sim/GameState';
import type { Simulation } from '../sim/Simulation';
import { dinoConcerns, staffConcerns, whatVisitorsSay, type Concern, type DinoTag } from '../sim/concerns';
import { MAX_NAME } from '../sim/commands';
import { SPECIES } from '../sim/data/species';
import { STAFF_ROLES, STAFF_TYPES } from '../sim/data/staff';
import { TOPIC_LABELS, type Topic } from '../sim/data/thoughts';
import { describeTask } from '../sim/systems/staff';
import { hoursToGrow, hoursToHatch } from '../sim/systems/breeding';
import type { ItemKind } from '../sim/data/economy';
import type { UiState } from './uiState';
import { formatMoney } from './hud';

type Tab = 'visitors' | 'reviews' | 'dinos' | 'staff';
type Kind = 'visitor' | 'dino' | 'staff' | 'egg';

const REFRESH_MS = 1000;
/** After a touch on the panel, wait this long before the next live refresh. */
const TOUCH_QUIET_MS = 1500;

const shown = new WeakMap<HTMLElement, string>();
/** Replaces an element's contents only when they've actually changed. */
function setHtml(el: HTMLElement, html: string): void {
  if (shown.get(el) === html) return;
  shown.set(el, html);
  el.innerHTML = html;
}

/** Hours a thought counts toward a filter like "grossed out". */
const RECENT = 6;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const ITEM_ICONS: Record<ItemKind, string> = { plush: '🦖', hat: '🧢', balloon: '🎈', poncho: '🧥', umbrella: '☂️' };
const SNACK_ICONS = { icecream: '🍦', popcorn: '🍿', hotdog: '🌭' } as const;

const recently = (state: GameState, v: Visitor, topics: Topic[], good = false) =>
  v.thoughts.some((t) => t.good === good && topics.includes(t.topic) && state.hours - t.hour <= RECENT);

interface Filter<T> {
  id: string;
  label: string;
  test: (e: T) => boolean;
}

function visitorFilters(state: GameState): Filter<Visitor>[] {
  return [
    { id: 'all', label: 'All', test: () => true },
    { id: 'unhappy', label: '😠 Unhappy', test: (v) => v.satisfaction < 40 },
    { id: 'hungry', label: '🍔 Hungry', test: (v) => v.hunger >= 60 },
    { id: 'thirsty', label: '🥤 Thirsty', test: (v) => v.thirst >= 60 },
    { id: 'restroom', label: '🚻 Need restroom', test: (v) => v.bladder >= 70 },
    { id: 'gross', label: '🤢 Grossed out', test: (v) => recently(state, v, ['mess', 'litter']) },
    { id: 'price', label: '💸 Too pricey', test: (v) => v.thoughts.some((t) => t.topic === 'price' && !t.good) },
    { id: 'bored', label: '🥱 Seen no dinos', test: (v) => v.seen.length === 0 },
    { id: 'wet', label: '🌧️ Soaked', test: (v) => recently(state, v, ['weather']) },
    { id: 'kids', label: '🧒 Kids', test: (v) => v.kid },
  ];
}

const DINO_FILTERS: Filter<{ d: Dino; concerns: Concern<DinoTag>[] }>[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'unhappy', label: '😠 Unhappy', test: ({ d }) => d.happiness < 50 },
  { id: 'babies', label: '🍼 Babies & eggs', test: ({ d }) => d.baby },
  ...(
    [
      ['hungry', '🍖 Hungry'],
      ['feeder', '🪣 Feeder'],
      ['sick', '🤒 Sick'],
      ['escaped', '🚨 Escaped'],
      ['crowded', '📦 Crowded'],
      ['lonely', '💔 Lonely'],
      ['danger', '⚠️ In danger'],
      ['fence', '🚧 Weak fence'],
      ['dung', '💩 Dirty paddock'],
    ] as [DinoTag, string][]
  ).map(([tag, label]) => ({ id: tag, label, test: ({ concerns }: { concerns: Concern<DinoTag>[] }) => concerns.some((c) => c.tag === tag) })),
];

function face(score: number): string {
  return score >= 70 ? '😄' : score >= 50 ? '🙂' : score >= 30 ? '😐' : '😠';
}

function meter(icon: string, label: string, value: number, bad: boolean): string {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return `<span class="need ${bad ? 'bad' : ''}" title="${label} ${v}%"><i>${icon}</i><span class="bar"><span style="width:${v}%"></span></span></span>`;
}

function when(hour: number): string {
  const total = hour + START_HOUR;
  return `Day ${Math.floor(total / 24) + 1} · ${String(total % 24).padStart(2, '0')}:00`;
}

function head(kind: Kind, id: number, faceIcon: string, name: string, sub: string, editing: boolean, extra = ''): string {
  const nameRow = editing
    ? `<input class="rename-input" maxlength="${MAX_NAME}" value="${esc(name)}" aria-label="New name" enterkeyhint="done">`
    : `<b class="pname">${esc(name)}</b><button class="icon-btn" data-rename="${kind}:${id}" aria-label="Rename ${esc(name)}">✏️</button>`;
  return `<div class="person-head"><span class="face">${faceIcon}</span>
    <div class="who"><div class="name-row">${nameRow}</div>${sub ? `<small class="sub">${sub}</small>` : ''}</div>
    ${extra}<button class="icon-btn" data-locate="${kind}:${id}" aria-label="Show on map">📍</button></div>`;
}


/** 👥 Everyone in the park: what visitors think, what dinos need, how staff are coping. */
export function mountPeople(sim: Simulation, ui: UiState): void {
  const modal = document.getElementById('people')!;
  const tabsEl = modal.querySelector<HTMLElement>('.tabs')!;
  const chips = modal.querySelector<HTMLElement>('.log-filters')!;
  const body = modal.querySelector<HTMLElement>('.people-body')!;
  let tab: Tab = 'visitors';
  const filters: Record<Tab, string> = { visitors: 'all', reviews: 'all', dinos: 'all', staff: 'all' };
  let editing: string | null = null;
  const expanded = new Set<string>();
  let timer = 0;
  let lastTouch = 0;
  modal.addEventListener('pointerdown', () => (lastTouch = performance.now()), true);
  // Short phone screens start with the summary folded so the cards are visible.
  let sayingsOpen = window.innerHeight > 500;

  const chipRow = (list: { id: string; label: string; count?: number }[]) =>
    list
      .map(
        (f) =>
          `<button class="chip ${filters[tab] === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}${f.count !== undefined && f.id !== 'all' ? ` <small>${f.count}</small>` : ''}</button>`,
      )
      .join('');

  function visitorsTab(state: GameState): [string, string] {
    const fs = visitorFilters(state);
    const active = fs.find((f) => f.id === filters.visitors) ?? fs[0];
    const list = state.visitors.filter(active.test).sort((a, b) => a.satisfaction - b.satisfaction);
    const { complaints, praise } = whatVisitorsSay(state);
    const saying =
      complaints.length || praise.length
        ? `<details class="sayings" ${sayingsOpen ? 'open' : ''}>
            <summary>What visitors are saying${complaints.length ? ` · <span class="bad-text">${complaints.length} complaint${complaints.length === 1 ? '' : 's'}</span>` : ''}</summary>
            <div class="sayings-cols">
              <ul>${complaints
                .slice(0, 3)
                .map((s) => `<li class="bad"><b>${TOPIC_LABELS[s.topic]}</b> <small>×${s.count}</small><q>${esc(s.quote)}</q>${s.advice ? `<em>💡 ${esc(s.advice)}</em>` : ''}</li>`)
                .join('') || '<li class="note">No complaints right now 🎉</li>'}</ul>
              <ul>${praise
                .slice(0, 3)
                .map((s) => `<li class="good"><b>${TOPIC_LABELS[s.topic]}</b> <small>×${s.count}</small><q>${esc(s.quote)}</q></li>`)
                .join('')}</ul>
            </div>
          </details>`
        : '';
    const cards = list.map((v) => {
      const key = `visitor:${v.id}`;
      const gross = recently(state, v, ['mess', 'litter']);
      const carrying = [
        ...v.items.map((i) => ITEM_ICONS[i]),
        v.snack ? SNACK_ICONS[v.snack] : '',
        v.sodaUntil > 0 ? '🥤' : '',
      ].join('');
      const thoughts = [...v.thoughts].reverse().slice(0, expanded.has(key) ? 6 : 2);
      return `<article class="person-card ${v.satisfaction < 40 ? 'unhappy' : ''}" data-card="${key}">
        ${head('visitor', v.id, gross ? '🤢' : v.bladder >= 90 ? '😣' : face(v.satisfaction), v.name, `${v.kid ? 'Kid · ' : ''}seen ${v.seen.length} dino${v.seen.length === 1 ? '' : 's'}`, editing === key, carrying ? `<span class="carry" title="Carrying">${carrying}</span>` : '')}
        <div class="needs">${meter('😊', 'Mood', v.satisfaction, v.satisfaction < 40)}${meter('🍔', 'Hunger', v.hunger, v.hunger >= 60)}${meter('🥤', 'Thirst', v.thirst, v.thirst >= 60)}${meter('🚻', 'Restroom', v.bladder, v.bladder >= 70)}</div>
        <ul class="thoughts">${thoughts.map((t) => `<li class="${t.good ? 'good' : 'bad'}">“${esc(t.text)}”</li>`).join('') || '<li class="note">Just arrived.</li>'}</ul>
        ${v.thoughts.length > 2 ? `<small class="note">Tap for ${expanded.has(key) ? 'fewer' : 'more'} thoughts</small>` : ''}
      </article>`;
    });
    const empty = state.visitors.length === 0 ? 'No visitors in the park right now.' : 'No visitors match this filter.';
    return [
      chipRow(fs.map((f) => ({ id: f.id, label: f.label, count: state.visitors.filter(f.test).length }))),
      `${saying}<div class="people-grid">${cards.join('') || `<p class="note">${empty}</p>`}</div>`,
    ];
  }

  function reviewsTab(state: GameState): [string, string] {
    const fs = [
      { id: 'all', label: 'All', test: () => true },
      { id: 'good', label: '👍 4–5 stars', test: (s: number) => s >= 4 },
      { id: 'bad', label: '👎 1–2 stars', test: (s: number) => s <= 2 },
    ];
    const active = fs.find((f) => f.id === filters.reviews) ?? fs[0];
    const list = state.reviews.filter((r) => active.test(r.stars)).reverse();
    const avg = state.reviews.length ? state.reviews.reduce((s, r) => s + r.stars, 0) / state.reviews.length : 0;
    const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
    return [
      chipRow(fs.map((f) => ({ id: f.id, label: f.label, count: state.reviews.filter((r) => f.test(r.stars)).length }))),
      `${state.reviews.length ? `<p class="review-avg">Average of the last ${state.reviews.length}: <b>${avg.toFixed(1)} ★</b></p>` : ''}
       <ol class="log-list reviews">${
         list
           .map(
             (r) => `<li class="log-entry kind-${r.stars >= 4 ? 'good' : r.stars <= 2 ? 'bad' : 'info'}">
               <span class="stars" aria-label="${r.stars} stars">${stars(r.stars)}</span>
               <span>“${esc(r.text)}” <small class="note">— ${esc(r.name)} · ${when(r.hour)}</small></span></li>`,
           )
           .join('') || '<li class="note">Reviews appear as visitors head home.</li>'
       }</ol>`,
    ];
  }

  function dinosTab(state: GameState): [string, string] {
    const regions = sim.regions();
    const all = state.dinos.map((d) => ({ d, concerns: dinoConcerns(state, regions, d) }));
    const active = DINO_FILTERS.find((f) => f.id === filters.dinos) ?? DINO_FILTERS[0];
    const list = all.filter(active.test).sort((a, b) => a.d.happiness - b.d.happiness);
    const cards = list.map(({ d, concerns }) => {
      const key = `dino:${d.id}`;
      const sp = SPECIES[d.species];
      const grows = Math.ceil(hoursToGrow(state, d) / 24);
      const sub = d.baby ? `Baby ${sp.name} · grows up in ${grows} day${grows === 1 ? '' : 's'}` : sp.name;
      return `<article class="person-card ${concerns.some((c) => !c.good) ? 'unhappy' : ''}" data-card="${key}">
        ${head('dino', d.id, d.escaped ? '🚨' : d.sick ? '🤒' : d.baby ? '🍼' : face(d.happiness), d.name, sub, editing === key)}
        <div class="needs">${meter('😊', 'Happiness', d.happiness, d.happiness < 50)}${meter('🍖', 'Hunger', d.hunger, d.hunger >= 50)}${meter('❤️', 'Health', d.health, d.health < 60)}</div>
        <ul class="thoughts">${concerns.map((c) => `<li class="${c.good ? 'good' : 'bad'}">${esc(c.text)}</li>`).join('')}</ul>
      </article>`;
    });
    // Eggs show under All and Babies & eggs.
    const eggs =
      active.id === 'all' || active.id === 'babies'
        ? state.eggs.map((e) => {
            const h = hoursToHatch(state, e.laidHour);
            const when = h <= 1 ? 'Hatching any minute!' : h < 24 ? `Hatches in about ${h} hours` : `Hatches in about ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? '' : 's'}`;
            return `<article class="person-card egg-card" data-card="egg:${e.id}">
              <div class="person-head"><span class="face">🥚</span>
                <div class="who"><div class="name-row"><b class="pname">${SPECIES[e.species].name} egg</b></div><small class="sub">${when}</small></div>
                <button class="icon-btn" data-locate="egg:${e.id}" aria-label="Show on map">📍</button></div>
              <ul class="thoughts"><li class="good">Keep the parents happy and fed, and keep meat-eaters out of this paddock.</li></ul>
            </article>`;
          })
        : [];
    const counts = DINO_FILTERS.map((f) => ({ id: f.id, label: f.label, count: all.filter(f.test).length + (f.id === 'babies' ? state.eggs.length : 0) }));
    return [
      chipRow(counts),
      `<div class="people-grid">${[...eggs, ...cards].join('') || `<p class="note">${state.dinos.length ? 'No dinosaurs match this filter.' : 'No dinosaurs yet. Buy some from 🦖 Dinos.'}</p>`}</div>`,
    ];
  }

  function staffTab(state: GameState): [string, string] {
    const all = state.staff.map((m) => ({ m, concerns: staffConcerns(state, m) }));
    const fs: Filter<{ m: Staff; concerns: Concern<string>[] }>[] = [
      { id: 'all', label: 'All', test: () => true },
      { id: 'overworked', label: '😓 Overworked', test: ({ concerns }) => concerns.some((c) => c.tag === 'overworked') },
      ...STAFF_ROLES.filter((r) => state.staff.some((m) => m.role === r)).map((r) => ({
        id: r,
        label: STAFF_TYPES[r].name + 's',
        test: ({ m }: { m: Staff }) => m.role === r,
      })),
    ];
    const active = fs.find((f) => f.id === filters.staff) ?? fs[0];
    const cards = all.filter(active.test).map(({ m, concerns }) => {
      const key = `staff:${m.id}`;
      const t = STAFF_TYPES[m.role];
      return `<article class="person-card ${concerns.some((c) => !c.good) ? 'unhappy' : ''}" data-card="${key}">
        ${head('staff', m.id, concerns.some((c) => c.tag === 'overworked') ? '😓' : '🙂', m.name, `${t.name} · ${formatMoney(t.wage)}/day`, editing === key)}
        <p class="task">${esc(describeTask(state, m))}</p>
        <ul class="thoughts">${concerns.map((c) => `<li class="${c.good ? 'good' : 'bad'}">${esc(c.text)}</li>`).join('')}</ul>
      </article>`;
    });
    return [
      chipRow(fs.map((f) => ({ id: f.id, label: f.label, count: all.filter(f.test).length }))),
      `<div class="people-grid">${cards.join('') || '<p class="note">No staff yet.</p>'}</div>
       <p class="note">Hire and fire staff from 📊 Park → Staff.</p>`,
    ];
  }

  const render = () => {
    const { state } = sim;
    const counts: Record<Tab, number> = { visitors: state.visitors.length, reviews: state.reviews.length, dinos: state.dinos.length, staff: state.staff.length };
    const labels: Record<Tab, string> = { visitors: '🧍 Visitors', reviews: '⭐ Reviews', dinos: '🦖 Dinos', staff: '🧹 Staff' };
    setHtml(
      tabsEl,
      (Object.keys(labels) as Tab[])
        .map((t) => `<button class="tab-btn ${t === tab ? 'active' : ''}" role="tab" aria-selected="${t === tab}" data-tab="${t}">${labels[t]} <small>${counts[t]}</small></button>`)
        .join(''),
    );
    const [chipHtml, bodyHtml] =
      tab === 'visitors' ? visitorsTab(state) : tab === 'reviews' ? reviewsTab(state) : tab === 'dinos' ? dinosTab(state) : staffTab(state);
    setHtml(chips, chipHtml);
    setHtml(body, bodyHtml);
    const input = body.querySelector<HTMLInputElement>('.rename-input');
    if (input && document.activeElement !== input) {
      input.focus();
      input.select();
    }
  };

  const commitRename = (input: HTMLInputElement, save: boolean) => {
    if (!editing) return;
    const [kind, id] = editing.split(':');
    editing = null;
    if (save) {
      const r = sim.dispatch({ type: 'rename', kind: kind as Exclude<Kind, 'egg'>, id: Number(id), name: input.value });
      if (!r.ok) console.warn(r.message);
    }
    render();
  };

  tabsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab as Tab;
    editing = null;
    render();
    body.scrollTop = 0;
  });
  chips.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-filter]');
    if (!b) return;
    filters[tab] = b.dataset.filter!;
    render();
    body.scrollTop = 0;
  });
  body.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const rename = el.closest<HTMLElement>('[data-rename]');
    if (rename) {
      editing = rename.dataset.rename!;
      render();
      return;
    }
    const loc = el.closest<HTMLElement>('[data-locate]');
    if (loc) {
      const [kind, id] = loc.dataset.locate!.split(':');
      close();
      ui.focus(kind as Kind, Number(id));
      return;
    }
    if (el.closest('input')) return;
    const card = el.closest<HTMLElement>('[data-card]');
    if (card?.dataset.card?.startsWith('visitor:')) {
      const key = card.dataset.card;
      if (expanded.has(key)) expanded.delete(key);
      else expanded.add(key);
      render();
    }
  });
  body.addEventListener(
    'toggle',
    (e) => {
      if ((e.target as HTMLElement).matches('.sayings')) sayingsOpen = (e.target as HTMLDetailsElement).open;
    },
    true,
  );
  body.addEventListener('keydown', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.matches('.rename-input')) return;
    if (e.key === 'Enter') commitRename(input, true);
    else if (e.key === 'Escape') commitRename(input, false);
  });
  body.addEventListener('focusout', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.matches('.rename-input')) commitRename(input, true);
  });

  const open = () => {
    render();
    body.scrollTop = 0;
    modal.classList.remove('hidden');
    clearInterval(timer);
    timer = window.setInterval(() => {
      // Hold off while a finger is on the panel, so a tap never lands on a button that was just replaced.
      if (!editing && performance.now() - lastTouch > TOUCH_QUIET_MS) render();
    }, REFRESH_MS);
  };
  const close = () => {
    editing = null;
    clearInterval(timer);
    modal.classList.add('hidden');
  };
  document.getElementById('btn-people')!.addEventListener('click', open);
  modal.querySelector('.modal-close')!.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
}
