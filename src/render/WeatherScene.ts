import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';
import { playSfx, setRain } from '../audio/audio';
import { calendar } from '../sim/GameState';
import { getSettings } from '../ui/settings';
import { TILE } from './tileset';
import { lightAt } from './daylight';

/** Night sky over the park, and how much of it a full night puts on screen. */
const NIGHT = 0x0a1430;
const NIGHT_ALPHA = 0.62;
const GLOW_KEY = 'night-glow';
/** Light radius (in tiles) of things that glow after dark. */
const LIGHTS = { lamp: 3.2, building: 2.2, gate: 3, jeep: 1.6 } as const;
const LIT_BUILDINGS = new Set(['restaurant', 'snackstall', 'giftshop', 'restroom', 'station', 'tower', 'petting']);

const DROPS = 140;
const FADE_PER_MS = 1 / 1500;
/** Chance per frame (at 60 fps) of a lightning flash during a storm. */
const LIGHTNING_CHANCE = 0.004;

interface Drop {
  x: number;
  y: number;
  speed: number;
}

/**
 * Screen-space weather drawn above the park: a darker sky, slanting rain and
 * the occasional lightning flash while a storm is on. Runs as its own scene
 * so it isn't scaled by the park camera's zoom, and takes no input.
 */
export class WeatherScene extends Phaser.Scene {
  private sim!: Simulation;
  private g!: Phaser.GameObjects.Graphics;
  /** Darkness, with pools of light erased out of it around lamps and buildings. */
  private night!: Phaser.GameObjects.RenderTexture;
  private stamp!: Phaser.GameObjects.Image;
  /** A faint warm glow added on top of each light. */
  private glow!: Phaser.GameObjects.Graphics;
  /** What the night layer was last drawn for: it's only redrawn when this changes. */
  private nightKey = '';
  private drops: Drop[] = [];
  private intensity = 0;
  private flash = 0;

  constructor() {
    super('weather');
  }

  init(data: { sim: Simulation }): void {
    this.sim = data.sim;
  }

  create(): void {
    this.input.enabled = false;
    if (!this.textures.exists(GLOW_KEY)) {
      // A soft round light: solid in the middle, fading to nothing at the edge.
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      this.textures.addCanvas(GLOW_KEY, c);
    }
    const { width, height } = this.scale;
    this.night = this.add.renderTexture(0, 0, width, height).setOrigin(0).setVisible(false);
    this.stamp = this.make.image({ key: GLOW_KEY, add: false });
    this.glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.scale.on('resize', (size: Phaser.Structs.Size) => this.night.resize(size.width, size.height));
    this.g = this.add.graphics();
    for (let i = 0; i < DROPS; i++) this.drops.push(this.newDrop(true));
  }

  private newDrop(anywhere: boolean): Drop {
    const { width, height } = this.scale;
    return {
      x: Math.random() * (width + 200) - 100,
      y: anywhere ? Math.random() * height : -20,
      speed: 0.6 + Math.random() * 0.5,
    };
  }

  /** Screen positions and radii of everything that glows after dark. */
  private glowingSpots(): { x: number; y: number; r: number }[] {
    const park = this.scene.get('park');
    const cam = park?.cameras?.main;
    if (!cam) return [];
    const { state } = this.sim;
    const out: { x: number; y: number; r: number }[] = [];
    const add = (wx: number, wy: number, tiles: number) =>
      out.push({ x: (wx - cam.worldView.x) * cam.zoom, y: (wy - cam.worldView.y) * cam.zoom, r: tiles * TILE * cam.zoom });
    for (const d of state.decor) if (d.kind === 'lamp') add(d.x * TILE + TILE / 2, d.y * TILE - 4, LIGHTS.lamp);
    for (const b of state.buildings) if (LIT_BUILDINGS.has(b.kind)) add(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2, LIGHTS.building);
    add(state.entrance.x * TILE + TILE / 2, state.entrance.y * TILE + TILE / 2, LIGHTS.gate);
    for (const j of state.jeeps) add(j.x * TILE + TILE / 2, j.y * TILE + TILE / 2, LIGHTS.jeep);
    // Only what's on screen (with a margin for the glow).
    const { width, height } = this.scale;
    return out.filter((l) => l.x > -l.r && l.y > -l.r && l.x < width + l.r && l.y < height + l.r);
  }

  /** Dusk, night and dawn: tint the screen, darken it, and light it back up around lamps and buildings. */
  private drawNight(): number {
    const { hour } = calendar(this.sim.state);
    const { dark, warm } = lightAt(hour + this.sim.stepProgressInHour);
    const strength = getSettings().nightDarkness;
    const night = dark * strength;
    this.glow.clear();
    if (night < 0.02) {
      this.night.setVisible(false);
      this.nightKey = '';
      return warm * strength;
    }
    const { width, height } = this.scale;
    const spots = this.glowingSpots();
    this.night.setVisible(true);
    for (const l of spots) this.glow.fillStyle(0xffc860, 0.12 * night).fillCircle(l.x, l.y, l.r * 0.55);
    // Redrawing a full-screen layer every frame is costly on older devices: only redo it when
    // the view, the darkness or the lights have changed.
    const key = `${width}x${height}|${night.toFixed(2)}|${spots.map((l) => `${Math.round(l.x)},${Math.round(l.y)},${Math.round(l.r)}`).join(';')}`;
    if (key !== this.nightKey) {
      this.nightKey = key;
      this.night.clear().fill(NIGHT, NIGHT_ALPHA * night, 0, 0, width, height);
      for (const l of spots) {
        this.stamp.setScale((l.r * 2) / 128).setPosition(l.x, l.y);
        this.night.erase(this.stamp);
      }
    }
    return warm * strength;
  }

  update(_time: number, delta: number): void {
    const warm = this.drawNight();
    const stormy = this.sim.state.stormHours > 0;
    this.intensity = Phaser.Math.Clamp(this.intensity + (stormy ? 1 : -1) * delta * FADE_PER_MS, 0, 1);
    setRain(this.sim.speed > 0 ? this.intensity : 0);
    const g = this.g.clear();
    const { width, height } = this.scale;
    // Sunset and sunrise glow.
    if (warm > 0.01) g.fillStyle(0xff8a3a, 0.16 * warm).fillRect(0, 0, width, height);
    if (this.intensity <= 0) return;

    g.fillStyle(0x0b1a2a, 0.3 * this.intensity).fillRect(0, 0, width, height);

    // Rain: game speed makes it fall faster too, so fast-forward feels fast.
    const pace = delta * Math.max(1, this.sim.speed);
    g.lineStyle(1, 0xbfd9ee, 0.55 * this.intensity);
    for (const d of this.drops) {
      d.y += d.speed * pace;
      d.x -= d.speed * pace * 0.35;
      if (d.y > height || d.x < -20) Object.assign(d, this.newDrop(false));
      g.lineBetween(d.x, d.y, d.x + 3, d.y - 9);
    }

    if (stormy && this.sim.speed > 0 && Math.random() < LIGHTNING_CHANCE * (delta / 16.7)) {
      this.flash = 1;
      // Thunder follows the flash.
      this.time.delayedCall(250 + Math.random() * 500, () => playSfx('thunder'));
    }
    if (this.flash > 0) {
      g.fillStyle(0xffffff, 0.35 * this.flash).fillRect(0, 0, width, height);
      this.flash = Math.max(0, this.flash - delta / 180);
    }
  }
}
