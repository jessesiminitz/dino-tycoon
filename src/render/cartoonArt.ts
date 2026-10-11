import geometrySource from './generated/cartoonGeometry.json?raw';
import type { Species } from '../sim/data/species';
import { Terrain } from '../sim/terrain';
import { drawCartoonRex } from './cartoonRex';

/** Supersampled native curves, never resized role grids. */
export const CARTOON_RESOLUTION = 4;
type Point = [number, number];
type Shape = [string, string, Point[]];
type Pose = { width: number; height: number; frames: Shape[][] };
type Asset = Pose & { colors?: Record<string, string>; motion?: Record<string, Pose> };
type PackedPose = { width: number; height: number; frames: number[][] };
type PackedAsset = PackedPose & { colors?: Record<string, string>; motion?: Record<string, PackedPose> };
const packed = JSON.parse(geometrySource) as { shapes: Shape[]; assets: Record<string, PackedAsset> };
const expand = (pose: PackedPose): Pose => ({ ...pose, frames: pose.frames.map(frame => frame.map(index => packed.shapes[index])) });
/** Shared contour references keep the exported pack and runtime memory small. */
export const CARTOON_GEOMETRY: Record<string, Asset> = Object.fromEntries(Object.entries(packed.assets).map(([id, asset]) => [id, {
  ...expand(asset), colors: asset.colors,
  motion: asset.motion ? Object.fromEntries(Object.entries(asset.motion).map(([clip, pose]) => [clip, expand(pose)])) : undefined,
}]));
const metadata = new WeakMap<HTMLCanvasElement, { resolution: number; bounds: { left: number; top: number; right: number; bottom: number } }>();
export const cartoonMetadata = (canvas: HTMLCanvasElement) => metadata.get(canvas);
const INK = '#202019';

function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16), to = amount > 0 ? 255 : 0;
  const channel = (shift: number) => Math.round(((n >> shift) & 255) * (1 - Math.abs(amount)) + to * Math.abs(amount));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

export function cartoonCanvas(width: number, height: number, resolution = CARTOON_RESOLUTION): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * resolution);
  canvas.height = Math.ceil(height * resolution);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(resolution, resolution);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  metadata.set(canvas, { resolution, bounds: { left: 0, top: 0, right: canvas.width, bottom: canvas.height } });
  return [canvas, ctx];
}

function contour(ctx: CanvasRenderingContext2D, points: Point[], round: boolean): void {
  ctx.beginPath();
  if (!round) {
    ctx.moveTo(...points[0]);
    for (const p of points.slice(1)) ctx.lineTo(...p);
  } else {
    const last = points.at(-1)!;
    ctx.moveTo((last[0] + points[0][0]) / 2, (last[1] + points[0][1]) / 2);
    points.forEach((p, i) => {
      const next = points[(i + 1) % points.length];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + next[0]) / 2, (p[1] + next[1]) / 2);
    });
  }
  ctx.closePath();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke = true): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = INK; ctx.stroke(); }
}

/** Semantic Blender contour layers become smooth cel shapes and expressive eyes. */
export function paintCartoonAsset(id: string, frame = 0, species?: Species, baby = false, scale = 1, clip?: string): HTMLCanvasElement {
  const asset = CARTOON_GEOMETRY[id];
  if (!asset) throw new Error(`Missing cartoon asset ${id}`);
  const pose = clip ? asset.motion?.[clip] : asset;
  if (!pose || !Number.isInteger(frame) || !pose.frames[frame]) throw new RangeError(`Invalid cartoon pose ${id}:${clip}:${frame}`);
  const factor = scale * (baby ? .6 : 1);
  const resolution = scale === 1 ? CARTOON_RESOLUTION : 2;
  if (species?.id === 'tyrannosaurus') {
    const animated = !!clip, paddingX = animated ? 8 : 0, paddingY = animated ? 8 : 0;
    const [canvas, ctx] = cartoonCanvas(Math.ceil((114 + paddingX * 2) * factor) + 2, Math.ceil((78 + paddingY) * factor) + 2, resolution);
    ctx.translate(1 + paddingX * factor, 1 + (paddingY + 2) * factor); ctx.scale(factor, factor);
    drawCartoonRex(ctx, clip ? frame : frame * 2, clip ?? 'walk', baby);
    metadata.get(canvas)!.bounds = {left:(1+(8+paddingX)*factor)*resolution,top:(1+(5+paddingY)*factor)*resolution,right:(1+(114+paddingX)*factor)*resolution,bottom:(1+(79+paddingY)*factor)*resolution};
    return canvas;
  }
  const width = Math.ceil(pose.width * factor) + 2, height = Math.ceil(pose.height * factor) + 2;
  const [canvas, ctx] = cartoonCanvas(width, height, resolution);
  ctx.translate(1, 1); ctx.scale(factor, factor);
  ctx.lineWidth = Math.max(.5, .4 / factor);
  let colors: Record<string, string> = asset.colors ?? {};
  if (species) {
    const body = species.art.body;
    const accent = species.art.accent;
    colors = { B: baby ? tint(body, .12) : body, D: '#ffe398', F: tint(body, -.18), A: accent, G: tint(accent, -.18), W: '#fff6dc', E: INK, M: '#6a302c' };
  }
  const eyes: Shape[] = [];
  const bounds = { left: Infinity, top: Infinity, right: 0, bottom: 0 };
  for (const [name, role, points] of pose.frames[frame]) {
    if (points.length < 3) continue;
    for (const [x, y] of points) {
      bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
      bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y);
    }
    if (species && /eye/.test(name)) { eyes.push([name, role, points]); continue; }
    // Round anatomical profiles; architecture keeps straight walls and roofs.
    contour(ctx, points, !!species || points.length > 6 || /canopy|leaf|bush|flower|water|basin/.test(name));
    ctx.fillStyle = colors[role] ?? '#e7bd69'; ctx.fill();
    // Same-color body overlays should not acquire seams at every joint.
    if (!species || ['A','G','W','M'].includes(role)) {
      ctx.strokeStyle = INK; ctx.stroke();
    }
  }
  // Outline the connected silhouette once, instead of outlining every limb joint.
  if (species) {
    const silhouette = document.createElement('canvas');silhouette.width=canvas.width;silhouette.height=canvas.height;
    const sc = silhouette.getContext('2d')!;sc.drawImage(canvas,0,0);sc.globalCompositeOperation='source-in';sc.fillStyle=INK;sc.fillRect(0,0,silhouette.width,silhouette.height);
    ctx.save();ctx.resetTransform();ctx.globalCompositeOperation='destination-over';
    const radius=Math.max(.75*resolution,.5*resolution*factor);
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;ctx.drawImage(silhouette,Math.cos(a)*radius,Math.sin(a)*radius);}
    ctx.restore();
  }
  for (const [, , points] of eyes) {
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rx = Math.max(1.3, (Math.max(...xs) - Math.min(...xs)) * 1.2, .85 / factor);
    const ry = rx * 1.22;
    ctx.lineWidth = Math.max(.3, .24 / factor);
    ellipse(ctx, x - rx * .65, y, rx * .7, ry * .85, '#fffdf4');
    ellipse(ctx, x + rx * .25, y + .15, rx, ry, '#fffdf4');
    if (clip === 'rest') {
      ctx.beginPath(); ctx.moveTo(x - rx * .55, y); ctx.quadraticCurveTo(x + rx * .3, y + ry * .35, x + rx, y); ctx.stroke();
    } else ellipse(ctx, x + rx * .6, y + .25, Math.max(.4, rx * .29), Math.max(.5, ry * .33), INK, false);
    bounds.left = Math.min(bounds.left, x - rx * 1.35); bounds.top = Math.min(bounds.top, y - ry);
    bounds.right = Math.max(bounds.right, x + rx * 1.25); bounds.bottom = Math.max(bounds.bottom, y + ry);
  }
  metadata.get(canvas)!.bounds = {
    left: Math.max(0, (1 + bounds.left * factor - .6) * resolution),
    top: Math.max(0, (1 + bounds.top * factor - .6) * resolution),
    right: Math.min(canvas.width, (1 + bounds.right * factor + .6) * resolution),
    bottom: Math.min(canvas.height, (1 + bounds.bottom * factor + .6) * resolution),
  };
  return canvas;
}

/** Seamless, quiet ground colors with smooth inset motifs, no outlined tile grid. */
export function paintCartoonTerrain(terrain: Terrain, variant: number): HTMLCanvasElement {
  const palette = ['#328fc3','#68c9d8','#f2d589','#94c85f','#70ad50','#bcb8a3','#a8a28d','#b99678','#62bfd4','#6dc7df','#86b8a0','#786e68','#84d6dc','#aea08a','#78cbe6','#f88545'];
  const [canvas, ctx] = cartoonCanvas(16, 16);
  ctx.fillStyle = palette[terrain]; ctx.fillRect(0, 0, 16, 16);
  ctx.strokeStyle = terrain === Terrain.Lava ? '#ffc16c' : '#ffffff'; ctx.globalAlpha = .18; ctx.lineWidth = .6;
  if ([Terrain.DeepWater,Terrain.Shallows,Terrain.Pond,Terrain.River,Terrain.HotSpring,Terrain.Waterfall,Terrain.Lava].includes(terrain)) {
    for (let i = 0; i < 2; i++) { const y = 4 + i * 7 + variant % 2; ctx.beginPath(); ctx.moveTo(2, y); ctx.bezierCurveTo(5,y-1,7,y+1,10,y); ctx.stroke(); }
  } else if ([Terrain.Grass,Terrain.Forest,Terrain.Marsh].includes(terrain)) {
    ctx.strokeStyle = '#397439'; ctx.globalAlpha = .28;
    const x = 4 + variant * 2, y = 9 + variant % 3;
    ctx.beginPath(); ctx.moveTo(x-1,y); ctx.quadraticCurveTo(x-1,y-2,x-2,y-3); ctx.moveTo(x,y); ctx.quadraticCurveTo(x+1,y-3,x+2,y-3); ctx.stroke();
  } else {
    ctx.globalAlpha = .12; ctx.fillStyle = '#624f39'; ellipse(ctx, 5+variant, 10, 1.5, .7, '#624f39', false);
  }
  return canvas;
}

export function paintCartoonPerson(shirt: string, skin: string, hair: string, frame: number, kid = false, cap = false): HTMLCanvasElement {
  const height = kid ? 8 : 10;
  const [canvas, ctx] = cartoonCanvas(8, height + 2);
  ctx.lineWidth = .4;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#426290';
  ctx.beginPath(); ctx.roundRect(2, height-3, 1.5, 3, .5); ctx.roundRect(frame ? 4.5 : 4, height-3, 1.5, 3, .5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect(1.5, 4, 5, height-5, 1.2); ctx.fill(); ctx.stroke();
  ellipse(ctx, 1.5, 6, .65, 1.3, skin); ellipse(ctx, 6.5, 6, .65, 1.3, skin);
  ellipse(ctx, 4, 3.1, 2, 2.2, skin);
  ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(4, 1.9, 2.2, 1, 0, Math.PI, Math.PI*2); ctx.fill();
  if (cap) { ctx.beginPath(); ctx.roundRect(1.5, .6, 5, 1.3, .4); ctx.fill(); ctx.stroke(); }
  ctx.lineWidth = .18;
  ellipse(ctx, 3.5, 3, .5, .65, '#fff'); ellipse(ctx, 4.7, 3, .5, .65, '#fff');
  ellipse(ctx, 3.7, 3.1, .18, .28, INK, false); ellipse(ctx, 4.9, 3.1, .18, .28, INK, false);
  ctx.beginPath(); ctx.moveTo(3.7, 4.3); ctx.quadraticCurveTo(4.3, 4.6, 4.9, 4.2); ctx.stroke();
  return canvas;
}

export function paintCartoonEgg(accent: string): HTMLCanvasElement {
  const [canvas, ctx] = cartoonCanvas(11, 13);
  ctx.lineWidth = .65; ellipse(ctx, 5.5, 7, 4, 5, '#fff1bf');
  ellipse(ctx, 4, 5, .7, 1, accent, false); ellipse(ctx, 7, 8, .8, .7, accent, false); ellipse(ctx, 4, 9, .55, .7, accent, false);
  return canvas;
}

export function paintCartoonTrough(kind: string, full: boolean): HTMLCanvasElement {
  const [canvas, ctx] = cartoonCanvas(16, 10);
  ctx.lineWidth = .6; ctx.strokeStyle = INK;
  ctx.fillStyle = '#b67846'; ctx.beginPath(); ctx.roundRect(1, 3, 14, 6, 2); ctx.fill(); ctx.stroke();
  ellipse(ctx, 8, 3.5, 6.7, 2.3, '#754633');
  if (full) for (let i = 0; i < 5; i++) ellipse(ctx, 3.8+i*2, 3.4+(i%2)*.3, 1.5, .9, kind === 'plants' ? '#92c759' : kind === 'fish' ? '#86cddd' : '#ed8f85');
  return canvas;
}

export function paintCartoonJeep(): HTMLCanvasElement {
  const [canvas, ctx] = cartoonCanvas(24, 15);
  ctx.lineWidth = .65; ctx.strokeStyle = INK;
  ctx.fillStyle = '#ffd268'; ctx.beginPath(); ctx.roundRect(2, 6, 20, 6, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b7e9ef'; ctx.beginPath(); ctx.roundRect(13, 1, 7, 6, 1.5); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3,2); ctx.lineTo(15,2); ctx.stroke();
  ellipse(ctx, 6, 12, 2.5, 2.5, '#3f4141'); ellipse(ctx, 18, 12, 2.5, 2.5, '#3f4141');
  ellipse(ctx, 6, 12, 1, 1, '#eee5cd', false); ellipse(ctx, 18, 12, 1, 1, '#eee5cd', false);
  return canvas;
}
