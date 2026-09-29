import { describe, expect, it } from 'vitest';
import { newPark } from '../src/sim/challenges';
import { applyCommand } from '../src/sim/commands';
import { calendar, type GameState } from '../src/sim/GameState';
import { Simulation } from '../src/sim/Simulation';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';
import { fairPrice, parkAppeal } from '../src/sim/systems/visitors';
import { computeRegions } from '../src/sim/regions';
import { touchesWalkway } from '../src/sim/paths';
import { totalDebt } from '../src/sim/finance';

function play(s: GameState, days: number, each?: (s: GameState) => void) {
  const sim = new Simulation(s);
  const events: string[] = [];
  sim.onEvent((e) => { if (e.outcome) events.push(`day ${calendar(s).day}: ${e.text}`); });
  for (let h = 0; h < days * 24; h++) {
    for (let i = 0; i < STEPS_PER_HOUR; i++) sim.step();
    each?.(s);
    if (s.scenario.status !== 'playing') break;
  }
  return events;
}
/**
 * Plays each challenge twice, headless: once doing nothing, once like a
 * sensible player. Doing nothing must fail; sensible play must win.
 */
describe('challenge balance', () => {
it('The Great Escape: doing nothing fails; hiring guards and workers (and closing the gates) wins', () => {
  for (const mode of ['do nothing', 'sensible']) {
    const s = newPark('great-escape', 1);
    if (mode === 'sensible') {
      for (let k = 0; k < 3; k++) applyCommand(s, { type: 'hireStaff', role: 'guard' });
      applyCommand(s, { type: 'placeFeeder', kind: 'meat', x: s.entrance.x + 12, y: s.entrance.y - 9 });
      for (let k = 0; k < 2; k++) applyCommand(s, { type: 'hireStaff', role: 'worker' });
      applyCommand(s, { type: 'closePark' });
    }
    play(s, 30);
    if (mode === 'sensible') {
      expect(s.scenario.status).toBe('won');
      expect(s.stats.dinosLost).toBeLessThanOrEqual(2);
    } else {
      expect(s.scenario.status).toBe('lost');
      expect(s.scenario.round).toBe(0);
    }
  }
});
it('The Money Pit: doing nothing goes broke; cutting waste, fair tickets and new dinosaurs win', () => {
  for (const mode of ['do nothing', 'sensible']) {
    const s = newPark('money-pit', 1);
    if (mode === 'sensible') {
      const keep: Record<string, number> = { guide: 1, janitor: 2, vet: 2, worker: 3, guard: 1 };
      for (const role of Object.keys(keep)) {
        const staff = s.staff.filter((m) => m.role === role);
        for (const m of staff.slice(keep[role])) applyCommand(s, { type: 'fireStaff', id: m.id });
      }
      for (const b of [...s.buildings]) if ((b.kind === 'station') || !touchesWalkway(s, b.x, b.y)) applyCommand(s, { type: 'removeBuilding', id: b.id });
      applyCommand(s, { type: 'setTicketPrice', price: Math.round(fairPrice(parkAppeal(s, computeRegions(s)))) });
    }
    const ev = play(s, 120, (st) => {
      if (mode !== 'sensible') return;
      for (const l of [...st.finance.loans]) if (st.money > l.balance + 15000) applyCommand(st, { type: 'repayLoan', id: l.id });
      // Spare money goes on new dinosaurs for the empty paddocks (cheapest species, a few a day).
      if (calendar(st).hour === 9 && st.money > 25000 && st.dinos.length < 32) {
        const regions = computeRegions(st);
        const w = st.map.width;
        const paddocks = regions.regions.filter((r) => r.kind === 'paddock');
        const room = paddocks.find((r) => st.dinos.filter((d) => regions.tileRegion[d.y * w + d.x] === r.id).length < 5);
        if (room) {
          const tile = room.tiles.find((i) => !st.feeders.some((f) => f.y * w + f.x === i) && !st.dinos.some((d) => d.y * w + d.x === i))!;
          const r = applyCommand(st, { type: 'buyDino', species: st.dinos.length % 2 ? 'parasaurolophus' : 'protoceratops', x: tile % w, y: Math.floor(tile / w) });
          if (r.ok) applyCommand(st, { type: 'setTicketPrice', price: Math.round(fairPrice(parkAppeal(st, computeRegions(st)))) });
        }
      }
    });
    void ev;
    if (mode === 'sensible') {
      expect(s.scenario.status).toBe('won');
      expect(totalDebt(s)).toBe(0);
    } else {
      expect(s.scenario.status).toBe('lost');
      expect(s.scenario.round).toBe(0);
    }
  }
}, 600000);
});
