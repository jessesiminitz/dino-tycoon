import { calendar, type GameState } from '../sim/GameState';
import type { Simulation, Speed } from '../sim/Simulation';
import { FENCE_TYPE_IDS, FENCE_TYPES } from '../sim/data/fences';
import { FEEDER_TYPES, type FeederKind } from '../sim/data/feeders';
import { SPECIES } from '../sim/data/species';
import { BUILDING_TYPES, PATH_COST, type BuildingKind } from '../sim/data/economy';
import { mountCatalog } from './catalog';
import { mountParkPanel } from './parkPanel';
import { mountGuide } from './guide';
import { SCENARIOS } from '../sim/data/scenarios';
import { DECOR_KINDS, DECOR_TYPES } from '../sim/data/decor';
import type { Mode, UiState } from './uiState';
import type { GameEvent } from '../sim/systems/context';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const formatMoney = (n: number) => money.format(n);

const TOAST_MS = 3200;
const MAX_TOASTS = 3;
/** Park events arriving this close together are shown as one batch. */
const EVENT_BATCH_MS = 150;

/** "a", "a and b", "a, b and c" */
function listNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Collapses a burst of park events: several escapes become one alert naming
 * them all, and anything beyond two other messages is summarised.
 */
export function batchEvents(events: GameEvent[]): GameEvent[] {
  const escapes = events.filter((e) => /has escaped!$/.test(e.text));
  const rest = events.filter((e) => !escapes.includes(e));
  const out: GameEvent[] = [];
  if (escapes.length === 1) out.push(escapes[0]);
  else if (escapes.length > 1) {
    const names = escapes.map((e) => e.text.replace(/^🚨 /, '').replace(/ the .*$/, ''));
    out.push({ text: `🚨 ${listNames(names)} have escaped!`, kind: 'bad' });
  }
  out.push(...rest.slice(0, 2));
  if (rest.length > 2) out.push({ text: `…and ${rest.length - 2} more thing${rest.length === 3 ? '' : 's'} happened`, kind: 'info' });
  return out;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

export interface InfoAction {
  label: string;
  onClick: () => void;
}

export interface Hud {
  /** Bottom-left panel. Pass null to hide. */
  showInfo(text: string | null, action?: InfoAction): void;
  /** Show the current tool's usage hint (or hide the panel in Look mode). */
  showHint(): void;
  toast(text: string, kind?: 'ok' | 'error'): void;
}

function modeHint(ui: UiState): string | null {
  switch (ui.mode) {
    case 'select':
      return null;
    case 'fence':
      return 'Drag to draw a fence · two fingers to move the map';
    case 'demolish':
      return 'Drag along fences or tap one to remove it · tap a feeder to remove it';
    case 'land':
      return 'Plots marked FOR SALE border your land · tap one to buy it';
    case 'feeder':
      return `Tap inside a paddock to build a ${FEEDER_TYPES[ui.feederKind].name.toLowerCase()} (${formatMoney(FEEDER_TYPES[ui.feederKind].cost)}, comes full)`;
    case 'path':
      return ui.pathErase
        ? 'Drag over paths to remove them'
        : `Drag to lay a path (${formatMoney(PATH_COST)} a tile) · connect it to the gate`;
    case 'decor': {
      const t = DECOR_TYPES[ui.decorKind];
      return `Tap your land to add a ${t.name.toLowerCase()} (${formatMoney(t.cost)}${t.upkeep ? `, ${formatMoney(t.upkeep)}/day` : ''}). Visitors nearby are happier`;
    }
    case 'building': {
      const t = BUILDING_TYPES[ui.buildingKind];
      const where = t.needsPath ? 'a spot next to a path' : 'a fossil bed on your land (the bone-strewn ground)';
      return `Tap ${where} to build a ${t.name.toLowerCase()} (${formatMoney(t.cost)}, ${formatMoney(t.upkeep)}/day)`;
    }
    case 'place-dino': {
      const sp = ui.placing ? SPECIES[ui.placing] : null;
      return sp ? `Tap inside a paddock to release your ${sp.name} (${formatMoney(sp.price)})` : null;
    }
  }
}

function pickButton(swatch: string, label: string, price: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'pick-btn';
  b.innerHTML = `<span class="swatch" style="background:${swatch}"></span>${label}<small>${price}</small>`;
  return b;
}

/** DOM overlay: money, clock, speed buttons, tool bar, info panel and toasts. */
export function mountHud(sim: Simulation, ui: UiState): Hud {
  const moneyEl = $('hud-money');
  const clockEl = $('hud-clock');
  const dinosEl = $('hud-dinos');
  const info = $('info');
  const infoText = $('info-text');
  const infoAction = $('info-action') as HTMLButtonElement;
  const toasts = $('toasts');
  const fencePicker = $('fence-picker');
  const feederPicker = $('feeder-picker');
  const buildingPicker = $('building-picker');
  const pathPicker = $('path-picker');
  const decorPicker = $('decor-picker');
  const guestsEl = $('hud-guests');
  const speedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.speed-btn'));
  const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tool-btn[data-mode]'));
  const catalog = mountCatalog(sim, ui);

  // --- money, clock, speed ---
  let lastMoney = sim.state.money;
  const render = (state: GameState) => {
    moneyEl.textContent = money.format(state.money);
    if (state.money !== lastMoney) {
      moneyEl.classList.remove('up', 'down');
      void moneyEl.offsetWidth; // restart the flash animation
      moneyEl.classList.add(state.money > lastMoney ? 'up' : 'down');
      lastMoney = state.money;
    }
    const { day, hour } = calendar(state);
    clockEl.textContent = `Day ${day} · ${String(hour).padStart(2, '0')}:00`;
    dinosEl.textContent = `${state.dinos.length} dino${state.dinos.length === 1 ? '' : 's'}`;
    guestsEl.textContent = `${state.visitors.length} guest${state.visitors.length === 1 ? '' : 's'}`;
    moneyEl.classList.toggle('negative', state.money < 0);
    for (const b of speedButtons) b.classList.toggle('active', Number(b.dataset.speed) === sim.speed);
  };
  for (const b of speedButtons) {
    b.addEventListener('click', () => sim.setSpeed(Number(b.dataset.speed) as Speed));
  }
  sim.onChange(render);
  render(sim.state);

  // --- tools ---
  for (const id of FENCE_TYPE_IDS) {
    const t = FENCE_TYPES[id];
    const b = pickButton(`#${t.rail.toString(16).padStart(6, '0')}`, t.name, `$${t.cost}`);
    b.dataset.fence = String(id);
    b.addEventListener('click', () => ui.setFenceType(id));
    fencePicker.appendChild(b);
  }
  for (const kind of Object.keys(FEEDER_TYPES) as FeederKind[]) {
    const t = FEEDER_TYPES[kind];
    const b = pickButton(kind === 'plants' ? '#73b44f' : '#d9454d', kind === 'plants' ? 'Plants' : 'Meat', `$${t.cost}`);
    b.dataset.feeder = kind;
    b.addEventListener('click', () => ui.setFeederKind(kind));
    feederPicker.appendChild(b);
  }
  for (const kind of Object.keys(BUILDING_TYPES) as BuildingKind[]) {
    const t = BUILDING_TYPES[kind];
    const swatch = { restaurant: '#d9454d', snackstall: '#f28fb1', giftshop: '#3f7fb0', restroom: '#6ec6ff', digsite: '#d9c7a3' }[kind];
    const b = pickButton(swatch, t.name, formatMoney(t.cost));
    b.dataset.building = kind;
    b.addEventListener('click', () => ui.setBuildingKind(kind));
    buildingPicker.appendChild(b);
  }
  for (const kind of DECOR_KINDS) {
    const t = DECOR_TYPES[kind];
    const swatch = { tree: '#4f9a3a', palm: '#86c25c', flowers: '#ff9fb8', fountain: '#8fd3ea', bench: '#9c6b3c' }[kind];
    const b = pickButton(swatch, t.name.replace(' tree', ''), formatMoney(t.cost));
    b.dataset.decor = kind;
    b.addEventListener('click', () => ui.setDecorKind(kind));
    decorPicker.appendChild(b);
  }
  for (const erase of [false, true]) {
    const b = pickButton(erase ? '#ff7a6b' : '#cdb58a', erase ? 'Erase' : 'Path', erase ? 'refund 25%' : `$${PATH_COST}/tile`);
    b.dataset.erase = String(erase);
    b.addEventListener('click', () => ui.setPathErase(erase));
    pathPicker.appendChild(b);
  }
  for (const b of toolButtons) {
    // Tapping the active tool again goes back to Look.
    b.addEventListener('click', () => ui.setMode(ui.mode === b.dataset.mode ? 'select' : (b.dataset.mode as Mode)));
  }
  $('btn-catalog').addEventListener('click', () => {
    ui.setMode('select');
    catalog.open();
  });

  let prevHint: string | null = null;
  const renderTools = () => {
    for (const b of toolButtons) b.classList.toggle('active', b.dataset.mode === ui.mode);
    fencePicker.classList.toggle('hidden', ui.mode !== 'fence');
    feederPicker.classList.toggle('hidden', ui.mode !== 'feeder');
    buildingPicker.classList.toggle('hidden', ui.mode !== 'building');
    pathPicker.classList.toggle('hidden', ui.mode !== 'path');
    decorPicker.classList.toggle('hidden', ui.mode !== 'decor');
    for (const b of decorPicker.querySelectorAll<HTMLButtonElement>('.pick-btn'))
      b.classList.toggle('active', b.dataset.decor === ui.decorKind);
    for (const b of buildingPicker.querySelectorAll<HTMLButtonElement>('.pick-btn'))
      b.classList.toggle('active', b.dataset.building === ui.buildingKind);
    for (const b of pathPicker.querySelectorAll<HTMLButtonElement>('.pick-btn'))
      b.classList.toggle('active', b.dataset.erase === String(ui.pathErase));
    for (const b of fencePicker.querySelectorAll<HTMLButtonElement>('.pick-btn'))
      b.classList.toggle('active', Number(b.dataset.fence) === ui.fenceType);
    for (const b of feederPicker.querySelectorAll<HTMLButtonElement>('.pick-btn'))
      b.classList.toggle('active', b.dataset.feeder === ui.feederKind);
    const hint = modeHint(ui);
    if (hint !== prevHint) {
      hud.showHint();
      prevHint = hint;
    }
  };
  ui.onChange(renderTools);

  // --- info panel & toasts ---
  const hud: Hud = {
    showInfo(text, action) {
      if (!text) {
        info.classList.add('hidden');
        return;
      }
      infoText.textContent = text;
      info.classList.remove('hidden');
      if (action) {
        infoAction.textContent = action.label;
        infoAction.onclick = action.onClick;
        infoAction.classList.remove('hidden');
      } else {
        infoAction.onclick = null;
        infoAction.classList.add('hidden');
      }
    },
    showHint() {
      hud.showInfo(modeHint(ui));
    },
    toast(text, kind = 'ok') {
      const el = document.createElement('div');
      el.className = `toast ${kind}`;
      el.textContent = text;
      toasts.appendChild(el);
      while (toasts.children.length > MAX_TOASTS) toasts.firstElementChild!.remove();
      window.setTimeout(() => el.remove(), TOAST_MS);
    },
  };

  let pending: GameEvent[] = [];
  sim.onEvent((e) => {
    if (pending.length === 0) {
      window.setTimeout(() => {
        for (const b of batchEvents(pending)) hud.toast(b.text, b.kind === 'bad' ? 'error' : 'ok');
        pending = [];
      }, EVENT_BATCH_MS);
    }
    pending.push(e);
  });

  const parkPanel = mountParkPanel(sim, hud);
  $('btn-park').addEventListener('click', () => parkPanel.open());
  const goalsBtn = $('btn-goals');
  goalsBtn.hidden = SCENARIOS[sim.state.scenario.id].goals.length === 0;
  goalsBtn.addEventListener('click', () => parkPanel.open('goals'));
  const guide = mountGuide(sim);
  $('btn-guide').addEventListener('click', () => guide.open());

  renderTools();
  return hud;
}
