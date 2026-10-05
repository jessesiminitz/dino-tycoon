import { describe, expect, it } from 'vitest';
import { migrate, newGame, SAVE_VERSION, startScenario } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { EXPANSION_SPECIES_IDS, SPECIES, SPECIES_IDS, STARTER_SPECIES } from '../src/sim/data/species';
import { pathEdges } from '../src/sim/grid';
import { parcelGrid } from '../src/sim/land';
import { computeRegions } from '../src/sim/regions';
import { Rng } from '../src/sim/rng';
import { hourlyFossils, lockedSpecies } from '../src/sim/systems/fossils';
import type { GameEvent, SimContext } from '../src/sim/systems/context';
import { Terrain } from '../src/sim/terrain';

function park() {
  const s = newGame(31), width = 24, height = 20;
  s.map = { width, height, tiles: new Array(width * height).fill(Terrain.Grass), heights: new Array(width * height).fill(5), shape: 'classic' };
  s.entrance = { x: 0, y: height - 1 };
  const { cols, rows } = parcelGrid(s.map);
  s.parcelsOwned = new Array(cols * rows).fill(true);
  s.paths = new Array(width * height).fill(0);
  s.tracks = new Array(width * height).fill(0);
  s.hFences = new Array(width * (height + 1)).fill(0);
  s.vFences = new Array((width + 1) * height).fill(0);
  s.hFenceHp = [...s.hFences]; s.vFenceHp = [...s.vFences];
  s.money = 1_000_000;
  expect(applyCommand(s, { type: 'buildFences', fence: 4, edges: [...pathEdges(2, 2, 22, 18, true), ...pathEdges(2, 2, 22, 18, false)] }).ok).toBe(true);
  return s;
}

describe('twelve new dinosaurs', () => {
  it('adds sandbox choices while preserving the six campaign starters', () => {
    expect(EXPANSION_SPECIES_IDS).toHaveLength(12);
    const sandbox = startScenario('sandbox', 7);
    expect(sandbox.unlockedSpecies).toEqual(SPECIES_IDS);
    expect(newGame(7).unlockedSpecies).toEqual(STARTER_SPECIES);
    for (const id of EXPANSION_SPECIES_IDS) expect(SPECIES[id].starter).toBe(false);
  });

  it('allows all twelve to be bought in land paddocks and charges their catalog prices', () => {
    const s = park(); s.unlockedSpecies = [...SPECIES_IDS];
    const before = s.money;
    for (const [i, species] of EXPANSION_SPECIES_IDS.entries()) {
      expect(applyCommand(s, { type: 'buyDino', species, x: 4 + i % 6, y: 4 + Math.floor(i / 6) }).ok, species).toBe(true);
    }
    expect(s.dinos.map(d => d.species)).toEqual([...EXPANSION_SPECIES_IDS]);
    expect(s.money).toBe(before - EXPANSION_SPECIES_IDS.reduce((sum, id) => sum + SPECIES[id].price, 0));
    expect(SPECIES.spinosaurus.diet).toBe('piscivore');
  });

  it('unlocks each addition through the existing fossil find and completion flow', () => {
    for (const species of EXPANSION_SPECIES_IDS) {
      const s = park();
      s.unlockedSpecies = SPECIES_IDS.filter(id => id !== species);
      s.fossils[species] = SPECIES[species].fossilsNeeded - 1;
      s.fossilBeds = [{ x: 20, y: 8, radius: 2, richness: 3 }];
      expect(applyCommand(s, { type: 'placeBuilding', kind: 'digsite', x: 20, y: 8 }).ok).toBe(true);
      s.hours = 16;
      const events: GameEvent[] = [];
      const ctx: SimContext = { state: s, rng: new Rng(1), regions: computeRegions(s), emit: event => events.push(event), invalidateWorld() {} };
      for (let night = 0; night < 100 && lockedSpecies(s).includes(species); night++) hourlyFossils(ctx);
      expect(s.unlockedSpecies, species).toContain(species);
      expect(events.some(e => e.fossil?.species === species && e.fossil.unlocked), species).toBe(true);
      expect(applyCommand(s, { type: 'buyDino', species, x: 4, y: 4 }).ok, species).toBe(true);
    }
  });

  it('loads old v21 rosters and round-trips the new animals without a schema change', () => {
    const before = newGame(7);
    const legacy = JSON.parse(JSON.stringify(before));
    expect(migrate(legacy)?.unlockedSpecies).toEqual(before.unlockedSpecies);
    const s = park(); s.unlockedSpecies = [...SPECIES_IDS];
    for (const species of EXPANSION_SPECIES_IDS) expect(applyCommand(s, { type: 'buyDino', species, x: 4, y: 4 }).ok).toBe(true);
    const restored = migrate(JSON.parse(JSON.stringify(s)));
    expect(SAVE_VERSION).toBe(21);
    expect(restored?.dinos).toEqual(s.dinos);
    expect(restored?.unlockedSpecies).toEqual(s.unlockedSpecies);
  });
});
