import { calendar, type GameState } from '../sim/GameState';
import type { Simulation, Speed } from '../sim/Simulation';
import type { TileInfo } from '../render/ParkScene';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

/** DOM overlay: money, clock, speed buttons and the tapped-tile info panel. */
export function mountHud(sim: Simulation): { showTile: (info: TileInfo | null) => void } {
  const moneyEl = $('hud-money');
  const clockEl = $('hud-clock');
  const info = $('info');
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.speed-btn'));

  const render = (state: GameState) => {
    moneyEl.textContent = money.format(state.money);
    const { day, hour } = calendar(state);
    clockEl.textContent = `Day ${day} · ${String(hour).padStart(2, '0')}:00`;
    for (const b of buttons) b.classList.toggle('active', Number(b.dataset.speed) === sim.speed);
  };

  for (const b of buttons) {
    b.addEventListener('click', () => sim.setSpeed(Number(b.dataset.speed) as Speed));
  }

  sim.onChange(render);
  render(sim.state);

  return {
    showTile(tile) {
      if (!tile) {
        info.classList.add('hidden');
        return;
      }
      info.textContent = `${tile.label} · (${tile.x}, ${tile.y})`;
      info.classList.remove('hidden');
    },
  };
}
