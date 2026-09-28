import { calendar, type GameState } from '../sim/GameState';
import type { Simulation, Speed } from '../sim/Simulation';
import { FEEDER_TYPES } from '../sim/data/feeders';
import { habitatOf, SPECIES } from '../sim/data/species';
import { POND_COST } from '../sim/commands';
import { BUILDING_TYPES, PATH_COST, TRACK_COST } from '../sim/data/economy';
import { mountCatalog } from './catalog';
import { mountParkPanel } from './parkPanel';
import { mountGuide } from './guide';
import { mountLog } from './log';
import { mountPeople } from './people';
import { mountRequests } from './requests';
import { mountDig } from './dig';
import { mountStickers } from './stickers';
import { mountTools } from './tools';
import { mountChoice } from './choice';
import { DECOR_TYPES } from '../sim/data/decor';
import type { UiState } from './uiState';
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
  /** A compact icon button, shown before the main action. */
  small?: boolean;
  /** Accessible name for icon buttons. */
  title?: string;
  disabled?: boolean;
}

export interface Hud {
  /** Bottom-left panel. Pass null to hide. */
  showInfo(text: string | null, action?: InfoAction | InfoAction[]): void;
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
      return 'Drag along fences or paths to remove them · tap a fence, path, building, feeder or garden item to remove it';
    case 'land':
      return 'Plots marked FOR SALE border your land · tap one to buy it';
    case 'feeder':
      return `Tap inside a paddock to build a ${FEEDER_TYPES[ui.feederKind].name.toLowerCase()} (${formatMoney(FEEDER_TYPES[ui.feederKind].cost)}, comes full)`;
    case 'path':
      if (ui.pathTrack) {
        return ui.pathErase
          ? 'Drag over jeep track to remove it'
          : `Drag to lay jeep track (${formatMoney(TRACK_COST)} a tile) past your paddocks, starting beside a Safari station · a loop works best`;
      }
      return ui.pathErase
        ? 'Drag over paths to remove them'
        : `Drag to lay a path (${formatMoney(PATH_COST)} a tile) · connect it to the gate`;
    case 'decor': {
      if (ui.decorKind === 'pond') {
        return `Tap or drag over grass or sand to dig a pond (${formatMoney(POND_COST)} a tile). A pond inside a paddock makes a lagoon for sea reptiles`;
      }
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
      if (!sp) return null;
      const where = { land: 'inside a paddock', water: 'the water of a lagoon (a pond inside a paddock)', air: 'inside an aviary (a paddock fenced with aviary net)' }[
        habitatOf(sp.id)
      ];
      return `Tap ${where} to release your ${sp.name} (${formatMoney(sp.price)})`;
    }
  }
}

/** DOM overlay: money, clock, speed buttons, tool bar, info panel and toasts. */
export function mountHud(sim: Simulation, ui: UiState): Hud {
  const moneyEl = $('hud-money');
  const clockEl = $('hud-clock');
  const info = $('info');
  const infoText = $('info-text');
  const infoAction = $('info-action') as HTMLButtonElement;
  const infoActions = $('info-actions');
  const smallButtons: HTMLButtonElement[] = [];
  const toasts = $('toasts');
  const guestsEl = $('hud-guests');
  const speedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.speed-btn'));
  const catalog = mountCatalog(sim, ui);

  // --- money, clock, speed ---
  const hudEl = $('hud');
  let lastWidth = 0;
  /**
   * Squeezes the top bar until the ☰ menu and speed buttons fit: phones differ
   * in width and in how much the notch takes, so measure rather than guess.
   */
  function fitHud(): void {
    const left = hudEl.querySelector<HTMLElement>('.hud-group')!;
    const levels = ['fit-1', 'fit-2', 'fit-3'];
    hudEl.classList.remove(...levels);
    for (const level of levels) {
      if (left.scrollWidth <= left.clientWidth + 1) break;
      hudEl.classList.add(level);
    }
  }
  const refit = () =>
    requestAnimationFrame(() => {
      lastWidth = 0;
      render(sim.state);
    });
  window.addEventListener('resize', refit);
  // Safe-area insets and fonts can settle after the first layout.
  new ResizeObserver(refit).observe(hudEl);
  document.fonts?.ready.then(refit);
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
    // Minutes tick by in quarter hours, so the clock visibly moves on slow days.
    const minutes = Math.floor((sim.stepProgressInHour * 60) / 15) * 15;
    const time = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    clockEl.textContent = hudEl.classList.contains('fit-3') ? `D${day} ${time}` : `Day ${day} · ${time}`;
    const width = moneyEl.textContent.length + clockEl.textContent.length;
    const left = hudEl.querySelector<HTMLElement>('.hud-group')!;
    // Refit when the text changes length, or if anything (a badge, a font loading) made it overflow.
    if (width !== lastWidth || left.scrollWidth > left.clientWidth + 1) {
      lastWidth = width;
      fitHud();
    }
    guestsEl.textContent = String(state.visitors.length);
    guestsEl.hidden = state.visitors.length === 0;
    moneyEl.classList.toggle('negative', state.money < 0);
    for (const b of speedButtons) b.classList.toggle('active', Number(b.dataset.speed) === sim.speed);
  };
  for (const b of speedButtons) {
    b.addEventListener('click', () => sim.setSpeed(Number(b.dataset.speed) as Speed));
  }
  sim.onChange(render);
  render(sim.state);

  // --- tools ---
  mountTools(sim, ui);
  $('btn-catalog').addEventListener('click', () => {
    ui.setMode('select');
    catalog.open();
  });

  let prevHint: string | null = null;
  const renderTools = () => {
    const hint = modeHint(ui);
    if (hint !== prevHint) {
      hud.showHint();
      prevHint = hint;
    }
  };
  ui.onChange(renderTools);

  /**
   * The info panel sits bottom-left, beside the toolbar when there's room.
   * The toolbar's width depends on the phone and the tool (pickers stack above
   * it), so measure it: when the space beside it is too narrow to read, lift
   * the panel above the whole toolbar stack instead.
   */
  const toolbar = document.querySelector<HTMLElement>('.toolbar')!;
  /** Narrowest comfortable column for the text itself (the action button needs room on top of this). */
  const MIN_TEXT_WIDTH = 240;
  const GAP = 8;
  function placeInfo(): void {
    if (info.classList.contains('hidden')) return;
    const groups = [...toolbar.querySelectorAll<HTMLElement>('.hud-group:not(.hidden)')].map((g) => g.getBoundingClientRect());
    if (groups.length === 0) return;
    const left = info.getBoundingClientRect().left;
    const toolsLeft = Math.min(...groups.map((r) => r.left));
    const toolsTop = Math.min(...groups.map((r) => r.top));
    const beside = toolsLeft - left - GAP;
    const button = infoActions.getBoundingClientRect().width + 10;
    if (beside >= MIN_TEXT_WIDTH + button + 24) {
      info.style.maxWidth = `${Math.min(beside, 460)}px`;
      info.style.bottom = '';
    } else {
      info.style.maxWidth = `${Math.min(window.innerWidth - left * 2, 560)}px`;
      info.style.bottom = `${window.innerHeight - toolsTop + GAP}px`;
    }
  }
  ui.onChange(() => requestAnimationFrame(placeInfo));
  window.addEventListener('resize', () => requestAnimationFrame(placeInfo));

  // --- info panel & toasts ---
  const hud: Hud = {
    showInfo(text, action) {
      if (!text) {
        info.classList.add('hidden');
        return;
      }
      infoText.textContent = text;
      info.classList.remove('hidden');
      const actions = action ? (Array.isArray(action) ? action : [action]) : [];
      const main = actions.find((a) => !a.small);
      const small = actions.filter((a) => a.small);
      // Reuse the small buttons (the panel refreshes several times a second; a tap must not land on a replaced node).
      while (smallButtons.length < small.length) {
        const b = document.createElement('button');
        b.className = 'action-btn small';
        infoActions.insertBefore(b, infoAction);
        smallButtons.push(b);
      }
      smallButtons.forEach((b, i) => {
        const a = small[i];
        b.hidden = !a;
        if (!a) return;
        if (b.textContent !== a.label) b.textContent = a.label;
        b.title = a.title ?? '';
        b.setAttribute('aria-label', a.title ?? a.label);
        b.disabled = !!a.disabled;
        b.onclick = a.onClick;
      });
      if (main) {
        if (infoAction.textContent !== main.label) infoAction.textContent = main.label;
        infoAction.onclick = main.onClick;
        infoAction.disabled = !!main.disabled;
        infoAction.classList.remove('hidden');
      } else {
        infoAction.onclick = null;
        infoAction.classList.add('hidden');
      }
      placeInfo();
    },
    showHint() {
      hud.showInfo(modeHint(ui));
    },
    toast(text, kind = 'ok') {
      const el = document.createElement('div');
      el.className = `toast ${kind}`;
      el.textContent = text;
      toasts.appendChild(el);
      // Keep the newest few (the update banner, if showing, stays at the top of the column).
      const shown = toasts.querySelectorAll('.toast');
      for (let i = 0; i < shown.length - MAX_TOASTS; i++) shown[i].remove();
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
  mountLog(sim);
  mountPeople(sim, ui);
  mountRequests(sim);
  mountDig(sim);
  const stickers = mountStickers(sim, (t) => hud.toast(t));
  mountChoice(sim, (t, k) => hud.toast(t, k));
  const guide = mountGuide(sim);
  // The Book holds the Dino Guide and the sticker book, a tab each. New stickers open it at the stickers.
  $('btn-book').addEventListener('click', () => (stickers.hasNew() ? stickers.open() : guide.open()));
  for (const tab of document.querySelectorAll<HTMLButtonElement>('.book-tabs .tab-btn')) {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('active')) return;
      for (const id of ['guide', 'stickers']) $(id).classList.add('hidden');
      if (tab.dataset.book === 'stickers') stickers.open();
      else guide.open();
    });
  }

  renderTools();
  return hud;
}
