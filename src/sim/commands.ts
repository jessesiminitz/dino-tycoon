import { patDino, treatDino, type CareEffect } from './systems/care';
import { noteRequestAction } from './systems/requests';
import { answerChoice } from './systems/choices';
import { NEVER } from './GameState';
import type { GameState } from './GameState';
import { FENCE_REFUND, FENCE_TYPES, type FenceTypeId } from './data/fences';
import { fenceAt, fenceBlocker, fenceHp, fenceTypeAt, setFence, setFenceHp } from './fences';
import { REPAIR_COST_FRACTION, STAFF_NAMES, STAFF_TYPES, type StaffRole } from './data/staff';
import { DECOR_REFUND, DECOR_TYPES, type DecorKind } from './data/decor';
import { bedAt } from './fossilBeds';
import { edgeKey, type Edge } from './grid';
import { isTileOwned, parcelBuyBlocker, parcelGrid, parcelPrice } from './land';
import { DINO_NAMES, habitatOf, SPECIES, type SpeciesId } from './data/species';
import { DINO_RESALE, FEEDER_REFUND, FEEDER_TYPES, type FeederKind } from './data/feeders';
import { type RegionMap, computeRegions, isOccupiedPaddock, regionHasPaths } from './regions';
import { Rng } from './rng';
import { isBuildable, isLand, Terrain, terrainAt } from './terrain';
import { BRIDGE_COST, BUILDING_REFUND, BUILDING_TYPES, DRAIN_COST, LOAN_AMOUNTS, MAX_TICKET_PRICE, PATH_COST, PATH_REFUND, type BuildingKind, TRACK_COST } from './data/economy';
import { earn, loanBlocker, spend } from './finance';
import { pathBlocker, tileOccupant, touchesWalkway } from './paths';

export type Command =
  | { type: 'buildFences'; edges: Edge[]; fence: FenceTypeId }
  | { type: 'removeFences'; edges: Edge[] }
  | { type: 'buyParcel'; px: number; py: number }
  | { type: 'buyDino'; species: SpeciesId; x: number; y: number }
  | { type: 'sellDino'; id: number }
  | { type: 'placeFeeder'; kind: FeederKind; x: number; y: number }
  | { type: 'removeFeeder'; id: number }
  | { type: 'refillFeeder'; id: number }
  | { type: 'buildPaths'; tiles: number[] }
  | { type: 'removePaths'; tiles: number[] }
  | { type: 'placeBuilding'; kind: BuildingKind; x: number; y: number }
  | { type: 'removeBuilding'; id: number }
  | { type: 'setTicketPrice'; price: number }
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; id: number }
  | { type: 'hireStaff'; role: StaffRole }
  | { type: 'fireStaff'; id: number }
  | { type: 'repairFence'; edge: Edge }
  | { type: 'placeDecor'; kind: DecorKind; x: number; y: number }
  | { type: 'removeDecor'; id: number }
  | { type: 'rename'; kind: 'visitor' | 'dino' | 'staff'; id: number; name: string }
  | { type: 'buildTracks'; tiles: number[] }
  | { type: 'removeTracks'; tiles: number[] }
  | { type: 'digPonds'; tiles: number[] }
  | { type: 'fillPonds'; tiles: number[] }
  | { type: 'drainMarsh'; tiles: number[] }
  | { type: 'chooseOption'; option: number }
  | { type: 'treatDino'; id: number }
  | { type: 'patDino'; id: number }
  | { type: 'photoDino'; id: number };

export type CommandResult =
  | { ok: true; message: string; cost: number; /** How the animal reacted, for the park view. */ effect?: CareEffect }
  | { ok: false; message: string };

export const MAX_NAME = 20;

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

function uniqueEdges(edges: Edge[]): Edge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const k = edgeKey(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** What a fence build would do, without changing anything. Used for the drag preview. */
export function planFences(state: GameState, edges: Edge[], fence: FenceTypeId) {
  const build: Edge[] = [];
  let blocked = 0;
  let blockReason = '';
  for (const e of uniqueEdges(edges)) {
    const reason = fenceBlocker(state, e);
    if (reason) {
      blocked++;
      blockReason = reason;
    } else if (fenceAt(state, e) !== fence) {
      build.push(e);
    }
  }
  return { build, blocked, blockReason, cost: build.length * FENCE_TYPES[fence].cost };
}

/** A random name from `pool`, avoiding ones already `taken` while any are left. */
export function pickName(state: GameState, pool: string[], taken: string[]): string {
  const free = pool.filter((n) => !taken.includes(n));
  const options = free.length > 0 ? free : pool;
  const rng = new Rng(state.rngState);
  const name = options[rng.int(0, options.length - 1)];
  state.rngState = rng.snapshot;
  return name;
}

/** Why nothing can be built on this tile, or null if it's free, owned land. */
function tileBlocker(state: GameState, x: number, y: number): string | null {
  const t = terrainAt(state.map, x, y);
  if (t === undefined || !isLand(t)) return 'Needs dry land';
  if (!isBuildable(t)) return 'Too soggy to build on: drain the marsh first (🌳 Garden → Drain marsh)';
  if (!isTileOwned(state, x, y)) return "You don't own this land";
  return null;
}

/** Why a sea reptile (or a floating fish feeder) can't go on this tile, or null if it's pond water you own. */
function pondBlocker(state: GameState, x: number, y: number): string | null {
  if (terrainAt(state.map, x, y) !== Terrain.Pond) return 'Needs pond water: dig a pond with 🌳 Garden → Pond';
  if (!isTileOwned(state, x, y)) return "You don't own this pond";
  return null;
}

/** Digging a pond costs this per tile; filling one in refunds a little. */
export const POND_COST = 250;
export const POND_REFUND = 0.25;
/** Ground a pond can be dug in (forest and rock are too much work). */
const DIGGABLE = [Terrain.Grass, Terrain.Sand, Terrain.Marsh];

/** Why a pond can't be dug here, or null if it can. */
export function pondDigBlocker(state: GameState, x: number, y: number): string | null {
  const t = terrainAt(state.map, x, y);
  if (t === Terrain.Pond) return 'Already a pond';
  if (t === undefined || !DIGGABLE.includes(t)) return 'Ponds can be dug in grass or sand';
  if (!isTileOwned(state, x, y)) return "You don't own this land";
  const i = y * state.map.width + x;
  if (state.paths[i]) return 'There is a path here';
  if (state.dinos.some((d) => d.x === x && d.y === y) || state.eggs.some((e) => e.x === x && e.y === y)) return 'An animal is standing here';
  return tileOccupant(state, x, y);
}

/** Why this tile can't be drained, or null if it's marsh you own. */
export function drainBlocker(state: GameState, x: number, y: number): string | null {
  if (terrainAt(state.map, x, y) !== Terrain.Marsh) return 'Only marsh can be drained';
  if (!isTileOwned(state, x, y)) return "You don't own this land";
  return null;
}

export function refillCost(state: GameState, id: number): number {
  const f = state.feeders.find((f) => f.id === id);
  if (!f) return 0;
  const type = FEEDER_TYPES[f.kind];
  return (type.capacity - f.stock) * type.unitCost;
}

/** Validates and applies a command. The only way the player changes GameState. */
export function applyCommand(state: GameState, cmd: Command): CommandResult {
  switch (cmd.type) {
    case 'buildFences': {
      const plan = planFences(state, cmd.edges, cmd.fence);
      if (plan.build.length === 0) {
        return { ok: false, message: plan.blocked ? plan.blockReason : 'Already fenced' };
      }
      if (plan.cost > state.money) {
        return { ok: false, message: `Not enough money: need ${usd(plan.cost)}` };
      }
      for (const e of plan.build) setFence(state, e, cmd.fence);
      spend(state, 'construction', plan.cost);
      const skipped = plan.blocked ? ` (${plan.blocked} skipped: ${plan.blockReason.toLowerCase()})` : '';
      const n = plan.build.length;
      return {
        ok: true,
        cost: plan.cost,
        message: `Built ${n} ${FENCE_TYPES[cmd.fence].name.toLowerCase()} fence segment${n === 1 ? '' : 's'} for ${usd(plan.cost)}${skipped}`,
      };
    }

    case 'removeFences': {
      let refund = 0;
      let removed = 0;
      for (const e of uniqueEdges(cmd.edges)) {
        const f = fenceTypeAt(state, e);
        if (f === 0) continue;
        refund += FENCE_TYPES[f].cost * FENCE_REFUND;
        setFence(state, e, 0);
        removed++;
      }
      if (removed === 0) return { ok: false, message: 'No fence there' };
      refund = Math.floor(refund);
      earn(state, 'sales', refund);
      return {
        ok: true,
        cost: -refund,
        message: `Removed ${removed} segment${removed === 1 ? '' : 's'}, salvaged ${usd(refund)}`,
      };
    }

    case 'buyParcel': {
      const blocker = parcelBuyBlocker(state, cmd.px, cmd.py);
      if (blocker) return { ok: false, message: blocker };
      const price = parcelPrice(state.map, cmd.px, cmd.py);
      if (price > state.money) return { ok: false, message: `Not enough money: need ${usd(price)}` };
      state.parcelsOwned[cmd.py * parcelGrid(state.map).cols + cmd.px] = true;
      spend(state, 'land', price);
      return { ok: true, cost: price, message: `Bought land for ${usd(price)}` };
    }

    case 'buyDino': {
      const sp = SPECIES[cmd.species];
      if (!state.unlockedSpecies.includes(cmd.species)) return { ok: false, message: `${sp.name} isn't available yet` };
      const habitat = habitatOf(cmd.species);
      if (habitat === 'water') {
        const blocker = pondBlocker(state, cmd.x, cmd.y);
        if (blocker) return { ok: false, message: `${sp.name} lives in water. ${blocker}.` };
      } else {
        const blocker = tileBlocker(state, cmd.x, cmd.y);
        if (blocker) return { ok: false, message: blocker };
      }
      const { regions, tileRegion } = computeRegions(state);
      const home = regions[tileRegion[cmd.y * state.map.width + cmd.x]];
      if (home?.kind !== 'paddock') {
        return {
          ok: false,
          message: habitat === 'water' ? 'This pond needs to be inside a fenced paddock to be a lagoon' : 'Dinosaurs must go inside a fenced paddock',
        };
      }
      if (habitat === 'air' && !home.covered) {
        return { ok: false, message: `${sp.name} flies! It needs an aviary: a paddock fenced all the way round with aviary net` };
      }
      if (sp.price > state.money) return { ok: false, message: `Not enough money: need ${usd(sp.price)}` };
      // Paths left inside the paddock (laid while it was empty) are cleared: visitors can't reach them anyway.
      const region = tileRegion[cmd.y * state.map.width + cmd.x];
      let cleared = 0;
      if (regionHasPaths(state, { regions, tileRegion }, cmd.y * state.map.width + cmd.x)) {
        for (let i = 0; i < state.paths.length; i++) {
          if (state.paths[i] && tileRegion[i] === region) {
            state.paths[i] = 0;
            cleared++;
          }
        }
        earn(state, 'sales', Math.floor(cleared * PATH_COST * PATH_REFUND));
      }
      const name = pickName(state, DINO_NAMES, state.dinos.map((d) => d.name));
      state.dinos.push({
        id: state.nextId++,
        species: cmd.species,
        name,
        x: cmd.x,
        y: cmd.y,
        px: cmd.x,
        py: cmd.y,
        path: [],
        hunger: 20,
        health: 100,
        happiness: 80,
        bornHour: state.hours,
        sick: false,
        escaped: false,
        homeX: cmd.x,
        homeY: cmd.y,
        baby: false,
        lastTreatHour: NEVER,
        lastPatHour: NEVER,
      });
      spend(state, 'dinosaurs', sp.price);
      const note = cleared ? ` (cleared ${cleared} path tile${cleared === 1 ? '' : 's'} from inside the paddock)` : '';
      return { ok: true, cost: sp.price, message: `Welcome ${name} the ${sp.name}!${note}` };
    }

    case 'sellDino': {
      const d = state.dinos.find((d) => d.id === cmd.id);
      if (!d) return { ok: false, message: 'That dinosaur is gone' };
      if (d.baby) return { ok: false, message: `${d.name} is too little to leave home yet` };
      const value = Math.floor(SPECIES[d.species].price * DINO_RESALE);
      state.dinos.splice(state.dinos.indexOf(d), 1);
      earn(state, 'sales', value);
      return { ok: true, cost: -value, message: `Sold ${d.name} to another park for ${usd(value)}` };
    }

    case 'placeFeeder': {
      const type = FEEDER_TYPES[cmd.kind];
      // Fish feeders can float on a lagoon, or stand on land for the flyers.
      const onPond = cmd.kind === 'fish' && terrainAt(state.map, cmd.x, cmd.y) === Terrain.Pond;
      const blocker = onPond ? pondBlocker(state, cmd.x, cmd.y) : tileBlocker(state, cmd.x, cmd.y);
      if (blocker) return { ok: false, message: blocker };
      const occupied = tileOccupant(state, cmd.x, cmd.y);
      if (occupied) return { ok: false, message: occupied };
      if (state.paths[cmd.y * state.map.width + cmd.x]) return { ok: false, message: "Feeders can't go on a path" };
      if (type.cost > state.money) return { ok: false, message: `Not enough money: need ${usd(type.cost)}` };
      state.feeders.push({ id: state.nextId++, kind: cmd.kind, x: cmd.x, y: cmd.y, stock: type.capacity });
      spend(state, 'construction', type.cost);
      const what = type.name.toLowerCase();
      return { ok: true, cost: type.cost, message: `Built ${what.endsWith('s') ? what : `a ${what}`} for ${usd(type.cost)}` };
    }

    case 'removeFeeder': {
      const f = state.feeders.find((f) => f.id === cmd.id);
      if (!f) return { ok: false, message: 'No feeder there' };
      const refund = Math.floor(FEEDER_TYPES[f.kind].cost * FEEDER_REFUND);
      state.feeders.splice(state.feeders.indexOf(f), 1);
      earn(state, 'sales', refund);
      return { ok: true, cost: -refund, message: `Removed feeder, salvaged ${usd(refund)}` };
    }

    case 'refillFeeder': {
      const f = state.feeders.find((f) => f.id === cmd.id);
      if (!f) return { ok: false, message: 'No feeder there' };
      const cost = refillCost(state, cmd.id);
      if (cost === 0) return { ok: false, message: 'Already full' };
      if (cost > state.money) return { ok: false, message: `Not enough money: need ${usd(cost)}` };
      f.stock = FEEDER_TYPES[f.kind].capacity;
      spend(state, 'feed', cost);
      return { ok: true, cost, message: `Refilled for ${usd(cost)}` };
    }

    case 'buildPaths': {
      const plan = planPaths(state, cmd.tiles);
      if (plan.build.length === 0) return { ok: false, message: plan.blocked ? plan.blockReason : 'Already a path' };
      if (plan.cost > state.money) return { ok: false, message: `Not enough money: need ${usd(plan.cost)}` };
      for (const i of plan.build) state.paths[i] = 1;
      spend(state, 'construction', plan.cost);
      const n = plan.build.length;
      const skipped = plan.blocked ? ` (${plan.blocked} skipped: ${plan.blockReason.toLowerCase()})` : '';
      return { ok: true, cost: plan.cost, message: `Built ${n} path tile${n === 1 ? '' : 's'} for ${usd(plan.cost)}${skipped}` };
    }

    case 'removePaths': {
      const tiles = [...new Set(cmd.tiles)].filter((i) => state.paths[i] === 1);
      if (tiles.length === 0) return { ok: false, message: 'No path there' };
      for (const i of tiles) state.paths[i] = 0;
      const refund = Math.floor(tiles.length * PATH_COST * PATH_REFUND);
      earn(state, 'sales', refund);
      return { ok: true, cost: -refund, message: `Removed ${tiles.length} path tile${tiles.length === 1 ? '' : 's'}` };
    }

    case 'placeBuilding': {
      const type = BUILDING_TYPES[cmd.kind];
      const blocker = tileBlocker(state, cmd.x, cmd.y) ?? tileOccupant(state, cmd.x, cmd.y);
      if (blocker) return { ok: false, message: blocker };
      const i = cmd.y * state.map.width + cmd.x;
      if (state.paths[i]) return { ok: false, message: 'Build next to a path, not on it' };
      const { regions, tileRegion } = computeRegions(state);
      if (isOccupiedPaddock(state, { regions, tileRegion }, i)) {
        return { ok: false, message: "Buildings can't go inside a paddock with animals or feeders" };
      }
      if (cmd.kind === 'digsite' && !bedAt(state.fossilBeds, cmd.x, cmd.y)) {
        return { ok: false, message: 'Dig sites must go on a fossil bed (look for the bone-strewn ground)' };
      }
      if (type.needsPath && !touchesWalkway(state, cmd.x, cmd.y)) {
        return { ok: false, message: 'Must be next to a path so visitors can reach it' };
      }
      if (type.cost > state.money) return { ok: false, message: `Not enough money: need ${usd(type.cost)}` };
      state.buildings.push({ id: state.nextId++, kind: cmd.kind, x: cmd.x, y: cmd.y });
      spend(state, 'construction', type.cost);
      const what = type.name.toLowerCase();
      return { ok: true, cost: type.cost, message: `Built ${what.endsWith('s') ? what : `a ${what}`} for ${usd(type.cost)}` };
    }

    case 'removeBuilding': {
      const b = state.buildings.find((b) => b.id === cmd.id);
      if (!b) return { ok: false, message: 'No building there' };
      const refund = Math.floor(BUILDING_TYPES[b.kind].cost * BUILDING_REFUND);
      state.buildings.splice(state.buildings.indexOf(b), 1);
      earn(state, 'sales', refund);
      return { ok: true, cost: -refund, message: `Demolished ${BUILDING_TYPES[b.kind].name.toLowerCase()}, salvaged ${usd(refund)}` };
    }

    case 'setTicketPrice': {
      const price = Math.round(Math.min(MAX_TICKET_PRICE, Math.max(0, cmd.price)));
      state.ticketPrice = price;
      return { ok: true, cost: 0, message: `Tickets now cost ${usd(price)}` };
    }

    case 'takeLoan': {
      if (!LOAN_AMOUNTS.includes(cmd.amount)) return { ok: false, message: 'The bank does not offer that loan' };
      const blocker = loanBlocker(state, cmd.amount);
      if (blocker) return { ok: false, message: blocker };
      state.finance.loans.push({ id: state.nextId++, principal: cmd.amount, balance: cmd.amount });
      earn(state, 'loans', cmd.amount);
      return { ok: true, cost: -cmd.amount, message: `The bank lent you ${usd(cmd.amount)}` };
    }

    case 'repayLoan': {
      const loan = state.finance.loans.find((l) => l.id === cmd.id);
      if (!loan) return { ok: false, message: 'No such loan' };
      if (loan.balance > state.money) return { ok: false, message: `Not enough money: need ${usd(loan.balance)}` };
      spend(state, 'repayments', loan.balance);
      state.finance.loans.splice(state.finance.loans.indexOf(loan), 1);
      return { ok: true, cost: loan.balance, message: `Loan paid off: ${usd(loan.balance)}` };
    }

    case 'hireStaff': {
      const type = STAFF_TYPES[cmd.role];
      if (!type) return { ok: false, message: 'Unknown job' };
      const name = pickName(state, STAFF_NAMES, state.staff.map((m) => m.name));
      const { x, y } = state.entrance;
      state.staff.push({ id: state.nextId++, role: cmd.role, name, x, y, px: x, py: y, task: null, progress: 0, from: -1 });
      return { ok: true, cost: 0, message: `Hired ${name} as a ${type.name.toLowerCase()} (${usd(type.wage)}/day)` };
    }

    case 'fireStaff': {
      const member = state.staff.find((m) => m.id === cmd.id);
      if (!member) return { ok: false, message: 'No such staff member' };
      state.staff.splice(state.staff.indexOf(member), 1);
      return { ok: true, cost: 0, message: `${member.name} has left the park` };
    }

    case 'placeDecor': {
      const type = DECOR_TYPES[cmd.kind];
      const blocker = tileBlocker(state, cmd.x, cmd.y) ?? tileOccupant(state, cmd.x, cmd.y);
      if (blocker) return { ok: false, message: blocker };
      if (state.paths[cmd.y * state.map.width + cmd.x]) return { ok: false, message: 'Put gardens beside paths, not on them' };
      if (type.cost > state.money) return { ok: false, message: `Not enough money: need ${usd(type.cost)}` };
      state.decor.push({ id: state.nextId++, kind: cmd.kind, x: cmd.x, y: cmd.y });
      spend(state, 'construction', type.cost);
      return { ok: true, cost: type.cost, message: `Added a ${type.name.toLowerCase()} for ${usd(type.cost)}` };
    }

    case 'removeDecor': {
      const d = state.decor.find((d) => d.id === cmd.id);
      if (!d) return { ok: false, message: 'Nothing there' };
      const refund = Math.floor(DECOR_TYPES[d.kind].cost * DECOR_REFUND);
      state.decor.splice(state.decor.indexOf(d), 1);
      earn(state, 'sales', refund);
      return { ok: true, cost: -refund, message: `Removed ${DECOR_TYPES[d.kind].name.toLowerCase()}` };
    }

    case 'buildTracks': {
      const plan = planTracks(state, cmd.tiles);
      if (plan.build.length === 0) return { ok: false, message: plan.blocked ? plan.blockReason : 'Already a track' };
      if (plan.cost > state.money) return { ok: false, message: `Not enough money: need ${usd(plan.cost)}` };
      for (const i of plan.build) state.tracks[i] = 1;
      spend(state, 'construction', plan.cost);
      const n = plan.build.length;
      const skipped = plan.blocked ? ` (${plan.blocked} skipped: ${plan.blockReason.toLowerCase()})` : '';
      return { ok: true, cost: plan.cost, message: `Built ${n} jeep track tile${n === 1 ? '' : 's'} for ${usd(plan.cost)}${skipped}` };
    }

    case 'removeTracks': {
      const tiles = [...new Set(cmd.tiles)].filter((i) => state.tracks[i]);
      if (tiles.length === 0) return { ok: false, message: 'No track here' };
      for (const i of tiles) state.tracks[i] = 0;
      const refund = Math.floor(tiles.length * TRACK_COST * PATH_REFUND);
      earn(state, 'sales', refund);
      return { ok: true, cost: -refund, message: `Removed ${tiles.length} track tile${tiles.length === 1 ? '' : 's'} (+${usd(refund)})` };
    }

    case 'digPonds': {
      const w = state.map.width;
      const dig = [...new Set(cmd.tiles)].filter((i) => !pondDigBlocker(state, i % w, Math.floor(i / w)));
      if (dig.length === 0) {
        const first = cmd.tiles[0];
        return { ok: false, message: (first !== undefined && pondDigBlocker(state, first % w, Math.floor(first / w))) || 'Nothing to dig' };
      }
      const cost = dig.length * POND_COST;
      if (cost > state.money) return { ok: false, message: `Not enough money: need ${usd(cost)}` };
      for (const i of dig) state.map.tiles[i] = Terrain.Pond;
      spend(state, 'construction', cost);
      return { ok: true, cost, message: `Dug ${dig.length} tile${dig.length === 1 ? '' : 's'} of pond for ${usd(cost)}` };
    }

    case 'drainMarsh': {
      const w = state.map.width;
      const drain = [...new Set(cmd.tiles)].filter((i) => !drainBlocker(state, i % w, Math.floor(i / w)));
      if (drain.length === 0) {
        const first = cmd.tiles[0];
        return { ok: false, message: (first !== undefined && drainBlocker(state, first % w, Math.floor(first / w))) || 'No marsh to drain here' };
      }
      const cost = drain.length * DRAIN_COST;
      if (cost > state.money) return { ok: false, message: `Not enough money: need ${usd(cost)}` };
      for (const i of drain) state.map.tiles[i] = Terrain.Grass;
      spend(state, 'construction', cost);
      return { ok: true, cost, message: `Drained ${drain.length} tile${drain.length === 1 ? '' : 's'} of marsh for ${usd(cost)}` };
    }

    case 'fillPonds': {
      const w = state.map.width;
      const fill = [...new Set(cmd.tiles)].filter((i) => {
        const x = i % w;
        const y = Math.floor(i / w);
        return (
          state.map.tiles[i] === Terrain.Pond &&
          isTileOwned(state, x, y) &&
          !state.dinos.some((d) => d.x === x && d.y === y) &&
          !state.feeders.some((f) => f.x === x && f.y === y)
        );
      });
      if (fill.length === 0) return { ok: false, message: 'No pond you can fill in here' };
      for (const i of fill) state.map.tiles[i] = Terrain.Grass;
      const refund = Math.floor(fill.length * POND_COST * POND_REFUND);
      earn(state, 'sales', refund);
      return { ok: true, cost: -refund, message: `Filled in ${fill.length} tile${fill.length === 1 ? '' : 's'} of pond (+${usd(refund)})` };
    }

    case 'chooseOption': {
      const result = answerChoice(state, cmd.option);
      return result ? { ok: true, cost: 0, message: result } : { ok: false, message: 'There is nothing to decide right now' };
    }

    case 'treatDino': {
      const r = treatDino(state, cmd.id);
      if (r.ok) noteRequestAction(state, 'treat');
      return r;
    }
    case 'patDino':
      return patDino(state, cmd.id);
    case 'photoDino': {
      const d = state.dinos.find((x) => x.id === cmd.id);
      if (!d) return { ok: false, message: 'That dinosaur is gone' };
      state.stats.photos++;
      noteRequestAction(state, 'photo', d);
      return { ok: true, cost: 0, message: 'Say cheese!' };
    }

    case 'rename': {
      const name = cmd.name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
      if (!name) return { ok: false, message: 'Names can’t be blank' };
      const list = cmd.kind === 'visitor' ? state.visitors : cmd.kind === 'dino' ? state.dinos : state.staff;
      const who = (list as { id: number; name: string }[]).find((e) => e.id === cmd.id);
      if (!who) return { ok: false, message: 'They’re no longer in the park' };
      const old = who.name;
      who.name = name;
      return { ok: true, cost: 0, message: `${old} is now called ${name}` };
    }

    case 'repairFence': {
      if (!fenceTypeAt(state, cmd.edge)) return { ok: false, message: 'No fence there' };
      const cost = repairCost(state, cmd.edge);
      if (cost === 0) return { ok: false, message: 'That fence is in perfect condition' };
      if (cost > state.money) return { ok: false, message: `Not enough money: need ${usd(cost)}` };
      setFenceHp(state, cmd.edge, 100);
      spend(state, 'maintenance', cost);
      return { ok: true, cost, message: `Fence repaired for ${usd(cost)}` };
    }
  }
}

/** Cost to bring a fence back to full condition. */
export function repairCost(state: GameState, e: Edge): number {
  const type = fenceTypeAt(state, e);
  if (!type) return 0;
  return Math.ceil(FENCE_TYPES[type].cost * REPAIR_COST_FRACTION * ((100 - fenceHp(state, e)) / 100));
}

/** What a path build would do, for the drag preview and the command. */
/** Why jeep track can't go on this tile: like a path, but not on paths, and never inside a paddock with animals. */
export function trackBlocker(state: GameState, regions: RegionMap, x: number, y: number): string | null {
  const i = y * state.map.width + x;
  if (state.paths[i]) return 'There is a path here (tracks run alongside paths)';
  return pathBlocker(state, regions, x, y);
}

/** What a track build would do, without changing anything. Used for the drag preview. */
export function planTracks(state: GameState, tiles: number[]) {
  const regions = computeRegions(state);
  const w = state.map.width;
  const build: number[] = [];
  let blocked = 0;
  let blockReason = '';
  for (const i of new Set(tiles)) {
    if (state.tracks[i]) continue;
    const reason = trackBlocker(state, regions, i % w, Math.floor(i / w));
    if (reason) {
      blocked++;
      blockReason = reason;
    } else build.push(i);
  }
  return { build, blocked, blockReason, cost: build.length * TRACK_COST };
}

export function planPaths(state: GameState, tiles: number[]) {
  const regions = computeRegions(state);
  const w = state.map.width;
  const build: number[] = [];
  let blocked = 0;
  let blockReason = '';
  for (const i of new Set(tiles)) {
    if (state.paths[i]) continue;
    const reason = pathBlocker(state, regions, i % w, Math.floor(i / w));
    if (reason) {
      blocked++;
      blockReason = reason;
    } else build.push(i);
  }
  const bridges = build.filter((i) => state.map.tiles[i] === Terrain.River).length;
  return { build, blocked, blockReason, bridges, cost: (build.length - bridges) * PATH_COST + bridges * BRIDGE_COST };
}
