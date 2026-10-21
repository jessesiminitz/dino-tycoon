import { calendar } from '../GameState';
import { FERRY_TYPES } from '../data/port';
import { dockStep, ferryCapacity, LANDING_STEPS } from '../port';
import type { SimContext } from './context';
import { admitVisitors } from './visitors';

/** Turned-away visitors in a day before the park hears about it. */
const FULL_FERRY_NEWS = 8;
const FULL_FERRY_NEWS_HOUR = 19;

/**
 * This hour's visitors board the ferries: seats are filled ferry by ferry in
 * turn, so every boat carries some of the crowd. Anyone without a seat stays
 * home (counted, so the park hears its ferries are too small).
 */
export function boardFerries(ctx: SimContext, wanted: number): void {
  const { port } = ctx.state;
  const seats = port.ferries.map((f) => FERRY_TYPES[f].seats);
  const riding = Math.min(wanted, ferryCapacity(port));
  port.turnedAway += wanted - riding;
  port.aboard = seats.map(() => 0);
  for (let left = riding, k = 0; left > 0; k = (k + 1) % seats.length) {
    if (port.aboard[k] < seats[k]) {
      port.aboard[k]++;
      left--;
    }
  }
  port.loads = [...port.aboard];
}

/** Every step: passengers from a ferry that docked LANDING_STEPS ago reach the gate. */
export function landFerries(ctx: SimContext): void {
  const { state } = ctx;
  const { port } = state;
  const { day, hour } = calendar(state);
  for (let k = 0; k < port.aboard.length; k++) {
    if (!port.aboard[k] || state.stepInHour !== dockStep(k, port.ferries.length) + LANDING_STEPS) continue;
    // Closed early: the ferry takes its passengers straight back.
    if (state.stats.closedDay !== day) admitVisitors(ctx, port.aboard[k]);
    port.aboard[k] = 0;
  }
  if (hour === FULL_FERRY_NEWS_HOUR && state.stepInHour === 0 && port.turnedAway > 0) {
    if (port.turnedAway >= FULL_FERRY_NEWS)
      ctx.emit({
        text: `⛴️ The ferries were full today: ${port.turnedAway} visitors couldn't get a seat. Add a ferry or a bigger boat at the Port (Park report → Port).`,
        kind: 'bad',
      });
    port.lastTurnedAway = port.turnedAway;
    port.turnedAway = 0;
  }
}
