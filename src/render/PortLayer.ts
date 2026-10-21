import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';
import type { FerrySize } from '../sim/data/port';
import { ferryPose, portSite, type FerryPose, type PortSite } from '../sim/port';
import { calendar } from '../sim/GameState';
import { getSettings } from '../ui/settings';
import { ART_STYLE } from './artStyle';
import { addPaintedTexture, fitPaintedImage } from './paintedTexture';
import { FERRY_SIZE, paintFerry, paintLighthouse, paintTicketHut } from './portArt';
import { depthAt } from './worldDepth';
import { TILE } from './tileset';

/** How far (world px) ferries sail in from and out to, south-west and south-east of their berth. */
const SAIL_X = 7 * TILE;
const SAIL_Y = 6 * TILE;
/** Passengers shown walking ashore per ferry (the rest are behind them on board). */
const MAX_WALKERS = 10;
/** Fraction of the docked time passengers take to reach the gate (they land LANDING_STEPS in). */
const WALK_DONE = 0.75;
const VISITOR_LOOKS = 6;
const WOOD = { deck: 0x9b6b3d, seam: 0x7a5230, light: 0xc39754, face: 0x5b3d22, post: 0x3d2a18 };
const STONE = { deck: 0x9a9c93, seam: 0x7b7d75, light: 0xc4c5bd, face: 0x5d5f58, post: 0x4b4d47 };

const ferryKey = (size: FerrySize, lit: boolean) => `ferry-${size}-${ART_STYLE}${lit ? '-lit' : ''}`;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * The ferry port beside the gate: a jetty, pier or stone harbor over the
 * water, and the ferries sailing in on the timetable in `sim/port.ts`. Docked
 * ferries put a gangway down and their passengers walk up the pier to the
 * gate, arriving just as the simulation lets them in.
 */
export class PortLayer {
  private deck: Phaser.GameObjects.Graphics;
  private water: Phaser.GameObjects.Graphics;
  private ferries: Phaser.GameObjects.Image[] = [];
  private walkers: Phaser.GameObjects.Image[] = [];
  private props: Phaser.GameObjects.Image[] = [];
  private drawn = '';
  site!: PortSite;

  constructor(
    private scene: Phaser.Scene,
    private sim: Simulation,
  ) {
    for (const size of Object.keys(FERRY_SIZE) as FerrySize[])
      for (const lit of [false, true]) if (!scene.textures.exists(ferryKey(size, lit))) addPaintedTexture(scene, ferryKey(size, lit), paintFerry(size, ART_STYLE, lit));
    for (const [key, paint] of [
      [`lighthouse-${ART_STYLE}`, paintLighthouse],
      [`ticket-hut-${ART_STYLE}`, paintTicketHut],
    ] as const)
      if (!scene.textures.exists(key)) addPaintedTexture(scene, key, paint(ART_STYLE));
    this.water = scene.add.graphics().setDepth(0.44);
    this.deck = scene.add.graphics().setDepth(0.46);
    this.drawDeck();
  }

  /** The pier and its buildings, redrawn when the port is upgraded. */
  private drawDeck(): void {
    const { state } = this.sim;
    const level = state.port.level;
    this.drawn = `${level}`;
    this.site = portSite(state.map, state.entrance, level);
    const { x, y0, y1, headX0, headX1 } = this.site;
    const g = this.deck.clear();
    const c = level === 2 ? STONE : WOOD;
    const width = [10, 12, 14][level];
    const left = x * TILE + (TILE - width) / 2;
    const top = y0 * TILE - 2;
    const bottom = (y1 + 1) * TILE;

    // Posts down into the water, then the walkway and its front face.
    g.fillStyle(c.post, 1);
    for (let y = y0; y <= y1; y++) {
      g.fillRect(left - 1, (y + 1) * TILE - 3, 2, 5);
      g.fillRect(left + width - 1, (y + 1) * TILE - 3, 2, 5);
    }
    g.fillStyle(c.deck, 1).fillRect(left, top, width, bottom - top);
    g.fillStyle(c.seam, 1);
    for (let y = top + 3; y < bottom; y += 3) g.fillRect(left, y, width, 1);
    g.fillStyle(c.light, 1).fillRect(left, top, 1, bottom - top);
    if (level > 0) {
      const hx = headX0 * TILE;
      const hw = (headX1 - headX0 + 1) * TILE;
      const hy = y1 * TILE + 1;
      const hh = TILE - 1 + (level === 2 ? 2 : 0);
      g.fillStyle(c.post, 1);
      for (let px = hx + 2; px < hx + hw; px += 8) g.fillRect(px, hy + hh - 2, 2, 5);
      g.fillStyle(c.deck, 1).fillRect(hx, hy, hw, hh);
      g.fillStyle(c.seam, 1);
      if (level === 2) {
        // Dressed stone blocks.
        for (let y = hy + 4; y < hy + hh; y += 5) g.fillRect(hx, y, hw, 1);
        for (let row = 0; row * 5 < hh; row++) for (let px = hx + (row % 2 ? 4 : 0); px < hx + hw; px += 9) g.fillRect(px, hy + row * 5, 1, 4);
      } else for (let px = hx + 3; px < hx + hw; px += 3) g.fillRect(px, hy, 1, hh);
      g.fillStyle(c.light, 1).fillRect(hx, hy, hw, 1);
      g.fillStyle(c.face, 1).fillRect(hx, hy + hh, hw, 2);
      // Bollards along the edge.
      g.fillStyle(0x2b2b2b, 1);
      for (const b of this.site.berths) {
        g.fillRect(Math.round(b.x * TILE) - 6, hy + hh - 4, 2, 3);
        g.fillRect(Math.round(b.x * TILE) + 4, hy + hh - 4, 2, 3);
      }
    } else {
      g.fillStyle(c.face, 1).fillRect(left, bottom, width, 2);
    }

    for (const p of this.props) p.destroy();
    this.props = [];
    const prop = (key: string, px: number, py: number, w: number, h: number) => {
      const img = this.scene.add.image(px, py, key).setOrigin(0.5, 1).setDisplaySize(w, h).setDepth(depthAt(py));
      this.props.push(img);
    };
    if (level >= 1) prop(`ticket-hut-${ART_STYLE}`, (level === 2 ? headX0 : headX1) * TILE + TILE / 2, (y1 + 1) * TILE - 3, 14, 16);
    if (level === 2) prop(`lighthouse-${ART_STYLE}`, headX1 * TILE + TILE / 2, (y1 + 1) * TILE - 1, 12, 34);
  }

  /** Where ferry `k` ties up: its hull's waterline centre, in world pixels. */
  private berth(k: number, size: FerrySize): { x: number; y: number } {
    const b = this.site.berths[k] ?? this.site.berths[0];
    return { x: b.x * TILE, y: (this.site.y1 + 1) * TILE + Math.round(FERRY_SIZE[size].h * 0.75) };
  }

  update(time: number): void {
    const { state } = this.sim;
    if (this.drawn !== `${state.port.level}`) this.drawDeck();
    const now = state.hours + this.sim.stepProgressInHour;
    const { hour } = calendar(state);
    const lit = hour >= 19 || hour < 7;
    const motion = getSettings().animation;
    const water = this.water.clear();
    let walkerIndex = 0;

    state.port.ferries.forEach((size, k) => {
      const img = (this.ferries[k] ??= this.scene.add.image(0, 0, ferryKey(size, lit)).setOrigin(0.5, 1));
      const pose: FerryPose = ferryPose(state, k, now);
      if (pose.mode === 'away') {
        img.setVisible(false);
        return;
      }
      const { w, h } = FERRY_SIZE[size];
      const berth = this.berth(k, size);
      let x = berth.x;
      let y = berth.y;
      let alpha = 1;
      let moving = false;
      if (pose.mode === 'arriving') {
        const e = easeOut(pose.t);
        x = berth.x - SAIL_X * (1 - e);
        y = berth.y + SAIL_Y * (1 - e);
        alpha = Math.min(1, pose.t / 0.25);
        moving = pose.t < 0.97;
      } else if (pose.mode === 'leaving') {
        const e = pose.t * pose.t;
        x = berth.x + SAIL_X * e;
        y = berth.y + SAIL_Y * e;
        alpha = Math.min(1, (1 - pose.t) / 0.25);
        moving = pose.t > 0.03;
      }
      const bob = motion ? Math.sin(time / 520 + k * 1.7) * (moving ? 0.6 : 0.9) : 0;
      img.setTexture(ferryKey(size, lit));
      img.setDisplaySize(w, h).setVisible(true).setAlpha(alpha);
      img.setPosition(ART_STYLE === 'cartoon' ? x : Math.round(x), Math.round(y + bob)).setDepth(depthAt(y));

      // Foam where the hull meets the water, and a wake while under way.
      water.fillStyle(0xffffff, 0.3 * alpha).fillEllipse(x, y - 1, w * 0.95, 4);
      if (moving) {
        const sternX = x - w / 2;
        for (let i = 1; i <= 3; i++) {
          const fade = (0.45 - i * 0.1) * alpha;
          water.fillStyle(0xffffff, fade);
          water.fillRect(sternX - i * 7, y - 2 + i * (pose.mode === 'arriving' ? 2 : -0.5), 5, 1);
          water.fillRect(sternX - i * 6, y + i * 1.5, 4, 1);
        }
      }
      if (pose.mode !== 'docked') return;
      // A gangway down from the pier head, and passengers walking ashore.
      const edge = (this.site.y1 + 1) * TILE + (state.port.level === 2 ? 2 : 0);
      const deckY = berth.y - Math.round(h * 0.55);
      if (deckY > edge) {
        water.fillStyle(0x3d2a18, 1).fillRect(berth.x - 3, edge - 1, 6, deckY - edge + 1);
        water.fillStyle(0xc39754, 1).fillRect(berth.x - 2, edge - 1, 4, deckY - edge + 1);
      }
      const shown = Math.min(MAX_WALKERS, pose.passengers);
      const spread = Math.min(0.07, 0.5 / Math.max(1, shown - 1));
      for (let i = 0; i < shown; i++) {
        const p = (pose.t / WALK_DONE - i * spread) / (1 - (shown - 1) * spread);
        if (p <= 0 || p >= 1) continue;
        this.walker(walkerIndex++, k, i, p, berth.x, edge - 2, time);
      }
    });
    for (let k = state.port.ferries.length; k < this.ferries.length; k++) this.ferries[k].setVisible(false);
    for (let i = walkerIndex; i < this.walkers.length; i++) this.walkers[i].setVisible(false);
  }

  /** Passenger `i` of ferry `k`, `p` (0–1) of the way from the gangway to the gate. */
  private walker(slot: number, k: number, i: number, p: number, fromX: number, fromY: number, time: number): void {
    const { x, y0, y1 } = this.site;
    const midX = x * TILE + TILE / 2 + ((i % 3) - 1) * 2;
    const headY = y1 * TILE + 9;
    const gateY = y0 * TILE + 2;
    const legs = [Math.hypot(midX - fromX, headY - fromY), gateY < headY ? headY - gateY : 0];
    let s = p * (legs[0] + legs[1]);
    let px: number;
    let py: number;
    let left: boolean;
    if (s <= legs[0] || legs[1] === 0) {
      const f = legs[0] ? Math.min(1, s / legs[0]) : 1;
      px = fromX + (midX - fromX) * f;
      py = fromY + (headY - fromY) * f;
      left = midX < fromX;
    } else {
      s -= legs[0];
      px = midX;
      py = headY - s;
      left = i % 2 === 0;
    }
    const look = (k * 5 + i * 3) % VISITOR_LOOKS;
    const frame = Math.floor(time / 180 + i) % 2;
    const key = `visitor-${look}-${frame}-${i % 4 === 1 ? 'k' : 'a'}-n`;
    const img = (this.walkers[slot] ??= this.scene.add.image(0, 0, key).setOrigin(0.5, 1));
    img.setTexture(key);
    fitPaintedImage(img);
    img.setVisible(true).setFlipX(left).setPosition(Math.round(px), Math.round(py)).setDepth(depthAt(py));
  }

  /** Lights for the night: lamps on the pier, the lighthouse, and a moored ferry's windows. */
  lights(): { x: number; y: number; radius: number }[] {
    const { x, y1, headX1 } = this.site;
    const level = this.sim.state.port.level;
    const out = [{ x: x * TILE + TILE / 2, y: y1 * TILE + 6, radius: 2.4 }];
    if (level === 2) out.push({ x: headX1 * TILE + TILE / 2, y: (y1 + 1) * TILE - 28, radius: 4.5 });
    // The ferry tied up for the night has its cabin lights on.
    const moored = this.ferries[0];
    if (moored?.visible) out.push({ x: moored.x, y: moored.y - moored.displayHeight / 2, radius: 1.8 });
    return out;
  }
}
