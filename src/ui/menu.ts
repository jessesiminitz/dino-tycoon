import { startScenario, type GameState } from '../sim/GameState';
import { SCENARIO_IDS, SCENARIOS, type ScenarioId } from '../sim/data/scenarios';
import { SPECIES, SPECIES_IDS } from '../sim/data/species';
import { goalLabel } from '../sim/goals';
import { paintDino } from '../render/dinoArt';
import {
  deleteSlot,
  exportFileName,
  lastSlot,
  listSlots,
  parseImport,
  SLOT_IDS,
  type SaveRecord,
  type SlotId,
} from '../save/storage';
import { renderSettings } from './settings';

type Screen = 'main' | 'new' | 'load' | 'settings';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const stars = (n: number) => (n === 0 ? 'Free play' : '★'.repeat(n) + '☆'.repeat(3 - n));
const STATUS_LABEL = { playing: 'In progress', won: '🏆 Won', lost: 'Ended', free: 'Free play' } as const;

function ago(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export interface MenuHandlers {
  /** Start playing `state` in `slot` (a new park, a loaded one or an import). */
  start(state: GameState, slot: SlotId): void;
}

/** The title screen: continue, new park (pick a scenario), load/export/import/delete parks, settings. */
export function showMenu(handlers: MenuHandlers): void {
  const root = document.getElementById('menu')!;
  const body = root.querySelector<HTMLElement>('.menu-body')!;
  root.classList.remove('hidden');

  // A parade of dinosaurs across the bottom of the title screen.
  const parade = root.querySelector<HTMLElement>('.menu-parade')!;
  if (!parade.childElementCount) {
    SPECIES_IDS.forEach((id, i) => {
      const img = document.createElement('img');
      img.src = paintDino(SPECIES[id]).toDataURL();
      img.alt = '';
      img.style.animationDelay = `${-i * 3.1}s`;
      parade.appendChild(img);
    });
  }

  let slots: Record<SlotId, SaveRecord | null> = { 1: null, 2: null, 3: null };
  /** When set, the next slot choice overwrites with this state (new park or import). */
  let pendingState: GameState | null = null;
  let confirmDelete: SlotId | null = null;

  const go = (screen: Screen) => {
    confirmDelete = null;
    render(screen);
  };

  function slotRow(slot: SlotId, rec: SaveRecord | null, mode: 'load' | 'overwrite'): string {
    if (!rec) {
      return `<li class="slot empty"><span>Park ${slot} · <i>empty</i></span>
        ${mode === 'overwrite' ? `<button class="action-btn" data-use="${slot}">Use this slot</button>` : ''}</li>`;
    }
    const s = rec.summary;
    const info = `<span><b>${SCENARIOS[s.scenario].name}</b> · ${STATUS_LABEL[s.status]}<br>
      <small>Day ${s.day} · ${money.format(s.money)} · ${s.dinos} dinos · reputation ${s.reputation} · saved ${ago(rec.savedAt)}</small></span>`;
    if (mode === 'overwrite') {
      return `<li class="slot">${info}<button class="action-btn danger" data-use="${slot}">Replace</button></li>`;
    }
    if (confirmDelete === slot) {
      return `<li class="slot">${info}<span class="slot-actions">
        <span class="note">Delete for good?</span>
        <button class="action-btn danger" data-delete-yes="${slot}">Delete</button>
        <button class="step-btn" data-delete-no="${slot}">Keep</button></span></li>`;
    }
    return `<li class="slot">${info}<span class="slot-actions">
      <button class="action-btn" data-play="${slot}">Play</button>
      <button class="step-btn" data-export="${slot}" aria-label="Export park ${slot}">⤓</button>
      <button class="step-btn" data-delete="${slot}" aria-label="Delete park ${slot}">🗑</button></span></li>`;
  }

  function render(screen: Screen): void {
    root.dataset.screen = screen;
    if (screen === 'main') {
      const last = lastSlot();
      const cont = last && slots[last];
      body.innerHTML = `
        <div class="menu-buttons">
          ${cont ? `<button class="menu-btn primary" data-play="${last}">Continue<small>${SCENARIOS[cont.summary.scenario].name} · Day ${cont.summary.day}</small></button>` : ''}
          <button class="menu-btn ${cont ? '' : 'primary'}" data-go="new">New park</button>
          <button class="menu-btn" data-go="load">Load park</button>
          <button class="menu-btn" data-go="settings">Settings</button>
        </div>
        <p class="note version">Version ${__APP_VERSION__} · ${__BUILD_DATE__}</p>`;
    } else if (screen === 'new') {
      body.innerHTML = `
        <h2>Choose a scenario</h2>
        <div class="scenario-grid">${SCENARIO_IDS.map((id) => {
          const sc = SCENARIOS[id];
          const goals = sc.goals.map((g) => `<li>${goalLabel(g)}</li>`).join('');
          return `<button class="scenario-card" data-scenario="${id}">
            <span class="scenario-head"><b>${sc.name}</b><span class="stars">${stars(sc.difficulty)}</span></span>
            <span class="note">${sc.blurb}</span>
            ${goals ? `<ul>${goals}</ul><span class="note">Within ${sc.days} days · start with ${money.format(sc.startMoney)}</span>` : `<span class="note">Start with ${money.format(sc.startMoney)}</span>`}
            ${sc.tutorial ? '<span class="tag">Includes a tutorial</span>' : ''}
          </button>`;
        }).join('')}</div>
        <button class="menu-btn back" data-go="main">Back</button>`;
    } else if (screen === 'load') {
      const overwrite = pendingState !== null;
      body.innerHTML = `
        <h2>${overwrite ? 'All three park slots are in use. Replace one?' : 'Your parks'}</h2>
        <ul class="slots">${SLOT_IDS.map((s) => slotRow(s, slots[s], overwrite ? 'overwrite' : 'load')).join('')}</ul>
        ${overwrite ? '' : `<label class="menu-btn file-btn">Import a save file<input type="file" accept="application/json,.json" data-import hidden></label>`}
        <p class="note import-error" hidden></p>
        <button class="menu-btn back" data-go="main">Back</button>`;
    } else {
      body.innerHTML = `<h2>Settings</h2><div class="settings"></div><button class="menu-btn back" data-go="main">Back</button>`;
      renderSettings(body.querySelector<HTMLElement>('.settings')!);
    }
  }

  /** Put a new or imported park in the first empty slot, or ask which to replace. */
  const placeNew = (state: GameState) => {
    const empty = SLOT_IDS.find((s) => !slots[s]);
    if (empty) return begin(state, empty);
    pendingState = state;
    go('load');
  };

  const begin = (state: GameState, slot: SlotId) => {
    root.classList.add('hidden');
    handlers.start(state, slot);
  };

  body.addEventListener('click', async (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el) return;
    const d = el.dataset;
    if (d.go) {
      if (d.go === 'main') pendingState = null;
      go(d.go as Screen);
    } else if (d.scenario) {
      placeNew(startScenario(d.scenario as ScenarioId, (Math.random() * 2 ** 32) >>> 0));
    } else if (d.use && pendingState) {
      begin(pendingState, Number(d.use) as SlotId);
    } else if (d.play) {
      const rec = slots[Number(d.play) as SlotId];
      if (rec) begin(rec.state, rec.slot);
    } else if (d.export) {
      const rec = slots[Number(d.export) as SlotId];
      if (!rec) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(rec)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: exportFileName(rec) });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (d.delete) {
      confirmDelete = Number(d.delete) as SlotId;
      render('load');
    } else if (d.deleteNo) {
      go('load');
    } else if (d.deleteYes) {
      await deleteSlot(Number(d.deleteYes) as SlotId);
      slots = await listSlots();
      go('load');
    }
  });

  body.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.matches('[data-import]') || !input.files?.[0]) return;
    const result = parseImport(await input.files[0].text());
    if ('error' in result) {
      const p = body.querySelector<HTMLElement>('.import-error')!;
      p.textContent = result.error;
      p.hidden = false;
      return;
    }
    placeNew(result.state);
  });

  void listSlots().then((s) => {
    slots = s;
    render('main');
  });
  render('main');
}
