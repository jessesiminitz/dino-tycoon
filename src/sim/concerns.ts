import type { Dino, GameState, Staff } from './GameState';
import { FEEDER_TYPES } from './data/feeders';
import { SPECIES } from './data/species';
import { FENCE_TYPES } from './data/fences';
import { REFILL_BELOW, REPAIR_BELOW } from './data/staff';
import { ADVICE, TOPICS, type Topic } from './data/thoughts';
import { allFenceEdges, fenceHp } from './fences';
import type { RegionMap } from './regions';
import { canEat, paddockIsFilthy } from './systems/dinos';

/** Filterable reasons a dino (or staff member) is unhappy. */
export type DinoTag = 'hungry' | 'sick' | 'escaped' | 'crowded' | 'lonely' | 'danger' | 'feeder' | 'fence' | 'dung';
export type StaffTag = 'overworked' | 'idle';

export interface Concern<T extends string> {
  text: string;
  good: boolean;
  tag?: T;
}

/** What a dinosaur would tell you, worked out live from its paddock. */
export function dinoConcerns(state: GameState, regions: RegionMap, d: Dino): Concern<DinoTag>[] {
  const sp = SPECIES[d.species];
  const w = state.map.width;
  const regionId = regions.tileRegion[d.y * w + d.x];
  const region = regions.regions[regionId];
  const out: Concern<DinoTag>[] = [];
  if (d.escaped || region?.kind !== 'paddock') out.push({ text: "I'm out! Send a guard to bring me home.", good: false, tag: 'escaped' });
  if (d.sick) out.push({ text: 'I feel awful. A vet would help.', good: false, tag: 'sick' });
  if (d.hunger >= 80) out.push({ text: "I'm starving!", good: false, tag: 'hungry' });
  else if (d.hunger >= 50) out.push({ text: 'Getting hungry...', good: false, tag: 'hungry' });
  if (region?.kind === 'paddock') {
    const tiles = new Set(region.tiles);
    const diet = sp.diet;
    const feeders = state.feeders.filter((f) => FEEDER_TYPES[f.kind].diet === diet && tiles.has(f.y * w + f.x));
    if (feeders.length === 0) out.push({ text: `There's no ${diet === 'herbivore' ? 'plant' : 'meat'} feeder in my paddock.`, good: false, tag: 'feeder' });
    else if (feeders.every((f) => f.stock === 0)) out.push({ text: 'My feeder is empty.', good: false, tag: 'feeder' });
    else if (feeders.every((f) => f.stock < FEEDER_TYPES[f.kind].capacity * REFILL_BELOW))
      out.push({ text: 'My feeder is running low.', good: false, tag: 'feeder' });

    const group = state.dinos.filter((o) => regions.tileRegion[o.y * w + o.x] === regionId);
    const spaceWanted = group.reduce((sum, o) => sum + SPECIES[o.species].space, 0);
    if (spaceWanted > region.tiles.length) out.push({ text: 'Too cramped in here. We need a bigger paddock.', good: false, tag: 'crowded' });
    if (sp.social && !group.some((o) => o !== d && o.species === d.species))
      out.push({ text: `I'm lonely. I'd love another ${sp.name} to keep me company.`, good: false, tag: 'lonely' });
    const predator = group.find((o) => canEat(o, d));
    if (predator) out.push({ text: `There's a ${SPECIES[predator.species].name} in here with me!`, good: false, tag: 'danger' });
    const dung = state.messes.filter((m) => m.kind === 'dung' && regions.tileRegion[m.y * w + m.x] === regionId).length;
    if (paddockIsFilthy(dung, group.length)) out.push({ text: 'Our paddock is full of dung. A worker could tidy it up.', good: false, tag: 'dung' });
    if (region.weakestFence !== 0 && region.weakestFence < sp.fenceNeeded)
      out.push({ text: `${FENCE_TYPES[region.weakestFence].name} fences can't hold me. I need ${FENCE_TYPES[sp.fenceNeeded].name.toLowerCase()} or stronger.`, good: false, tag: 'fence' });
  }
  if (out.length === 0) out.push({ text: d.happiness >= 80 ? 'Life is good!' : 'Doing fine.', good: true });
  return out;
}

/** How a staff member feels about their workload. */
export function staffConcerns(state: GameState, m: Staff): Concern<StaffTag>[] {
  const same = state.staff.filter((o) => o.role === m.role).length;
  const busy = (jobs: number, perHead: number, heavy: string, none: string): Concern<StaffTag>[] => {
    if (jobs / same > perHead) return [{ text: heavy, good: false, tag: 'overworked' }];
    if (jobs === 0) return [{ text: none, good: true }];
    return [{ text: `${jobs} job${jobs === 1 ? '' : 's'} waiting. Keeping up.`, good: true }];
  };
  switch (m.role) {
    case 'worker': {
      const fences = allFenceEdges(state).filter((e) => fenceHp(state, e) < REPAIR_BELOW).length;
      const feeders = state.feeders.filter((f) => f.stock < FEEDER_TYPES[f.kind].capacity * REFILL_BELOW).length;
      const dung = state.messes.filter((x) => x.kind === 'dung').length;
      // Dung waits for a quiet moment, so it only counts a little toward the workload.
      const out = busy(fences + feeders + Math.floor(dung / 4), 8, `${fences} fences to mend and ${feeders} feeders to fill. Too much for us! Hire another worker.`, 'All fences and feeders are in good shape.');
      if (dung > 0) out.push({ text: `${dung} dino dropping${dung === 1 ? '' : 's'} to shovel when there's time.`, good: true });
      return out;
    }
    case 'guard': {
      const loose = state.dinos.filter((d) => d.escaped).length;
      return busy(loose, 1, `${loose} dinosaurs on the loose. We need more guards!`, 'All quiet. Every animal is where it should be.');
    }
    case 'vet': {
      const patients = state.dinos.filter((d) => d.sick || d.health < 60).length;
      return busy(patients, 3, `${patients} animals need treatment. Hire another vet!`, 'Everyone is healthy.');
    }
    case 'janitor': {
      const dirt = state.messes.filter((x) => x.kind !== 'dung').length;
      const messes = state.messes.filter((x) => x.kind === 'mess').length;
      const out = busy(dirt, 10, `${dirt} messes and bits of litter to clean. I can't keep up! Hire another janitor.`, 'The paths are spotless.');
      if (messes > 0 && !state.buildings.some((b) => b.kind === 'restroom'))
        out.push({ text: 'Visitors keep having accidents. The park needs restrooms!', good: false });
      else if (dirt > 0 && !state.buildings.some((b) => b.kind === 'trashcan'))
        out.push({ text: 'Trash cans would stop people dropping litter.', good: false });
      return out;
    }
    case 'guide':
    case 'mascot': {
      const crowd = state.visitors.length;
      if (crowd === 0) return [{ text: 'No visitors to entertain yet.', good: false, tag: 'idle' }];
      if (crowd / same > 60) return [{ text: `${crowd} visitors and not enough of us to go round!`, good: false, tag: 'overworked' }];
      return [{ text: m.role === 'mascot' ? 'The kids love me!' : 'Visitors are loving the tours.', good: true }];
    }
  }
}

export interface Sayings {
  topic: Topic;
  good: boolean;
  count: number;
  /** A recent example of what's being said. */
  quote: string;
  advice: string;
}

/** Hours of thoughts and reviews that count toward "what visitors are saying". */
const SAYINGS_HOURS = 12;

/** The most common complaints and compliments, from visitors in the park and recent reviews. */
export function whatVisitorsSay(state: GameState): { complaints: Sayings[]; praise: Sayings[] } {
  const tally = new Map<string, Sayings>();
  const add = (topic: Topic, good: boolean, text: string) => {
    const key = `${topic}:${good}`;
    const s = tally.get(key) ?? { topic, good, count: 0, quote: text, advice: good ? '' : ADVICE[topic] };
    s.count++;
    s.quote = text;
    tally.set(key, s);
  };
  const since = state.hours - SAYINGS_HOURS;
  for (const r of state.reviews) if (r.hour >= since && r.topic) add(r.topic, r.good, r.text);
  for (const v of state.visitors) for (const t of v.thoughts) if (t.hour >= since) add(t.topic, t.good, t.text);
  const all = [...tally.values()].sort((a, b) => b.count - a.count || TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic));
  return { complaints: all.filter((s) => !s.good), praise: all.filter((s) => s.good) };
}
