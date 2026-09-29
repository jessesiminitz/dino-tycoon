import { newGame, type GameState } from '../sim/GameState';
import { newPark } from '../sim/challenges';
import { challengeUnlocked, bestMedals } from './challengeRecords';
import { ISLAND_SHAPE_IDS, ISLAND_SHAPES, type IslandShape } from '../sim/island';
import { paintMinimap, paintParkMinimap } from '../render/minimap';
import { BUILD_IDS, CHALLENGE_IDS, MEDALS, SCENARIOS, type ScenarioId } from '../sim/data/scenarios';
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

type Screen = 'main' | 'new' | 'island' | 'load' | 'settings';

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
  /** The Sandbox island being chosen: its shape, size and seed (🎲 picks a new seed). */
  const island = { shape: 'classic' as IslandShape, big: false, seed: (Math.random() * 2 ** 32) >>> 0 };
  /** Which folder the New Park screen shows. */
  let folder: 'builds' | 'challenges' = 'builds';
  const previews = new Map<string, string>();
  /** A challenge's prebuilt park, as a map preview. */
  const parkPreview = (id: ScenarioId) => {
    const key = `park:${id}`;
    if (!previews.has(key)) previews.set(key, paintParkMinimap(newPark(id, 1)).toDataURL());
    return previews.get(key)!;
  };
  /** A map preview as an image URL (cached: generating an island takes a few milliseconds). */
  const preview = (seed: number, shape: IslandShape, big = false) => {
    const key = `${seed}:${shape}:${big}`;
    if (!previews.has(key)) {
      const s = newGame(seed, { shape, big });
      previews.set(key, paintMinimap(s.map, s.entrance).toDataURL());
    }
    return previews.get(key)!;
  };

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
      const tabs = `<div class="folder-tabs" role="tablist">
          <button class="folder-tab ${folder === 'builds' ? 'active' : ''}" data-folder="builds" role="tab">🏗️ New builds<small>Start from an empty island</small></button>
          <button class="folder-tab ${folder === 'challenges' ? 'active' : ''}" data-folder="challenges" role="tab">🧩 Challenges<small>Fix a park in trouble</small></button>
        </div>`;
      if (folder === 'challenges') {
        body.innerHTML = `${tabs}
          <div class="scenario-grid">${CHALLENGE_IDS.map((id, i) => {
            const sc = SCENARIOS[id];
            const open = challengeUnlocked(id);
            const best = bestMedals(id);
            const medals = best ? `Best: ${MEDALS.slice(0, best).map((m) => m.icon).join('')}` : 'Not won yet';
            const lock = open ? '' : `<span class="tag locked-tag">🔒 Earn a medal in ${SCENARIOS[CHALLENGE_IDS[i - 1]].name} to unlock</span>`;
            return `<button class="scenario-card ${open ? '' : 'locked'}" ${open ? `data-scenario="${id}"` : 'disabled'}>
              <img class="map-preview" alt="" src="${parkPreview(id)}">
              <span class="scenario-head"><b>${sc.briefing?.icon ?? ''} ${sc.name}</b><span class="stars">${stars(sc.difficulty)}</span></span>
              <span class="note">${sc.blurb}</span>
              ${lock || `<span class="note">${medals} · start with ${money.format(sc.startMoney)}</span>`}
            </button>`;
          }).join('')}</div>
          <p class="note">More challenges are on the way: floods, a volcano waking up and a staff strike.</p>
          <button class="menu-btn back" data-go="main">Back</button>`;
        return;
      }
      body.innerHTML = `${tabs}
        <div class="scenario-grid">${BUILD_IDS.map((id) => {
          const sc = SCENARIOS[id];
          const first = sc.rounds[0];
          const goals = first ? first.goals.map((g) => `<li>${goalLabel(g)}</li>`).join('') : '';
          const map = sc.seed !== null ? `<img class="map-preview" alt="" src="${preview(sc.seed, sc.island ?? 'classic')}">` : '';
          const attr = id === 'sandbox' ? 'data-go="island"' : `data-scenario="${id}"`;
          return `<button class="scenario-card" ${attr}>
            ${map}
            <span class="scenario-head"><b>${sc.name}</b><span class="stars">${stars(sc.difficulty)}</span></span>
            <span class="note">${sc.blurb}</span>
            ${goals ? `<ul>${goals}</ul><span class="note">🥉 Bronze within ${first.days} days, then 🥈 Silver and 🥇 Gold · start with ${money.format(sc.startMoney)}</span>` : `<span class="note">Start with ${money.format(sc.startMoney)}</span>`}
            ${sc.tutorial ? '<span class="tag">Includes a tutorial</span>' : ''}
            ${id === 'sandbox' ? '<span class="tag">Choose your island</span>' : ''}
          </button>`;
        }).join('')}</div>
        <button class="menu-btn back" data-go="main">Back</button>`;
    } else if (screen === 'island') {
      body.innerHTML = `
        <h2>Sandbox: choose your island</h2>
        <div class="island-grid">${ISLAND_SHAPE_IDS.map((shape) => {
          const info = ISLAND_SHAPES[shape];
          return `<button class="island-card ${shape === island.shape ? 'active' : ''}" data-shape="${shape}">
            <img class="map-preview" alt="" src="${preview(island.seed, shape, island.big)}">
            <b>${info.icon} ${info.name}</b>
            <span class="note">${info.blurb}</span>
          </button>`;
        }).join('')}</div>
        <div class="island-options">
          <span class="seg" role="group" aria-label="Island size">
            <button class="step-btn ${island.big ? '' : 'active'}" data-big="0">Normal size</button>
            <button class="step-btn ${island.big ? 'active' : ''}" data-big="1">Big island</button>
          </span>
          <button class="step-btn" data-reroll>🎲 Another island</button>
        </div>
        <div class="menu-buttons">
          <button class="menu-btn primary" data-start-sandbox>Start building</button>
          <button class="menu-btn back" data-go="new">Back</button>
        </div>`;
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
    } else if (d.shape) {
      island.shape = d.shape as IslandShape;
      render('island');
    } else if (d.big) {
      island.big = d.big === '1';
      render('island');
    } else if ('reroll' in d) {
      island.seed = (Math.random() * 2 ** 32) >>> 0;
      render('island');
    } else if ('startSandbox' in d) {
      placeNew(newPark('sandbox', island.seed, { shape: island.shape, big: island.big }));
    } else if (d.folder) {
      folder = d.folder as typeof folder;
      render('new');
    } else if (d.scenario) {
      placeNew(newPark(d.scenario as ScenarioId, (Math.random() * 2 ** 32) >>> 0));
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
