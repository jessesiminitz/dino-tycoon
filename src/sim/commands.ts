import type { GameState } from './GameState';
import { FENCE_REFUND, FENCE_TYPES, type FenceTypeId } from './data/fences';
import { fenceAt, fenceBlocker, setFence } from './fences';
import { edgeKey, type Edge } from './grid';
import { parcelBuyBlocker, parcelGrid, parcelPrice } from './land';

export type Command =
  | { type: 'buildFences'; edges: Edge[]; fence: FenceTypeId }
  | { type: 'removeFences'; edges: Edge[] }
  | { type: 'buyParcel'; px: number; py: number };

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
  }
}
