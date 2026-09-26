import type { GameState } from './GameState';
import { FENCE_REFUND, FENCE_TYPES, type FenceTypeId } from './data/fences';
import { fenceAt, fenceBlocker, setFence } from './fences';
import { edgeKey, type Edge } from './grid';
import { isTileOwned, parcelBuyBlocker, parcelGrid, parcelPrice } from './land';
import { DINO_NAMES, SPECIES, type SpeciesId } from './data/species';
import { DINO_RESALE, FEEDER_REFUND, FEEDER_TYPES, type FeederKind } from './data/feeders';
import { computeRegions } from './regions';
import { Rng } from './rng';
import { isLand, terrainAt } from './terrain';

export type Command =
  | { type: 'buildFences'; edges: Edge[]; fence: FenceTypeId }
  | { type: 'removeFences'; edges: Edge[] }
  | { type: 'buyParcel'; px: number; py: number }
  | { type: 'buyDino'; species: SpeciesId; x: number; y: number }
  | { type: 'sellDino'; id: number }
  | { type: 'placeFeeder'; kind: FeederKind; x: number; y: number }
  | { type: 'removeFeeder'; id: number }
  | { type: 'refillFeeder'; id: number };

export type CommandResult = { ok: true; message: string; cost: number } | { ok: false; message: string };

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

/** Why nothing can be built on this tile, or null if it's free, owned land. */
function tileBlocker(state: GameState, x: number, y: number): string | null {
  const t = terrainAt(state.map, x, y);
  if (t === undefined || !isLand(t)) return 'Needs dry land';
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
      state.money -= plan.cost;
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
        const f = fenceAt(state, e);
        if (f === 0) continue;
        refund += FENCE_TYPES[f].cost * FENCE_REFUND;
        setFence(state, e, 0);
        removed++;
      }
      if (removed === 0) return { ok: false, message: 'No fence there' };
      refund = Math.floor(refund);
      state.money += refund;
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
      state.money -= price;
      return { ok: true, cost: price, message: `Bought land for ${usd(price)}` };
    }

    case 'buyDino': {
      const sp = SPECIES[cmd.species];
      if (!state.unlockedSpecies.includes(cmd.species)) return { ok: false, message: `${sp.name} isn't available yet` };
      const blocker = tileBlocker(state, cmd.x, cmd.y);
      if (blocker) return { ok: false, message: blocker };
      const { regions, tileRegion } = computeRegions(state);
      if (regions[tileRegion[cmd.y * state.map.width + cmd.x]].kind !== 'paddock') {
        return { ok: false, message: 'Dinosaurs must go inside a fenced paddock' };
      }
      if (sp.price > state.money) return { ok: false, message: `Not enough money: need ${usd(sp.price)}` };
      const rng = new Rng(state.rngState);
      const name = DINO_NAMES[rng.int(0, DINO_NAMES.length - 1)];
      state.rngState = rng.snapshot;
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
      });
      state.money -= sp.price;
      return { ok: true, cost: sp.price, message: `Welcome ${name} the ${sp.name}!` };
    }

    case 'sellDino': {
      const d = state.dinos.find((d) => d.id === cmd.id);
      if (!d) return { ok: false, message: 'That dinosaur is gone' };
      const value = Math.floor(SPECIES[d.species].price * DINO_RESALE);
      state.dinos.splice(state.dinos.indexOf(d), 1);
      state.money += value;
      return { ok: true, cost: -value, message: `Sold ${d.name} to another park for ${usd(value)}` };
    }

    case 'placeFeeder': {
      const type = FEEDER_TYPES[cmd.kind];
      const blocker = tileBlocker(state, cmd.x, cmd.y);
      if (blocker) return { ok: false, message: blocker };
      if (state.feeders.some((f) => f.x === cmd.x && f.y === cmd.y)) return { ok: false, message: 'There is already a feeder here' };
      if (type.cost > state.money) return { ok: false, message: `Not enough money: need ${usd(type.cost)}` };
      state.feeders.push({ id: state.nextId++, kind: cmd.kind, x: cmd.x, y: cmd.y, stock: type.capacity });
      state.money -= type.cost;
      return { ok: true, cost: type.cost, message: `Built a ${type.name.toLowerCase()} for ${usd(type.cost)}` };
    }

    case 'removeFeeder': {
      const f = state.feeders.find((f) => f.id === cmd.id);
      if (!f) return { ok: false, message: 'No feeder there' };
      const refund = Math.floor(FEEDER_TYPES[f.kind].cost * FEEDER_REFUND);
      state.feeders.splice(state.feeders.indexOf(f), 1);
      state.money += refund;
      return { ok: true, cost: -refund, message: `Removed feeder, salvaged ${usd(refund)}` };
    }

    case 'refillFeeder': {
      const f = state.feeders.find((f) => f.id === cmd.id);
      if (!f) return { ok: false, message: 'No feeder there' };
      const cost = refillCost(state, cmd.id);
      if (cost === 0) return { ok: false, message: 'Already full' };
      if (cost > state.money) return { ok: false, message: `Not enough money: need ${usd(cost)}` };
      f.stock = FEEDER_TYPES[f.kind].capacity;
      state.money -= cost;
      return { ok: true, cost, message: `Refilled for ${usd(cost)}` };
    }
  }
}
