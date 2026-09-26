import Phaser from 'phaser';
import type { Simulation } from '../sim/Simulation';

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

  update(_time: number, delta: number): void {
    const stormy = this.sim.state.stormHours > 0;
    this.intensity = Phaser.Math.Clamp(this.intensity + (stormy ? 1 : -1) * delta * FADE_PER_MS, 0, 1);
    const g = this.g.clear();
    if (this.intensity <= 0) return;

    const { width, height } = this.scale;
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

    if (stormy && this.sim.speed > 0 && Math.random() < LIGHTNING_CHANCE * (delta / 16.7)) this.flash = 1;
    if (this.flash > 0) {
      g.fillStyle(0xffffff, 0.35 * this.flash).fillRect(0, 0, width, height);
      this.flash = Math.max(0, this.flash - delta / 180);
    }
  }
}
