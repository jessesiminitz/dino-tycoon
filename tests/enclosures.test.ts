import { describe, expect, it } from 'vitest';
import { startScenario } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import type { Edge } from '../src/sim/grid';
import { computeRegions, isOccupiedPaddock } from '../src/sim/regions';

/**
 * Regression for a reported bug: on the First Steps island, a paddock drawn
 * right against the beach leaves a strip of sand sealed off by fence and sea.
 * That strip counted as a paddock, so paths there were refused and the
 * tutorial couldn't continue.
 */
function beachPaddock() {
  const s = startScenario('first-steps', 1);
  const edges: Edge[] = [];
  const [x0, y0, x1, y1] = [20, 38, 28, 43];
  for (let x = x0; x < x1; x++) edges.push({ dir: 'h', x, y: y0 }, { dir: 'h', x, y: y1 });
  for (let y = y0; y < y1; y++) edges.push({ dir: 'v', x: x0, y }, { dir: 'v', x: x1, y });
  expect(applyCommand(s, { type: 'buildFences', edges, fence: 1 }).ok).toBe(true);
  applyCommand(s, { type: 'placeFeeder', kind: 'plants', x: 24, y: 40 });
  applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: 23, y: 40 });
  expect(s.dinos).toHaveLength(1);
  const w = s.map.width;
  const regions = computeRegions(s);
  // The sealed-off beach tiles below the box.
  const strip = regions.regions
    .filter((r) => r.kind === 'paddock')
    .flatMap((r) => r.tiles)
    .filter((i) => Math.floor(i / w) >= 43);
  expect(strip.length).toBeGreaterThan(0);
  return { s, w, strip, regions };
}

describe('enclosed pockets of land', () => {
  it('a sealed-off strip of beach with no animals is not treated as a paddock', () => {
    const { s, strip, regions } = beachPaddock();
    for (const i of strip) expect(isOccupiedPaddock(s, regions, i)).toBe(false);
    const r = applyCommand(s, { type: 'buildPaths', tiles: strip });
    expect(r.ok).toBe(true);
    expect(r.message).not.toMatch(/skipped/);
  });

  it('paths are still refused inside a paddock with animals', () => {
    const { s, w } = beachPaddock();
    const r = applyCommand(s, { type: 'buildPaths', tiles: [40 * w + 22] });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/animals or feeders/);
  });

  it('releasing a dinosaur clears any paths left inside its paddock (refunded)', () => {
    // Reported trap: a path laid into an empty enclosure used to block releasing a dino there,
    // and paths couldn't be removed with the Remove tool.
    const { s, strip } = beachPaddock();
    applyCommand(s, { type: 'buildPaths', tiles: strip });
    const w = s.map.width;
    const before = s.money;
    const r = applyCommand(s, { type: 'buyDino', species: 'protoceratops', x: strip[0] % w, y: Math.floor(strip[0] / w) });
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/cleared \d+ path tile/);
    for (const i of strip) expect(s.paths[i]).toBe(0);
    expect(s.money).toBe(before - 3000 + Math.floor(strip.length * 10 * 0.25));
  });
});
