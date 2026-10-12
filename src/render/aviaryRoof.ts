/** Curved net panels follow the actual enclosure footprint, including indented edges. */
export interface RoofPoint { x: number; y: number }
export interface RoofPanel { corners: RoofPoint[]; rib: boolean; cap?: boolean }
export function aviaryRoof(tiles: readonly number[], mapWidth: number, tileSize = 16, wallHeight = 13): RoofPanel[] {
  const rows = new Map<number, number[]>();
  for (const i of tiles) {
    const y = Math.floor(i / mapWidth);
    const row = rows.get(y) ?? [];
    row.push(i % mapWidth); rows.set(y, row);
  }
  if (!rows.size) return [];
  const first = Math.min(...rows.keys()), last = Math.max(...rows.keys()) + 1;
  const panels: RoofPanel[] = [];
  const footprint = new Set(tiles);
  for (const [y, columns] of rows) {
    columns.sort((a, b) => a - b);
    for (let start = 0; start < columns.length;) {
      let end = start + 1;
      while (end < columns.length && columns[end] === columns[end - 1] + 1) end++;
      const left = columns[start] * tileSize, right = (columns[end - 1] + 1) * tileSize;
      const height = Math.min(42, (right - left) * .3);
      const point = (x: number, row: number): RoofPoint => {
        const u = (x - left) / (right - left) * 2 - 1;
        const v = (row - first) / (last - first);
        const lift = height * Math.sqrt(Math.max(0, 1 - u * u)) * (.45 + .55 * Math.sin(v * Math.PI));
        return { x, y: row * tileSize - wallHeight - lift };
      };
      for (let x = left; x < right; x += tileSize / 2) {
        panels.push({ corners: [point(x, y), point(x + tileSize / 2, y), point(x + tileSize / 2, y + 1), point(x, y + 1)], rib: (y - first) % 2 === 0 });
        // Net the curved ends down to the wall: no open space below the dome.
        const column = Math.floor(x / tileSize);
        for (const [neighbour, boundary] of [[y - 1, y], [y + 1, y + 1]]) {
          if (footprint.has(neighbour * mapWidth + column)) continue;
          panels.push({ corners: [point(x, boundary), point(x + tileSize / 2, boundary),
            { x: x + tileSize / 2, y: boundary * tileSize - wallHeight },
            { x, y: boundary * tileSize - wallHeight }], rib: true, cap: true });
        }
      }
      start = end;
    }
  }
  return panels;
}
