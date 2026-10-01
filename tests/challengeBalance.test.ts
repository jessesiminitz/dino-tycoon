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
import { allFenceEdges, fenceHp } from '../src/sim/fences';
import { SPECIES } from '../src/sim/data/species';
import { isTileOwned, parcelBuyBlocker, parcelGrid, PARCEL } from '../src/sim/land';
import { isBuildable } from '../src/sim/terrain';
import { boxEdges } from '../src/sim/grid';
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
function buyOne(s: GameState, species: SpeciesId, perPaddock = 4): void {
  const regions = computeRegions(s);
  const w = s.map.width;
  for (const r of regions.regions.filter((o) => o.kind === 'paddock')) {
    if (s.dinos.filter((d) => regions.tileRegion[d.y * w + d.x] === r.id).length >= perPaddock) continue;
    if (!s.feeders.some((f) => regions.tileRegion[f.y * w + f.x] === r.id)) continue; // nothing to eat there
    const tile = r.tiles.find((i) => !s.feeders.some((f) => f.y * w + f.x === i) && !s.dinos.some((d) => d.y * w + d.x === i));
    if (tile !== undefined && applyCommand(s, { type: 'buyDino', species, x: tile % w, y: Math.floor(tile / w) }).ok) return;
  }
}

/** Buys into a paddock with the right food and room to spare (by the game's own space rule). */
function buyRoomy(s: GameState, species: SpeciesId): boolean {
  const regions = computeRegions(s); const w = s.map.width; const sp = SPECIES[species];
  const food = sp.diet === 'herbivore' ? 'plants' : 'meat';
  for (const r of regions.regions.filter((o) => o.kind === 'paddock')) {
    const feeders = s.feeders.filter((f) => regions.tileRegion[f.y * w + f.x] === r.id);
    if (!feeders.length || feeders.some((f) => f.kind !== food)) continue;
    const here = s.dinos.filter((d) => regions.tileRegion[d.y * w + d.x] === r.id);
    if (here.reduce((a, d) => a + SPECIES[d.species].space, 0) + sp.space > r.tiles.length) continue;
    const tile = r.tiles.find((i) => !s.feeders.some((f) => f.y * w + f.x === i) && !s.dinos.some((d) => d.y * w + d.x === i));
    if (tile !== undefined && applyCommand(s, { type: 'buyDino', species, x: tile % w, y: Math.floor(tile / w) }).ok) return true;
  }
  return false;
}
/** Fences a new W×H paddock on clear, owned, buildable land near the gate, with a feeder. */
function newPaddock(s: GameState, W: number, H: number, fence: 1 | 2 | 3 | 4, kind: 'plants' | 'meat', anywhere = false): boolean {
  const w = s.map.width; const { x: ex, y: ey } = s.entrance;
  const regions = computeRegions(s);
  const spots: { x: number; y: number; d: number }[] = [];
  for (let y = 1; y < s.map.height - H - 1; y++) for (let x = 1; x < w - W - 1; x++) spots.push({ x, y, d: Math.abs(x - ex) + Math.abs(y - ey) });
  spots.sort((a, b) => a.d - b.d);
  for (const { x, y } of spots) {
    let clear = true;
    for (let yy = y; yy < y + H && clear; yy++) for (let xx = x; xx < x + W && clear; xx++) {
      const i = yy * w + xx;
      clear = isTileOwned(s, xx, yy) && isBuildable(s.map.tiles[i]) && !s.paths[i] && !s.tracks[i] && regions.regions[regions.tileRegion[i]]?.kind === 'public'
        && !s.buildings.some((b) => b.x === xx && b.y === yy) && !s.decor.some((d) => d.x === xx && d.y === yy);
    }
    if (!clear) continue;
    // Next to a path, so visitors can see in.
    let byPath = false;
    for (let xx = x - 1; xx <= x + W; xx++) for (const yy of [y - 1, y + H]) if (s.paths[yy * w + xx]) byPath = true;
    for (let yy = y; yy < y + H; yy++) for (const xx of [x - 1, x + W]) if (s.paths[yy * w + xx]) byPath = true;
    if (!byPath && !anywhere) continue;
    if (!applyCommand(s, { type: 'buildFences', edges: boxEdges(x, y, x + W, y + H), fence }).ok) continue;
    applyCommand(s, { type: 'placeFeeder', kind, x: x + 1, y: y + 1 });
    return true;
  }
  return false;
}

/** Buys the owned-land-adjacent parcel nearest the gate. */
function buyLand(s: GameState): boolean {
  const { cols, rows } = parcelGrid(s.map); const { x: ex, y: ey } = s.entrance;
  const options: { px: number; py: number; d: number }[] = [];
  for (let py = 0; py < rows; py++) for (let px = 0; px < cols; px++)
    if (!parcelBuyBlocker(s, px, py)) options.push({ px, py, d: Math.abs(px * PARCEL + 4 - ex) + Math.abs(py * PARCEL + 4 - ey) });
  options.sort((a, b) => a.d - b.d);
  return options.some((o) => applyCommand(s, { type: 'buyParcel', px: o.px, py: o.py }).ok);
}

function play(s: GameState, days: number, each?: (s: GameState) => void) {
  const sim = new Simulation(s);
  const events: string[] = [];
  sim.onEvent((e) => { if (e.outcome || /helicopter|died|starved|caught|chill|escaped|Outbreak/.test(e.text)) events.push(`day ${calendar(s).day} h${calendar(s).hour}: ${e.text}`); });
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
it('Fire Mountain: doing nothing loses dinosaurs to the lava; saving them earns Bronze; rebuilding and growing wins Gold', () => {
  for (const mode of ['do nothing', 'evacuate only', 'sensible']) {
    const s = newPark('fire-mountain', 1);
    if (mode !== 'do nothing') {
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
    let rebuilt = false;
    const ev = play(s, 45, (st) => {
      if (mode === 'do nothing') return;
      const { day, hour } = calendar(st);
      if (st.eruption?.stage === 'erupting' && hour === 9) applyCommand(st, { type: 'closePark' });
      // Keep anything the lava is still heading for out of the way.
      if (st.eruption && st.eruption.stage !== 'over') {
        const danger = lavaPreview(st);
        const w = st.map.width;
        for (const d of st.dinos.filter((o) => danger.has(o.y * w + o.x))) moveInto(st, d.id, st.entrance.x + 6, st.entrance.y - 4);
      }
      // Afterwards: rebuild on the cooled rock, keep the fences mended, add an allosaurus once it's
      // unlocked, and grow the herds, buying land for new paddocks when there's no room left.
      if (mode === 'sensible' && st.eruption?.stage === 'over' && hour === 10 && day > 0) {
        if (!rebuilt) {
          rebuilt = true;
          const { x, y } = st.entrance;
          applyCommand(st, { type: 'buildFences', edges: boxEdges(x - 12, y - 16, x, y - 8), fence: 1 });
          applyCommand(st, { type: 'buildFences', edges: boxEdges(x + 1, y - 16, x + 13, y - 8), fence: 3 });
          for (const dx of [0, 1, -1, 2]) if (applyCommand(st, { type: 'placeFeeder', kind: 'plants', x: x - 6 + dx, y: y - 12 }).ok) break;
          for (const dx of [0, 1, -1, 2]) if (applyCommand(st, { type: 'placeFeeder', kind: 'meat', x: x + 7 + dx, y: y - 12 }).ok) break;
        }
        for (const e of allFenceEdges(st)) if (fenceHp(st, e) < 60) applyCommand(st, { type: 'repairFence', edge: e });
        if (st.unlockedSpecies.includes('allosaurus') && !st.dinos.some((d) => d.species === 'allosaurus') && st.money > 30000) buyRoomy(st, 'allosaurus');
        for (let k = 0; k < 3 && st.money > 15000; k++) {
          const sp: SpeciesId = st.dinos.length % 2 ? 'parasaurolophus' : 'protoceratops';
          if (!buyRoomy(st, sp) && st.money > 25000 && !newPaddock(st, 8, 6, 1, 'plants') && !newPaddock(st, 8, 6, 1, 'plants', true)) buyLand(st);
        }
        applyCommand(st, { type: 'setTicketPrice', price: Math.round(fairPrice(parkAppeal(st, computeRegions(st)))) });
      }
    });
    if (mode === 'sensible') {
      expect(ev.filter((e) => /helicopter|died|starved|caught/.test(e))).toEqual([]);
      expect(s.stats.dinosLost).toBe(0);
      expect(s.scenario.status).toBe('won');
    } else if (mode === 'evacuate only') {
      // Saving everyone is Bronze; Silver needs the burned paddocks rebuilt and restocked.
      expect(s.stats.dinosLost).toBe(0);
      expect(s.scenario.round).toBe(1);
    } else {
      expect(s.stats.dinosLost).toBeGreaterThan(0);
      expect(s.scenario.round).toBe(0);
    }
  }
}, 600000);
it('Flood Season: doing nothing leaves dinosaurs in the water; high ground, sandbags, a pump and a vet win Gold', () => {
  for (const mode of ['do nothing', 'sensible']) {
    const s = newPark('flood-season', 1);
    if (mode === 'sensible') {
      const { x, y } = s.entrance;
      applyCommand(s, { type: 'hireStaff', role: 'vet' });
      applyCommand(s, { type: 'hireStaff', role: 'guard' });
      // Sandbags along both banks, leaving the bridge path open, and a pump house by the bridge.
      const edges = [];
      for (let dx = -13; dx <= 13; dx++) if (dx !== 0) edges.push({ dir: 'h' as const, x: x + dx, y: y - 12 }, { dir: 'h' as const, x: x + dx, y: y - 10 });
      expect(applyCommand(s, { type: 'buildFences', edges, fence: 6 }).ok).toBe(true);
      expect(applyCommand(s, { type: 'placeBuilding', kind: 'pump', x: x + 1, y: y - 14 }).ok).toBe(true);
    }
    const ev = play(s, 40, (st) => {
      if (mode !== 'sensible') return;
      const { hour } = calendar(st);
      if (hour === 10 && st.money > 20000 && st.flood!.survived >= 3) {
        buyOne(st, st.dinos.length % 2 ? 'parasaurolophus' : 'protoceratops');
        applyCommand(st, { type: 'setTicketPrice', price: Math.round(fairPrice(parkAppeal(st, computeRegions(st)))) });
      }
    });
    if (mode === 'sensible') {
      expect(ev.filter((e) => /died|starved|caught|helicopter/.test(e))).toEqual([]);
      expect(s.stats.dinosLost).toBe(0);
      expect(s.scenario.status).toBe('won');
    } else {
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
