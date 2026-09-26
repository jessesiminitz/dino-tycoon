import type { GameState } from './GameState';
import { edgeInBounds, edgeIndex, edgeTiles, type Edge } from './grid';
import { isTileOwned } from './land';
import { isLand, terrainAt } from './terrain';
import type { FenceTypeId } from './data/fences';

/** Fence type built on an edge, intact or broken, or 0 for none. */
export function fenceTypeAt(state: GameState, e: Edge): FenceTypeId | 0 {
  if (!edgeInBounds(e, state.map)) return 0;
  const arr = e.dir === 'h' ? state.hFences : state.vFences;
  return arr[edgeIndex(e, state.map)] as FenceTypeId | 0;
}

/** Condition 0–100 of the fence on an edge (0 = broken, or no fence). */
export function fenceHp(state: GameState, e: Edge): number {
  if (!edgeInBounds(e, state.map)) return 0;
  const arr = e.dir === 'h' ? state.hFenceHp : state.vFenceHp;
  return arr[edgeIndex(e, state.map)];
}

/**
 * The fence that actually blocks this edge: its type if intact, else 0.
 * A broken fence lets animals and visitors through until it's repaired.
 */
export function fenceAt(state: GameState, e: Edge): FenceTypeId | 0 {
  const type = fenceTypeAt(state, e);
  return type !== 0 && fenceHp(state, e) > 0 ? type : 0;
}

/** Builds (at full condition) or removes a fence. */
export function setFence(state: GameState, e: Edge, type: FenceTypeId | 0): void {
  const i = edgeIndex(e, state.map);
  (e.dir === 'h' ? state.hFences : state.vFences)[i] = type;
  (e.dir === 'h' ? state.hFenceHp : state.vFenceHp)[i] = type ? 100 : 0;
}

export function setFenceHp(state: GameState, e: Edge, hp: number): void {
  (e.dir === 'h' ? state.hFenceHp : state.vFenceHp)[edgeIndex(e, state.map)] = Math.max(0, Math.min(100, hp));
}

/** Every edge with a fence built on it (intact or broken). */
export function allFenceEdges(state: GameState): Edge[] {
  const { width, height } = state.map;
  const out: Edge[] = [];
  for (let y = 0; y <= height; y++) for (let x = 0; x < width; x++) if (state.hFences[y * width + x]) out.push({ dir: 'h', x, y });
  for (let y = 0; y < height; y++) for (let x = 0; x <= width; x++) if (state.vFences[y * (width + 1) + x]) out.push({ dir: 'v', x, y });
  return out;
}

/** The four edges around a tile. */
export function tileEdges(x: number, y: number): Edge[] {
  return [
    { dir: 'h', x, y },
    { dir: 'h', x, y: y + 1 },
    { dir: 'v', x, y },
    { dir: 'v', x: x + 1, y },
  ];
}

/**
 * Why a fence can't go on this edge, or null if it can. An edge is buildable when
 * at least one side is land you own (so property-line fences are allowed).
 */
export function fenceBlocker(state: GameState, e: Edge): string | null {
  if (!edgeInBounds(e, state.map)) return 'Off the map';
  const ownedLandSide = edgeTiles(e).some(([x, y]) => {
    const t = terrainAt(state.map, x, y);
    return t !== undefined && isLand(t) && isTileOwned(state, x, y);
  });
  return ownedLandSide ? null : "You don't own land here";
}
