import { computeRegions } from './regions';
import { startScenario, type GameState, type IslandOptions } from './GameState';
import type { ScenarioId } from './data/scenarios';
import { ParkBuilder } from './parkBuilder';
import { isLand } from './terrain';

/**
 * The Great Escape: a tidy little park where last night's storm broke the
 * fences. Every dinosaur is out wandering, fences are battered, and there's
 * one guard. Round everyone up (guards), mend the fences (workers).
 */
function greatEscape(b: ParkBuilder): void {
  b.prepare(-13, -15, 13, -1);
  b.path([0, -1], [0, -14]);
  b.path([-12, -7], [12, -7]);
  // Paddocks right against the paths, so visitors can see in.
  b.paddock(-12, -14, 0, -7, 1);
  b.paddock(1, -14, 13, -7, 2);
  b.paddock(-12, -6, -2, -1, 1);
  b.paddock(2, -6, 11, -1, 4);
  for (const [x, y] of [[-10, -12], [-7, -10], [-4, -12]] as const) b.dino('protoceratops', x, y);
  for (const [x, y] of [[-9, -9], [-3, -9]] as const) b.dino('parasaurolophus', x, y);
  b.dino('triceratops', 4, -11);
  b.dino('stegosaurus', 9, -10);
  for (const [x, y] of [[-10, -4], [-6, -3], [-4, -5]] as const) b.dino('protoceratops', x, y);
  b.dino('triceratops', 10, -12);
  b.dino('parasaurolophus', -5, -5);
  b.dino('velociraptor', 5, -4);
  b.dino('dilophosaurus', 8, -3);
  b.feeder('plants', -6, -11);
  b.feeder('plants', 7, -12);
  b.feeder('plants', -8, -3);
  b.feeder('meat', 9, -5);
  b.building('restaurant', -1, -5);
  b.building('restroom', -1, -3);
  b.building('giftshop', 1, -5);
  b.building('snackstall', 1, -3);
  b.building('trashcan', -1, -2);
  for (const [x, y] of [[-12, -8], [12, -8]] as const) b.decor('bench', x, y);
  b.hire('guard');
  b.hire('janitor'); // the park's only worker is off sick

  // Where each animal lives, before the storm.
  const { state } = b;
  const w = state.map.width;
  const regions = computeRegions(state);
  const inPaddock = (i: number) => regions.regions[regions.tileRegion[i]]?.kind === 'paddock';

  // The storm: every fence battered, a section of each paddock knocked flat.
  b.wearFences(20, 60);
  b.breakFences(18);

  // Everyone has wandered out onto the paths and lawns nearby.
  const outside: number[] = [];
  for (let y = 0; y < state.map.height; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const near = Math.abs(x - state.entrance.x) <= 13 && y >= state.entrance.y - 15 && y < state.entrance.y;
      if (near && isLand(state.map.tiles[i]) && !inPaddock(i) && !state.buildings.some((o) => o.x === x && o.y === y)) outside.push(i);
    }
  for (const d of state.dinos) {
    const i = outside.splice(b.rng.int(0, outside.length - 1), 1)[0];
    d.x = d.px = i % w;
    d.y = d.py = Math.floor(i / w);
    d.escaped = true;
    d.hunger = 25;
  }
  b.finish(30_000, 55);
}

/**
 * The Money Pit: a grand, sprawling park run into the ground. Most of the
 * dinosaurs were sold to pay the bank, but the rest carried on: far too many
 * staff, buildings nobody can reach, rides with no track, pricey tickets, a
 * poor reputation and $150,000 of loans.
 */
function moneyPit(b: ParkBuilder): void {
  b.prepare(-26, -28, 26, -1);
  b.path([0, -1], [0, -27]);
  b.path([-25, -9], [25, -9]);
  b.path([-25, -19], [25, -19]);
  // Two rows of four paddocks along the avenues.
  const rows: [number, number][] = [
    [-16, -9],
    [-27, -19],
  ];
  const cols: [number, number][] = [
    [-25, -13],
    [-12, 0],
    [1, 13],
    [14, 26],
  ];
  const fences = [
    [1, 1, 2, 2],
    [2, 2, 2, 1],
  ] as const;
  rows.forEach(([top, bottom], r) => cols.forEach(([left, right], c) => b.paddock(left, top, right, bottom, fences[r][c])));
  // What's left after the last owner sold off the best of the collection: five paddocks stand empty.
  for (const [x, y] of [[-23, -14], [-20, -12], [-17, -14]] as const) b.dino('protoceratops', x, y);
  for (const [x, y] of [[-10, -13], [-4, -12]] as const) b.dino('parasaurolophus', x, y);
  for (const [x, y] of [[16, -25], [21, -23]] as const) b.dino('protoceratops', x, y);
  b.dino('parasaurolophus', 19, -21);
  for (const [x, y] of [[-19, -12], [-7, -13], [6, -12], [19, -12], [-20, -23], [-7, -23], [21, -23]] as const) b.feeder('plants', x, y);


  // Buildings along the avenues: plenty of everything, some of it pointless.
  b.building('restaurant', -5, -8);
  b.building('snackstall', -8, -8);
  b.building('giftshop', 5, -8);
  b.building('restroom', 8, -8);
  for (const x of [-15, 15]) b.building('tower', x, -8);
  for (const x of [-20, 20]) b.building('petting', x, -8);
  for (const x of [-11, 11]) b.building('station', x, -8); // no jeep track anywhere
  b.building('restaurant', -6, -18);
  b.building('restroom', 6, -18);
  b.building('tower', -18, -18);
  for (const x of [-2, 2]) {
    b.building('trashcan', x, -8);
    b.building('trashcan', x, -18);
  }
  // A restaurant and a gift shop down little side paths... that were later dug up.
  b.path([-1, -4], [-2, -4]);
  b.path([1, -4], [2, -4]);
  b.building('restaurant', -3, -4);
  b.building('giftshop', 3, -4);
  b.removePath([-1, -4], [-2, -4], [1, -4], [2, -4]);
  for (const [x, y] of [[-1, -2], [1, -2], [-1, -6], [1, -6], [-24, -8], [24, -8]] as const) b.decor('fountain', x, y);

  b.hire('guide', 15);
  b.hire('janitor', 10);
  b.hire('vet', 8);
  b.hire('worker', 6);
  b.hire('guard', 6);
  b.owe(60_000);
  b.owe(60_000);
  b.owe(30_000);
  b.state.ticketPrice = 60; // more than twice what visitors think is fair: almost nobody comes
  b.wearFences(70, 100);
  b.finish(15_000, 35);
}

/**
 * Fire Mountain: a pleasant park on the slopes below a volcano that's about
 * to erupt. The top paddocks sit in the lava's path; the bottom-right one is
 * empty and safe, ready for anyone who needs moving.
 */
function fireMountain(b: ParkBuilder): void {
  b.prepare(-13, -17, 13, -1);
  // The lie of the land: an old lava gully runs from the crater down to the
  // top of the park, and the upper paddocks sit in a hollow below it.
  b.setHeight(-13, -17, 13, -1, 6);
  b.setHeight(-13, -16, 13, -8, 1);
  b.gully(0, -18, 2);
  b.path([0, -1], [0, -16]);
  b.path([-12, -8], [12, -8]);
  b.paddock(-12, -16, 0, -8, 1);
  b.paddock(1, -16, 13, -8, 2);
  b.paddock(-12, -7, -2, -1, 1);
  b.paddock(2, -7, 11, -1, 2);
  for (const [x, y] of [[-10, -14], [-7, -12], [-4, -14]] as const) b.dino('protoceratops', x, y);
  b.dino('parasaurolophus', -8, -10);
  b.dino('triceratops', 4, -13);
  b.dino('stegosaurus', 9, -11);
  b.dino('parasaurolophus', 6, -10);
  for (const [x, y] of [[-10, -4], [-6, -3]] as const) b.dino('parasaurolophus', x, y);
  b.feeder('plants', -6, -12);
  b.feeder('plants', 7, -13);
  b.feeder('plants', -8, -4);
  b.feeder('plants', 7, -4);
  b.building('restaurant', -1, -5);
  b.building('restroom', -1, -3);
  b.building('giftshop', 1, -5);
  b.building('snackstall', 1, -3);
  b.building('tower', 0, -17);
  for (const [x, y] of [[-12, -9], [12, -9]] as const) b.decor('bench', x, y);
  b.hire('worker', 2);
  b.hire('guard');
  b.hire('janitor');
  const cfg = { eruptAtHour: 54 };
  b.state.eruption = { stage: 'rumbling', eruptHour: cfg.eruptAtHour, lava: [], ashUntil: 0 };
  b.finish(40_000, 60);
}

const SETUPS: Partial<Record<ScenarioId, (b: ParkBuilder) => void>> = {
  'fire-mountain': fireMountain,
  'great-escape': greatEscape,
  'money-pit': moneyPit,
};

/** A new park for any scenario: an empty island for New Builds, or the prebuilt park for a challenge. */
export function newPark(id: ScenarioId, randomSeed: number, island: IslandOptions = {}): GameState {
  const state = startScenario(id, randomSeed, island);
  SETUPS[id]?.(new ParkBuilder(state));
  return state;
}
