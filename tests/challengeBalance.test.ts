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
import { lavaPreview } from '../src/sim/systems/eruption';
import type { SpeciesId } from '../src/sim/data/species';

/** Moves a dinosaur into the paddock at (x, y) with room, or returns false. */
function moveInto(s: GameState, dinoId: number, px: number, py: number): boolean {
  const regions = computeRegions(s);
  const w = s.map.width;
  const region = regions.regions[regions.tileRegion[py * w + px]];
  if (!region) return false;
  for (const i of region.tiles) {
    if (s.dinos.some((d) => d.y * w + d.x === i) || s.feeders.some((f) => f.y * w + f.x === i)) continue;
    if (applyCommand(s, { type: 'moveDino', id: dinoId, x: i % w, y: Math.floor(i / w) }).ok) return true;
  }
  return false;
}

/** Buys a cheap dinosaur into any paddock with room (one a call). */
function buyOne(s: GameState, species: SpeciesId): void {
  const regions = computeRegions(s);
  const w = s.map.width;
  for (const r of regions.regions.filter((o) => o.kind === 'paddock')) {
    if (s.dinos.filter((d) => regions.tileRegion[d.y * w + d.x] === r.id).length >= 4) continue;
    if (!s.feeders.some((f) => regions.tileRegion[f.y * w + f.x] === r.id)) continue; // nothing to eat there
    const tile = r.tiles.find((i) => !s.feeders.some((f) => f.y * w + f.x === i) && !s.dinos.some((d) => d.y * w + d.x === i));
    if (tile !== undefined && applyCommand(s, { type: 'buyDino', species, x: tile % w, y: Math.floor(tile / w) }).ok) return;
  }
}

function play(s: GameState, days: number, each?: (s: GameState) => void) {
  const sim = new Simulation(s);
  const events: string[] = [];
  sim.onEvent((e) => { if (e.outcome || /helicopter|died|starved|caught/.test(e.text)) events.push(`day ${calendar(s).day} h${calendar(s).hour}: ${e.text}`); });
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
it('Fire Mountain: doing nothing loses dinosaurs to the lava; moving them to safety wins', () => {
  for (const mode of ['do nothing', 'sensible']) {
    const s = newPark('fire-mountain', 1);
    if (mode === 'sensible') {
      const danger = lavaPreview(s);
      const w = s.map.width;
      // The empty bottom-right paddock is safe (and so is the bottom-left one).
      const safe = [
        { x: s.entrance.x + 6, y: s.entrance.y - 4 },
        { x: s.entrance.x - 6, y: s.entrance.y - 4 },
      ];
      // Everyone in a paddock the lava will reach moves out (their feeders and fences will burn too).
      const regions = computeRegions(s);
      const threatened = new Set([...danger].map((i) => regions.tileRegion[i]));
      for (const d of s.dinos.filter((o) => threatened.has(regions.tileRegion[o.y * w + o.x]))) {
        if (!safe.some((p) => moveInto(s, d.id, p.x, p.y))) throw new Error('nowhere safe');
      }
      applyCommand(s, { type: 'hireStaff', role: 'worker' });
      applyCommand(s, { type: 'hireStaff', role: 'vet' });
      // More mouths in the safe paddocks: a second feeder each.
      for (const p of safe)
        for (const [dx, dy] of [[2, 1], [-2, 1], [1, -1], [-1, -1]])
          if (applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: p.x + dx, y: p.y + dy }).ok) break;
    }
    const ev = play(s, 45, (st) => {
      if (mode !== 'sensible') return;
      const { day, hour } = calendar(st);
      if (st.eruption?.stage === 'erupting' && hour === 9) applyCommand(st, { type: 'closePark' });
      // Keep anything the lava is still heading for out of the way.
      if (st.eruption && st.eruption.stage !== 'over') {
        const danger = lavaPreview(st);
        const w = st.map.width;
        for (const d of st.dinos.filter((o) => danger.has(o.y * w + o.x))) moveInto(st, d.id, st.entrance.x + 6, st.entrance.y - 4);
      }
      if (st.eruption?.stage === 'over' && hour === 10 && st.money > 20000 && day > 0) {
        buyOne(st, st.dinos.length % 2 ? 'parasaurolophus' : 'protoceratops');
        applyCommand(st, { type: 'setTicketPrice', price: Math.round(fairPrice(parkAppeal(st, computeRegions(st)))) });
      }
    });
    if (mode === 'sensible') {
      expect(ev.filter((e) => /helicopter|died|starved|caught/.test(e))).toEqual([]);
      expect(s.stats.dinosLost).toBe(0);
      expect(s.scenario.round).toBeGreaterThanOrEqual(1);
    } else {
      expect(s.stats.dinosLost).toBeGreaterThan(0);
      expect(s.scenario.round).toBe(0);
    }
  }
}, 600000);
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
