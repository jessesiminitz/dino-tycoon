import type { Dino, GameState } from './GameState';
import { applyCommand, type Command } from './commands';
import type { BuildingKind } from './data/economy';
import type { DecorKind } from './data/decor';
import type { FeederKind } from './data/feeders';
import type { FenceTypeId } from './data/fences';
import type { StaffRole } from './data/staff';
import type { SpeciesId } from './data/species';
import { newFinance } from './finance';
import { allFenceEdges, fenceAt, setFenceHp } from './fences';
import { boxEdges, tileLine } from './grid';
import { parcelGrid, PARCEL } from './land';
import { Rng } from './rng';
import { Terrain } from './terrain';

/**
 * Builds a prebuilt park for a challenge with the same commands a player
 * uses, so it stays valid as the rules change. Coordinates are relative to the
 * park gate: dx east, dy south (so the park runs north with negative dy).
 * Any step that fails throws, and tests build every challenge.
 */
export class ParkBuilder {
  readonly rng: Rng;
  private gx: number;
  private gy: number;

  constructor(readonly state: GameState) {
    this.gx = state.entrance.x;
    this.gy = state.entrance.y;
    this.rng = new Rng((state.seed ^ 0xb111d) >>> 0);
    state.money = 1e9; // building is free; finish() sets the real balance
  }

  /** Absolute tile for a spot relative to the gate. */
  at(dx: number, dy: number): { x: number; y: number } {
    return { x: this.gx + dx, y: this.gy + dy };
  }

  private run(cmd: Command, what: string): void {
    const r = applyCommand(this.state, cmd);
    if (!r.ok) throw new Error(`Park builder: ${what} failed: ${r.message}`);
  }

  /**
   * Readies the ground from (dx0, dy0) to (dx1, dy1) inclusive: buys the land
   * and turns everything that isn't open grass or beach (water, marsh,
   * cliffs, rock, trees) into grass, leaving the gate alone.
   */
  prepare(dx0: number, dy0: number, dx1: number, dy1: number): void {
    const { state } = this;
    const { width } = state.map;
    const { cols } = parcelGrid(state.map);
    for (let y = this.gy + dy0; y <= this.gy + dy1; y++)
      for (let x = this.gx + dx0; x <= this.gx + dx1; x++) {
        const i = y * width + x;
        const t = state.map.tiles[i];
        if (t === Terrain.Volcano) throw new Error('Park builder: the park would cover the volcano');
        const gate = x === this.gx && y === this.gy;
        if (!gate && t !== Terrain.Grass && t !== Terrain.Sand) {
          state.map.tiles[i] = Terrain.Grass;
          state.map.heights[i] = Math.max(state.map.heights[i], 4);
        }
        state.parcelsOwned[Math.floor(y / PARCEL) * cols + Math.floor(x / PARCEL)] = true;
      }
  }

  /** A fenced paddock with corners at vertices (dx0, dy0) and (dx1, dy1). */
  paddock(dx0: number, dy0: number, dx1: number, dy1: number, fence: FenceTypeId): void {
    const a = this.at(dx0, dy0);
    const b = this.at(dx1, dy1);
    this.run({ type: 'buildFences', edges: boxEdges(a.x, a.y, b.x, b.y), fence }, 'paddock fence');
  }

  /** A footpath through the given points (relative to the gate), in straight runs. */
  path(...points: [number, number][]): void {
    const { width } = this.state.map;
    const tiles: number[] = [];
    for (let k = 1; k < points.length; k++) {
      const a = this.at(...points[k - 1]);
      const b = this.at(...points[k]);
      for (const [x, y] of tileLine(a.x, a.y, b.x, b.y, true)) tiles.push(y * width + x);
    }
    this.run({ type: 'buildPaths', tiles }, 'path');
  }

  /** Takes up path tiles again (to strand a building nobody can reach). */
  removePath(...points: [number, number][]): void {
    const { width } = this.state.map;
    const tiles = points.map(([dx, dy]) => {
      const p = this.at(dx, dy);
      return p.y * width + p.x;
    });
    this.run({ type: 'removePaths', tiles }, 'remove path');
  }

  building(kind: BuildingKind, dx: number, dy: number): void {
    this.run({ type: 'placeBuilding', kind, ...this.at(dx, dy) }, kind);
  }

  feeder(kind: FeederKind, dx: number, dy: number): void {
    this.run({ type: 'placeFeeder', kind, ...this.at(dx, dy) }, `${kind} feeder`);
  }

  decor(kind: DecorKind, dx: number, dy: number): void {
    this.run({ type: 'placeDecor', kind, ...this.at(dx, dy) }, kind);
  }

  dino(species: SpeciesId, dx: number, dy: number): Dino {
    const { state } = this;
    if (!state.unlockedSpecies.includes(species)) state.unlockedSpecies.push(species);
    this.run({ type: 'buyDino', species, ...this.at(dx, dy) }, species);
    return state.dinos[state.dinos.length - 1];
  }

  hire(role: StaffRole, count = 1): void {
    for (let k = 0; k < count; k++) this.run({ type: 'hireStaff', role }, role);
  }

  /** A bank loan the park already owes. */
  owe(amount: number): void {
    this.state.finance.loans.push({ id: this.state.nextId++, principal: amount, balance: amount });
  }

  /** Wears every fence down to a random condition between `min` and `max`. */
  wearFences(min: number, max: number): void {
    for (const e of allFenceEdges(this.state)) if (fenceAt(this.state, e)) setFenceHp(this.state, e, this.rng.int(min, max));
  }

  /** Breaks `count` random fence sections outright. */
  breakFences(count: number): void {
    const fenced = allFenceEdges(this.state).filter((e) => fenceAt(this.state, e));
    for (let k = 0; k < count && fenced.length; k++) setFenceHp(this.state, fenced.splice(this.rng.int(0, fenced.length - 1), 1)[0], 0);
  }

  /**
   * Done: the real bank balance, a clean set of books (building the park
   * isn't this owner's spending), and a starting reputation.
   */
  finish(money: number, reputation: number): void {
    const { state } = this;
    const loans = state.finance.loans;
    state.finance = newFinance();
    state.finance.loans = loans;
    state.money = money;
    state.reputation = reputation;
    state.log = [];
  }
}
