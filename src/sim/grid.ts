/**
 * Tile-edge addressing. Fences live on the edges between tiles.
 *
 *  - 'h' edge (x, y) is the TOP edge of tile (x, y): it separates (x, y-1) and (x, y)
 *    and runs from vertex (x, y) to (x+1, y).  x ∈ [0, W-1], y ∈ [0, H]
 *  - 'v' edge (x, y) is the LEFT edge of tile (x, y): it separates (x-1, y) and (x, y)
 *    and runs from vertex (x, y) to (x, y+1).  x ∈ [0, W], y ∈ [0, H-1]
 */
export interface Edge {
  dir: 'h' | 'v';
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export function hEdgeCount({ width, height }: Size): number {
  return width * (height + 1);
}

export function vEdgeCount({ width, height }: Size): number {
  return (width + 1) * height;
}

export function edgeInBounds(e: Edge, { width, height }: Size): boolean {
  if (e.dir === 'h') return e.x >= 0 && e.x < width && e.y >= 0 && e.y <= height;
  return e.x >= 0 && e.x <= width && e.y >= 0 && e.y < height;
}

/** Index into the h or v fence array. Caller must check bounds. */
export function edgeIndex(e: Edge, { width }: Size): number {
  return e.dir === 'h' ? e.y * width + e.x : e.y * (width + 1) + e.x;
}

/** The (up to two) tiles an edge separates, including out-of-bounds coordinates. */
export function edgeTiles(e: Edge): [[number, number], [number, number]] {
  return e.dir === 'h'
    ? [
        [e.x, e.y - 1],
        [e.x, e.y],
      ]
    : [
        [e.x - 1, e.y],
        [e.x, e.y],
      ];
}

export function edgeKey(e: Edge): string {
  return `${e.dir}${e.x},${e.y}`;
}

/**
 * Edges along an L-shaped path between two grid vertices. With `horizontalFirst`
 * the path runs along row ay to column bx, then down/up to by; otherwise the reverse.
 */
export function pathEdges(ax: number, ay: number, bx: number, by: number, horizontalFirst: boolean): Edge[] {
  const edges: Edge[] = [];
  const hLeg = (row: number) => {
    for (let x = Math.min(ax, bx); x < Math.max(ax, bx); x++) edges.push({ dir: 'h', x, y: row });
  };
  const vLeg = (col: number) => {
    for (let y = Math.min(ay, by); y < Math.max(ay, by); y++) edges.push({ dir: 'v', x: col, y });
  };
  if (horizontalFirst) {
    hLeg(ay);
    vLeg(bx);
  } else {
    vLeg(ax);
    hLeg(by);
  }
  return edges;
}

/**
 * Tiles along an L-shaped path from tile (ax, ay) to tile (bx, by), both ends
 * included, turning at (bx, ay) with `horizontalFirst`, else at (ax, by).
 */
export function tileLine(ax: number, ay: number, bx: number, by: number, horizontalFirst: boolean): [number, number][] {
  const out: [number, number][] = [];
  const [cx, cy] = horizontalFirst ? [bx, ay] : [ax, by];
  const walk = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    for (let x = x0, y = y0; ; x += dx, y += dy) {
      if (out.length === 0 || out[out.length - 1][0] !== x || out[out.length - 1][1] !== y) out.push([x, y]);
      if (x === x1 && y === y1) break;
    }
  };
  walk(ax, ay, cx, cy);
  walk(cx, cy, bx, by);
  return out;
}
