import { Terrain, type TerrainMap } from '../sim/terrain';
import type { GameState } from '../sim/GameState';
import { allFenceEdges, fenceTypeAt } from '../sim/fences';

/** One colour per terrain for the little map previews. */
const COLORS: Record<Terrain, string> = {
  [Terrain.DeepWater]: '#1e5a96',
  [Terrain.Shallows]: '#3e9ad0',
  [Terrain.Sand]: '#ecd08a',
  [Terrain.Grass]: '#66a642',
  [Terrain.Forest]: '#2f6b2a',
  [Terrain.Rock]: '#8a8373',
  [Terrain.Mountain]: '#5e584c',
  [Terrain.Volcano]: '#c8502a',
  [Terrain.Pond]: '#4f9a9a',
  [Terrain.River]: '#3f8fc8',
  [Terrain.Marsh]: '#6f7f3a',
  [Terrain.LavaRock]: '#3e3533',
  [Terrain.HotSpring]: '#6fd0c8',
  [Terrain.Cliff]: '#4a3f33',
  [Terrain.Waterfall]: '#e8f6fb',
};

/** A preview of a built park: the island, with paths, fences, buildings and dinosaurs marked. */
export function paintParkMinimap(state: GameState): HTMLCanvasElement {
  const c = paintMinimap(state.map, state.entrance);
  const ctx = c.getContext('2d')!;
  const { width } = state.map;
  ctx.fillStyle = '#f2e2b8';
  for (let i = 0; i < state.paths.length; i++) if (state.paths[i]) ctx.fillRect(i % width, Math.floor(i / width), 1, 1);
  ctx.fillStyle = '#3b2a1a';
  for (const e of allFenceEdges(state)) if (fenceTypeAt(state, e)) ctx.fillRect(e.x, e.y, 1, 1);
  ctx.fillStyle = '#e0455a';
  for (const b of state.buildings) ctx.fillRect(b.x, b.y, 1, 1);
  ctx.fillStyle = '#ffffff';
  for (const d of state.dinos) ctx.fillRect(d.x, d.y, 1, 1);
  return c;
}

/** A map preview: one pixel per tile (scale it up with CSS `image-rendering: pixelated`). */
export function paintMinimap(map: TerrainMap, gate?: { x: number; y: number }): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = map.width;
  c.height = map.height;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      ctx.fillStyle = COLORS[map.tiles[y * map.width + x]];
      ctx.fillRect(x, y, 1, 1);
    }
  if (gate) {
    ctx.fillStyle = '#ff4fa0';
    ctx.fillRect(gate.x - 1, gate.y - 1, 3, 3);
  }
  return c;
}
