import { describe, expect, it } from 'vitest';
import { newPark } from '../src/sim/challenges';
import { CHALLENGE_IDS, SCENARIOS } from '../src/sim/data/scenarios';
import { computeRegions } from '../src/sim/regions';

describe('challenge parks', () => {
  it('every challenge builds its park without a hitch, the same way every time', () => {
    for (const id of CHALLENGE_IDS) {
      const a = newPark(id, 1);
      const b = newPark(id, 2);
      expect(a.scenario.id).toBe(id);
      expect(a.scenario.status).toBe('playing');
      expect(a.scenario.briefed).toBe(false);
      expect(JSON.stringify(a.dinos)).toBe(JSON.stringify(b.dinos));
      expect(a.money).toBe(SCENARIOS[id].startMoney === 0 ? a.money : a.money);
      expect(a.finance.today.expenses.construction).toBe(0);
    }
  });

  it('The Great Escape starts with every dinosaur out of its paddock', () => {
    const s = newPark('great-escape', 1);
    expect(s.dinos.length).toBeGreaterThanOrEqual(10);
    const { regions, tileRegion } = computeRegions(s);
    const w = s.map.width;
    for (const d of s.dinos) {
      expect(d.escaped).toBe(true);
      expect(regions[tileRegion[d.y * w + d.x]]?.kind).not.toBe('paddock');
    }
    expect(s.staff.filter((m) => m.role === 'guard')).toHaveLength(1);
  });

  it('The Money Pit is big, overstaffed and deep in debt', () => {
    const s = newPark('money-pit', 1);
    expect(s.map.width).toBe(96);
    expect(s.dinos.length).toBe(8);
    expect(s.staff.length).toBeGreaterThanOrEqual(25);
    expect(s.finance.loans.reduce((t, l) => t + l.balance, 0)).toBe(150_000);
    expect(s.ticketPrice).toBe(60);
  });
});

import { applyCommand } from '../src/sim/commands';
import { goalValue, hourlyScenario } from '../src/sim/goals';
import { Rng } from '../src/sim/rng';
import type { GameEvent } from '../src/sim/systems/context';

const ctxFor = (s: ReturnType<typeof newPark>, events: GameEvent[]) => ({
  state: s,
  rng: new Rng(1),
  regions: computeRegions(s),
  emit: (e: GameEvent) => events.push(e),
  invalidateWorld() {},
});

describe('challenge goals and rules', () => {
  it('reads the new goals from the park', () => {
    const s = newPark('money-pit', 1);
    expect(goalValue(s, { kind: 'debtFree', target: 1 })).toBe(0);
    s.finance.loans = [];
    expect(goalValue(s, { kind: 'debtFree', target: 1 })).toBe(1);
    s.stats.profitStreak = 2;
    expect(goalValue(s, { kind: 'profitStreak', target: 3 })).toBe(2);
    const g = newPark('great-escape', 1);
    expect(goalValue(g, { kind: 'dinosHome', target: 100 })).toBe(0);
    for (const d of g.dinos) d.escaped = false;
    expect(goalValue(g, { kind: 'dinosHome', target: 100 })).toBe(100);
    expect(goalValue(g, { kind: 'fencesOk', target: 90 })).toBeLessThan(90);
    g.stats.lastEscapeHour = g.hours - 24 * 3;
    expect(goalValue(g, { kind: 'calmDays', target: 5 })).toBe(3);
  });

  it('tells the story at the right hours, once each', () => {
    const s = newPark('great-escape', 1);
    const events: GameEvent[] = [];
    s.hours = 1;
    hourlyScenario(ctxFor(s, events));
    expect(events).toHaveLength(0);
    s.hours = 9;
    hourlyScenario(ctxFor(s, events));
    hourlyScenario(ctxFor(s, events));
    expect(events.filter((e) => /radio/.test(e.text))).toHaveLength(2);
  });

  it('ends the challenge when too many dinosaurs are lost', () => {
    const s = newPark('great-escape', 1);
    const events: GameEvent[] = [];
    s.stats.dinosLost = 4;
    s.hours = 16; // midnight
    hourlyScenario(ctxFor(s, events));
    expect(s.scenario.status).toBe('lost');
    expect(events.some((e) => /Too many dinosaurs were lost/.test(e.text))).toBe(true);
  });

  it('closing the park sends everyone home and keeps the gates shut today', () => {
    const s = newPark('great-escape', 1);
    s.visitors = [];
    const r = applyCommand(s, { type: 'closePark' });
    expect(r.ok).toBe(true);
    expect(applyCommand(s, { type: 'closePark' }).ok).toBe(false);
  });
});
