import type { GameState, Staff, StaffTask } from '../GameState';
import { refillCost, repairCost } from '../commands';
import { FEEDER_TYPES } from '../data/feeders';
import { CLEAN_RADIUS, MEDICINE_COST, REFILL_BELOW, REPAIR_BELOW, STAFF_SPEED, STAFF_TYPES, WORK_STEPS } from '../data/staff';
import { spend } from '../finance';
import { allFenceEdges, fenceHp, fenceTypeAt, setFenceHp } from '../fences';
import type { Edge } from '../grid';
import { canStep, walkableNeighbours } from '../pathfind';
import { onWalkway } from '../paths';
import type { SimContext } from './context';
import { dinoLabel } from './dinos';

const taskKey = (t: StaffTask) =>
  t.kind === 'repair'
    ? `repair:${t.dir}${t.x},${t.y}`
    : t.kind === 'refill'
      ? `refill:${t.feederId}`
      : t.kind === 'clean'
        ? `clean:${t.messId}`
        : `${t.kind}:${t.dinoId}`;

const taskEdge = (t: Extract<StaffTask, { kind: 'repair' }>): Edge => ({ dir: t.dir, x: t.x, y: t.y });

/** Where a staff member stands to do a task, in tile coordinates. */
function taskSpot(state: GameState, t: StaffTask): { x: number; y: number } | null {
  switch (t.kind) {
    case 'refill': {
      const f = state.feeders.find((f) => f.id === t.feederId);
      return f ? { x: f.x, y: f.y } : null;
    }
    case 'repair':
      return t.dir === 'h' ? { x: t.x, y: t.y - 0.5 } : { x: t.x - 0.5, y: t.y };
    case 'recapture':
    case 'treat': {
      const d = state.dinos.find((d) => d.id === t.dinoId);
      return d ? { x: d.x, y: d.y } : null;
    }
    case 'clean': {
      const m = state.messes.find((m) => m.id === t.messId);
      return m ? { x: m.x, y: m.y } : null;
    }
  }
}

function stillNeeded(state: GameState, t: StaffTask): boolean {
  switch (t.kind) {
    case 'refill': {
      const f = state.feeders.find((f) => f.id === t.feederId);
      return !!f && f.stock < FEEDER_TYPES[f.kind].capacity;
    }
    case 'repair':
      return fenceTypeAt(state, taskEdge(t)) !== 0 && fenceHp(state, taskEdge(t)) < 100;
    case 'recapture':
      return state.dinos.some((d) => d.id === t.dinoId && d.escaped);
    case 'treat':
      return state.dinos.some((d) => d.id === t.dinoId && (d.sick || d.health < 60));
    case 'clean':
      return state.messes.some((m) => m.id === t.messId);
  }
}

/** Jobs a role can take, each with a priority bonus (in tiles of distance it outweighs). */
function candidateTasks(state: GameState, m: Staff): { task: StaffTask; bonus: number }[] {
  const out: { task: StaffTask; bonus: number }[] = [];
  if (m.role === 'worker') {
    for (const e of allFenceEdges(state)) {
      const hp = fenceHp(state, e);
      if (hp < REPAIR_BELOW) out.push({ task: { kind: 'repair', dir: e.dir, x: e.x, y: e.y }, bonus: hp <= 0 ? 60 : 0 });
    }
    for (const f of state.feeders) {
      if (f.stock < FEEDER_TYPES[f.kind].capacity * REFILL_BELOW) out.push({ task: { kind: 'refill', feederId: f.id }, bonus: f.stock === 0 ? 40 : 10 });
    }
  } else if (m.role === 'guard') {
    for (const d of state.dinos) if (d.escaped) out.push({ task: { kind: 'recapture', dinoId: d.id }, bonus: 0 });
  } else if (m.role === 'vet') {
    for (const d of state.dinos) if (d.sick || d.health < 60) out.push({ task: { kind: 'treat', dinoId: d.id }, bonus: d.sick ? 20 : 0 });
  } else if (m.role === 'janitor') {
    // Accidents first: they gross visitors out the most.
    for (const x of state.messes) out.push({ task: { kind: 'clean', messId: x.id }, bonus: x.kind === 'mess' ? 30 : 0 });
  }
  return out;
}

function pickTask(state: GameState, m: Staff): StaffTask | null {
  const claimed = new Set(state.staff.filter((o) => o !== m && o.task).map((o) => taskKey(o.task!)));
  let best: StaffTask | null = null;
  let bestScore = Infinity;
  for (const { task, bonus } of candidateTasks(state, m)) {
    if (claimed.has(taskKey(task))) continue;
    const spot = taskSpot(state, task);
    if (!spot) continue;
    const score = Math.hypot(spot.x - m.x, spot.y - m.y) - bonus;
    if (score < bestScore) {
      bestScore = score;
      best = task;
    }
  }
  return best;
}

function complete(ctx: SimContext, m: Staff, t: StaffTask): void {
  const { state, regions } = ctx;
  switch (t.kind) {
    case 'refill': {
      const f = state.feeders.find((f) => f.id === t.feederId);
      if (!f) return;
      spend(state, 'feed', refillCost(state, f.id));
      f.stock = FEEDER_TYPES[f.kind].capacity;
      return;
    }
    case 'repair': {
      const e = taskEdge(t);
      const wasBroken = fenceHp(state, e) <= 0;
      spend(state, 'maintenance', repairCost(state, e));
      setFenceHp(state, e, 100);
      if (wasBroken) ctx.invalidateWorld();
      return;
    }
    case 'recapture': {
      const d = state.dinos.find((d) => d.id === t.dinoId);
      if (!d) return;
      const home = regions.regions[regions.tileRegion[d.homeY * state.map.width + d.homeX]];
      if (home?.kind !== 'paddock') {
        // Its paddock is still open; keep the animal calm here until a worker mends it.
        d.path = [];
        m.progress = WORK_STEPS.recapture - 1;
        return;
      }
      d.x = d.px = d.homeX;
      d.y = d.py = d.homeY;
      d.path = [];
      d.escaped = false;
      ctx.emit({ text: `${m.name} returned ${dinoLabel(d)} to its paddock`, kind: 'good' });
      return;
    }
    case 'treat': {
      const d = state.dinos.find((d) => d.id === t.dinoId);
      if (!d) return;
      spend(state, 'maintenance', MEDICINE_COST);
      const wasSick = d.sick;
      d.sick = false;
      d.health = Math.min(100, d.health + 25);
      if (wasSick) ctx.emit({ text: `${m.name} cured ${dinoLabel(d)}`, kind: 'good' });
      return;
    }
    case 'clean': {
      const spot = state.messes.find((x) => x.id === t.messId);
      if (!spot) return;
      // Sweep up everything around the spot while here.
      state.messes = state.messes.filter((x) => Math.abs(x.x - spot.x) > CLEAN_RADIUS || Math.abs(x.y - spot.y) > CLEAN_RADIUS);
      return;
    }
  }
}

/** One movement step for every staff member: pick up a job, drive to it, do it. */
export function stepStaff(ctx: SimContext): void {
  const { state, rng } = ctx;
  const w = state.map.width;

  for (const m of state.staff) {
    m.px = m.x;
    m.py = m.y;

    if (m.role === 'guide' || m.role === 'mascot' || (m.role === 'janitor' && !m.task && state.messes.length === 0)) {
      // Guides and the mascot stroll the paths among the visitors.
      const here = Math.round(m.y) * w + Math.round(m.x);
      const options = walkableNeighbours(state, here, onWalkway);
      const forward = options.filter((n) => n !== m.from);
      const choices = forward.length > 0 ? forward : options;
      if (choices.length > 0 && !rng.chance(0.4)) {
        const next = choices[rng.int(0, choices.length - 1)];
        if (canStep(state, here, next, onWalkway)) {
          m.from = here;
          m.x = next % w;
          m.y = Math.floor(next / w);
        }
      }
      continue;
    }

    if (m.task && !stillNeeded(state, m.task)) m.task = null;
    if (!m.task) {
      m.task = pickTask(state, m);
      m.progress = 0;
    }
    if (!m.task) continue;

    const spot = taskSpot(state, m.task);
    if (!spot) {
      m.task = null;
      continue;
    }
    const dx = spot.x - m.x;
    const dy = spot.y - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.5) {
      const step = Math.min(STAFF_SPEED, dist);
      m.x += (dx / dist) * step;
      m.y += (dy / dist) * step;
      continue;
    }
    m.progress++;
    if (m.progress >= WORK_STEPS[m.task.kind]) {
      const task = m.task;
      m.task = null;
      complete(ctx, m, task);
      if (task.kind === 'recapture' && m.progress < WORK_STEPS.recapture) m.task = task; // still holding the animal
    }
  }
}

/** Human-readable current activity, for the info panel and staff list. */
export function describeTask(state: GameState, m: Staff): string {
  if (m.role === 'guide') return 'Showing visitors around';
  if (m.role === 'mascot') return 'Waving at visitors';
  const t = m.task;
  if (!t) return m.role === 'janitor' ? 'Sweeping the paths' : 'Waiting for work';
  const spot = taskSpot(state, t);
  const onSite = spot ? Math.hypot(spot.x - m.x, spot.y - m.y) <= 0.5 : false;
  const d = t.kind === 'recapture' || t.kind === 'treat' ? state.dinos.find((d) => d.id === t.dinoId) : undefined;
  switch (t.kind) {
    case 'refill':
      return onSite ? 'Refilling a feeder' : 'Heading to a feeder';
    case 'repair':
      return onSite ? 'Repairing a fence' : 'Heading to a damaged fence';
    case 'recapture':
      return d ? `${onSite ? 'Calming' : 'Tracking'} ${d.name}` : 'Tracking an escaped dinosaur';
    case 'treat':
      return d ? `${onSite ? 'Treating' : 'Heading to'} ${d.name}` : 'Heading to a patient';
    case 'clean': {
      const what = state.messes.find((x) => x.id === t.messId)?.kind === 'mess' ? 'a mess' : 'litter';
      return onSite ? `Cleaning up ${what}` : `Heading to clean up ${what}`;
    }
  }
}

export function dailyWages(state: GameState): number {
  return state.staff.reduce((s, m) => s + STAFF_TYPES[m.role].wage, 0);
}
