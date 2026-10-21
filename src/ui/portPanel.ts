import type { Simulation } from '../sim/Simulation';
import type { Command } from '../sim/commands';
import { ferryUpgradePrice } from '../sim/commands';
import { FERRY_SIZES, FERRY_TRADE_IN, FERRY_TYPES, PORT_LEVELS, type FerrySize } from '../sim/data/port';
import { LAST_ENTRY_HOUR, OPEN_HOUR } from '../sim/data/economy';
import { ferryCapacity, fitsPort, portUpkeep } from '../sim/port';
import { currentSeason, seasonalDemand, SEASON_INFO, yearDay } from '../sim/seasons';
import { expectedArrivals } from '../sim/systems/visitors';
import { formatMoney } from './hud';

const FERRY_ICONS: Record<FerrySize, string> = { small: '🚤', medium: '⛴️', large: '🛳️' };
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** How busy the season is, in a word. */
export function seasonCrowds(state: Simulation['state']): string {
  const f = seasonalDemand(yearDay(state));
  return f > 1.1 ? 'busy season' : f < 0.9 ? 'quiet season' : 'normal crowds';
}

/** Park report → Port: the ferries that bring every visitor, and upgrades for them. */
export function portTab(sim: Simulation): string {
  const { state } = sim;
  const { port } = state;
  const level = PORT_LEVELS[port.level];
  const next = PORT_LEVELS[port.level + 1];
  const seats = ferryCapacity(port);
  const wanted = expectedArrivals(state, sim.regions());
  const { season } = currentSeason(state);
  const freeBerth = port.ferries.length < level.berths;
  const advice =
    wanted > seats
      ? `⚠️ About <b>${Math.round(wanted)}</b> people want to come each hour, but the ferries seat <b>${seats}</b>. Add a ferry or a bigger boat, or charge a little more for tickets.`
      : `👍 About <b>${Math.round(wanted)}</b> people want to come each hour, and the ferries seat <b>${seats}</b>: room for everyone right now.`;

  const ferries = port.ferries
    .map((size, i) => {
      const t = FERRY_TYPES[size];
      const bigger = FERRY_SIZES[FERRY_SIZES.indexOf(size) + 1];
      const trade = bigger
        ? fitsPort(port.level, bigger)
          ? `<button class="action-btn" data-ferry-up="${i}" ${ferryUpgradePrice(size, bigger) > state.money ? 'disabled' : ''}>Trade up to ${FERRY_TYPES[bigger].name.toLowerCase()} · ${formatMoney(ferryUpgradePrice(size, bigger))}</button>`
          : `<span class="note">A ${FERRY_TYPES[bigger].name.toLowerCase()} needs a bigger port</span>`
        : '';
      const sell = port.ferries.length > 1 ? `<button class="action-btn secondary" data-ferry-sell="${i}">Sell ${formatMoney(Math.floor(t.cost * FERRY_TRADE_IN))}</button>` : '';
      return `<li class="loan ferry-row">
          <span>${FERRY_ICONS[size]} <b>${t.name}</b> · ${t.seats} seats · ${formatMoney(t.upkeep)}/day</span>
          <span class="ferry-actions">${trade}${sell}</span>
        </li>`;
    })
    .join('');

  const buy = FERRY_SIZES.map((size) => {
    const t = FERRY_TYPES[size];
    const fits = fitsPort(port.level, size);
    return `<button class="action-btn" data-ferry-buy="${size}" ${!freeBerth || !fits || t.cost > state.money ? 'disabled' : ''}>
        ${FERRY_ICONS[size]} ${t.name} · ${t.seats} seats · ${formatMoney(t.cost)}${fits ? '' : ' (bigger port)'}</button>`;
  }).join('');

  return `
    <div class="stat-grid">
      <div class="stat"><span class="stat-label">Ferry seats an hour</span><span class="stat-value">${seats}</span></div>
      <div class="stat"><span class="stat-label">Want to come an hour</span><span class="stat-value">${Math.round(wanted)}</span></div>
      <div class="stat"><span class="stat-label">No seat today</span><span class="stat-value">${port.turnedAway}</span></div>
      <div class="stat"><span class="stat-label">Season</span><span class="stat-value">${SEASON_INFO[season].icon} <small>${seasonCrowds(state)}</small></span></div>
    </div>
    <p class="note">${advice}</p>
    <section class="panel-section">
      <h3>⚓ Your port: ${level.name}</h3>
      <p class="note">${level.description} Berths used: <b>${port.ferries.length}/${level.berths}</b> · running costs <b>${formatMoney(portUpkeep(port))}</b> a day.</p>
      ${
        next
          ? `<button class="action-btn" data-port-up ${next.cost > state.money ? 'disabled' : ''}>Build a ${next.name.toLowerCase()} · ${formatMoney(next.cost)}</button>
             <p class="note">${next.description}</p>`
          : '<p class="note">🏆 The biggest port there is.</p>'
      }
    </section>
    <section class="panel-section">
      <h3>⛴️ Your ferries</h3>
      <ul class="loans">${ferries}</ul>
      <h3>Buy a ferry</h3>
      ${freeBerth ? '' : `<p class="note">Every berth is taken.${next ? ` Build a ${next.name.toLowerCase()} to run more ferries.` : ''}</p>`}
      <div class="loan-offers">${buy}</div>
    </section>
    <p class="note">Each ferry makes one trip an hour while the gates are open (${hh(OPEN_HOUR)}–${hh(LAST_ENTRY_HOUR)}).
      Summer brings the biggest crowds and winter the smallest. Last day: <b>${port.lastTurnedAway}</b> people couldn’t get a seat.</p>`;
}

/** The command for a tapped Port button, or null. */
export function portCommand(el: HTMLElement): Command | null {
  const d = el.dataset;
  if ('portUp' in d) return { type: 'upgradePort' };
  if (d.ferryBuy) return { type: 'buyFerry', size: d.ferryBuy as FerrySize };
  if (d.ferryUp) return { type: 'upgradeFerry', index: Number(d.ferryUp) };
  if (d.ferrySell) return { type: 'sellFerry', index: Number(d.ferrySell) };
  return null;
}

export const PORT_BUTTONS = '[data-port-up],[data-ferry-buy],[data-ferry-up],[data-ferry-sell]';
