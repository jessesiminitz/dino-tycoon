import { calendar, type GameState } from '../sim/GameState';
import type { Simulation, Speed } from '../sim/Simulation';
import { FENCE_TYPE_IDS, FENCE_TYPES } from '../sim/data/fences';
import type { Mode, UiState } from './uiState';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const formatMoney = (n: number) => money.format(n);

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

const MODE_HINTS: Record<Mode, string | null> = {
  select: null,
  fence: 'Drag to draw a fence · two fingers to move the map',
  demolish: 'Drag along fences or tap one to remove it',
  land: 'Tap a highlighted plot to buy it',
};

/** DOM overlay: money, clock, speed buttons, tool bar, info panel and toasts. */
export function mountHud(sim: Simulation, ui: UiState): Hud {
  const moneyEl = $('hud-money');
  const clockEl = $('hud-clock');
  const info = $('info');
  const infoText = $('info-text');
  const infoAction = $('info-action') as HTMLButtonElement;
  const toastEl = $('toast');
  const picker = $('fence-picker');
  const speedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.speed-btn'));
  const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tool-btn'));

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
    const b = document.createElement('button');
    b.className = 'pick-btn';
    b.dataset.fence = String(id);
    b.innerHTML = `<span class="swatch" style="background:#${t.rail.toString(16).padStart(6, '0')}"></span>${t.name}<small>$${t.cost}</small>`;
    b.addEventListener('click', () => ui.setFenceType(id));
    picker.appendChild(b);
  }
  for (const b of toolButtons) {
    // Tapping the active tool again goes back to Look.
    b.addEventListener('click', () => ui.setMode(ui.mode === b.dataset.mode ? 'select' : (b.dataset.mode as Mode)));
  }

  let prevMode: Mode = ui.mode;
  const renderTools = () => {
    for (const b of toolButtons) b.classList.toggle('active', b.dataset.mode === ui.mode);
    picker.classList.toggle('hidden', ui.mode !== 'fence');
    for (const b of picker.querySelectorAll<HTMLButtonElement>('.pick-btn'))
      b.classList.toggle('active', Number(b.dataset.fence) === ui.fenceType);
    if (ui.mode !== prevMode) {
      hud.showHint();
      prevMode = ui.mode;
    }
  };
  ui.onChange(renderTools);

  // --- info panel & toasts ---
  let toastTimer: number | undefined;
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
      hud.showInfo(MODE_HINTS[ui.mode]);
    },
    toast(text, kind = 'ok') {
      toastEl.textContent = text;
      toastEl.className = `toast ${kind}`;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toastEl.classList.add('hidden'), 2600);
    },
  };

  renderTools();
  return hud;
}
