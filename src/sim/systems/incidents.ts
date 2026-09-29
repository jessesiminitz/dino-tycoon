import { FENCE_TYPES } from '../data/fences';
import { habitatOf, SPECIES } from '../data/species';
import { allFenceEdges, fenceAt, fenceHp, fenceTypeAt, setFenceHp, tileEdges } from '../fences';
import type { SimContext } from './context';
import { dinoLabel, isRestless } from './dinos';

/** Chance per hour that a restless dino shoves each fence beside it. */
const PUSH_CHANCE = 0.5;
/** About a 1-in-3 chance per animal per month for a healthy, contented dino. */
const BASE_SICK_CHANCE = 0.0005;
/** Extra chance per hour for each sick animal sharing the paddock. */
const CONTAGION = 0.004;
/** Most animals shake an illness off within a couple of days; a vet is faster and safer. */
const SPONTANEOUS_RECOVERY = 0.015;

/**
 * Hourly fence wear from weather and age, plus hungry or unhappy dinosaurs
 * shoving the fences around them: a fence weaker than the species needs gives
 * way within a few hours.
 */
export function hourlyFences(ctx: SimContext): void {
  const { state, rng } = ctx;
  let brokeFromWear = 0;

  for (const e of allFenceEdges(state)) {
    const hp = fenceHp(state, e);
    if (hp <= 0) continue;
    const type = FENCE_TYPES[fenceTypeAt(state, e) as 1 | 2 | 3 | 4];
    const next = hp - (type.decayPerDay / 24) * (0.5 + rng.next());
    setFenceHp(state, e, next);
    if (next <= 0) brokeFromWear++;
  }
  if (brokeFromWear > 0) {
    ctx.invalidateWorld();
    ctx.emit({ text: `${brokeFromWear} fence segment${brokeFromWear === 1 ? ' has' : 's have'} rotted through!`, kind: 'bad' });
  }

  for (const d of state.dinos) {
    if (d.escaped || d.baby || !isRestless(d)) continue;
    const sp = SPECIES[d.species];
    for (const e of tileEdges(d.x, d.y)) {
      const type = fenceAt(state, e);
      if (!type || !rng.chance(PUSH_CHANCE)) continue;
      const damage = FENCE_TYPES[type].strength >= sp.fenceNeeded ? rng.int(1, 3) : rng.int(20, 35);
      const next = fenceHp(state, e) - damage;
      setFenceHp(state, e, next);
      if (next <= 0) {
        ctx.invalidateWorld();
        ctx.emit({ text: `${dinoLabel(d)} smashed through a ${FENCE_TYPES[type].name.toLowerCase()} fence!`, kind: 'bad' });
      }
    }
  }
}

/** Every step: notice dinos that got out (or were fenced back in) and remember home tiles. */
export function stepEscapes(ctx: SimContext): void {
  const { state, regions } = ctx;
  for (const d of state.dinos) {
    const region = regions.regions[regions.tileRegion[d.y * state.map.width + d.x]];
    // Flyers are only held by an aviary: a paddock netted all round.
    const loose = region?.kind !== 'paddock' || (habitatOf(d.species) === 'air' && !region.covered);
    if (loose && !d.escaped) {
      d.escaped = true;
      state.stats.escapes++;
      state.stats.lastEscapeHour = state.hours;
      ctx.emit({ text: `🚨 ${dinoLabel(d)} has escaped!`, kind: 'bad' });
    } else if (!loose) {
      d.escaped = false;
      d.homeX = d.x;
      d.homeY = d.y;
    }
  }
}

/** Hourly: dinos fall ill (more often when weak or unhappy); illness spreads within a paddock. */
export function hourlyHealth(ctx: SimContext): void {
  const { state, rng, regions } = ctx;
  const w = state.map.width;
  const sickByRegion = new Map<number, number>();
  for (const d of state.dinos) {
    if (!d.sick) continue;
    const r = regions.tileRegion[d.y * w + d.x];
    sickByRegion.set(r, (sickByRegion.get(r) ?? 0) + 1);
  }
  for (const d of state.dinos) {
    if (d.sick) {
      if (rng.chance(SPONTANEOUS_RECOVERY)) {
        d.sick = false;
        ctx.emit({ text: `${dinoLabel(d)} has recovered`, kind: 'good' });
      }
      continue;
    }
    const nearbySick = sickByRegion.get(regions.tileRegion[d.y * w + d.x]) ?? 0;
    const chance =
      BASE_SICK_CHANCE + (d.health < 60 ? 0.003 : 0) + (d.happiness < 40 ? 0.002 : 0) + nearbySick * CONTAGION;
    if (rng.chance(chance)) {
      d.sick = true;
      ctx.emit({ text: `🤒 ${dinoLabel(d)} is sick`, kind: 'bad' });
    }
  }
}
