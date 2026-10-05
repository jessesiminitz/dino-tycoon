// Check native role pixels before outlines/scaling can disguise detached anatomy.
export function assertAttachedSilhouette(rows, label) {
  const width = rows[0].length;
  const pixels = new Set();
  rows.forEach((row, y) => [...row].forEach((role, x) => {
    if (role !== '.') pixels.add(y * width + x);
  }));
  const components = [];
  while (pixels.size) {
    const first = pixels.values().next().value;
    pixels.delete(first);
    const queue = [first], group = [];
    while (queue.length) {
      const point = queue.pop(), x = point % width, y = Math.floor(point / width);
      group.push([x, y]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, neighbour = ny * width + nx;
        if (nx >= 0 && nx < width && ny >= 0 && ny < rows.length && pixels.delete(neighbour)) queue.push(neighbour);
      }
    }
    components.push(group);
  }
  components.sort((a, b) => b.length - a.length);
  const body = components[0] ?? [];
  for (const group of components.slice(1)) {
    // A one-pixel raster gap at a thin tip is acceptable. Whole accessories
    // and distant dots are not; never silently erase them from the export.
    const adjacent = group.some(([x, y]) => body.some(([bx, by]) => Math.max(Math.abs(x-bx), Math.abs(y-by)) <= 2));
    if (group.length > 2 || !adjacent) throw new Error(`Detached anatomy ${label}: ${group.length} pixels near ${group[0]}`);
  }
}
