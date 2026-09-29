import { describe, expect, it } from 'vitest';
import { migrate, startScenario, type GameState } from '../src/sim/GameState';
import { BANKRUPT_BELOW, SCENARIO_IDS, SCENARIOS } from '../src/sim/data/scenarios';
import { SPECIES_IDS, STARTER_SPECIES } from '../src/sim/data/species';
import { daysLeft, describeReward, goalProgress } from '../src/sim/goals';
import { Simulation } from '../src/sim/Simulation';
import type { GameEvent } from '../src/sim/systems/context';
import { STEPS_PER_HOUR } from '../src/sim/systems/dinos';

function runHours(sim: Simulation, hours: number): void {
  for (let i = 0; i < hours * STEPS_PER_HOUR; i++) sim.step();
}

function watch(sim: Simulation): GameEvent[] {
  const events: GameEvent[] = [];
  sim.onEvent((e) => events.push(e));
  return events;
}

describe('scenarios', () => {
  it('every scenario starts a playable park with its budget and island', () => {
    for (const id of SCENARIO_IDS) {
      const sc = SCENARIOS[id];
      const a = startScenario(id, 1);
      const b = startScenario(id, 2);
      expect(a.money).toBe(sc.startMoney);
      expect(a.scenario.status).toBe(sc.rounds.length ? 'playing' : 'free');
      expect(a.scenario.round).toBe(0);
      if (sc.rounds.length) expect(sc.rounds).toHaveLength(3);
      // Fixed-seed scenarios give everyone the same island.
      if (sc.seed !== null) expect(a.map.tiles).toEqual(b.map.tiles);
      expect(a.tutorialStep).toBe(sc.tutorial ? 0 : null);
    }
    expect(startScenario('sandbox', 1).unlockedSpecies).toEqual(SPECIES_IDS);
    expect(startScenario('first-steps', 1).unlockedSpecies).toEqual(STARTER_SPECIES);
  });

  it('tracks goal progress', () => {
    const s = startScenario('first-steps', 1);
    const before = goalProgress(s);
    expect(before.map((g) => g.label)).toEqual(['Have 4 dinosaurs', 'Welcome 40 visitors in one day', 'Reach a reputation of 55']);
    expect(before.every((g) => !g.done)).toBe(true);
    s.stats.bestDayVisitors = 41;
    expect(goalProgress(s)[1].done).toBe(true);
    expect(daysLeft(s)).toBe(45);
  });

  it('meeting the goals earns a medal and a reward, then raises the bar', () => {
    const s = startScenario('first-steps', 1);
    const sim = new Simulation(s);
    const events = watch(sim);
    s.stats.bestDayVisitors = 50;
    s.reputation = 60;
    s.dinos = Array.from({ length: 4 }, (_, i) => ({ ...fakeDino(s), id: 100 + i }));
    const money = s.money;
    runHours(sim, 1);
    expect(s.scenario).toMatchObject({ status: 'playing', round: 1 });
    expect(s.scenario.earned).toEqual([['Pachycephalosaurus unlocked', '$5,000 prize']]);
    expect(s.unlockedSpecies).toContain('pachycephalosaurus');
    expect(s.money).toBeGreaterThanOrEqual(money + 5_000 - 500); // prize (less any running costs)
    const milestone = events.find((e) => e.outcome === 'milestone')!;
    expect(milestone.text).toMatch(/Bronze milestone.*Pachycephalosaurus unlocked, \$5,000 prize/);
    // Silver asks for more, with a fresh deadline.
    expect(goalProgress(s).map((g) => g.label)).toContain('Have 8 dinosaurs');
    expect(goalProgress(s).some((g) => !g.done)).toBe(true);
    expect(daysLeft(s)).toBe(60);
  });

  it('is won after all three rounds, and play carries on', () => {
    const s = startScenario('first-steps', 1);
    const sim = new Simulation(s);
    const events = watch(sim);
    s.stats.bestDayVisitors = 500;
    s.reputation = 90;
    s.money = 1_000_000;
    const species = ['protoceratops', 'parasaurolophus', 'stegosaurus', 'triceratops', 'compsognathus', 'dilophosaurus'] as const;
    s.dinos = Array.from({ length: 12 }, (_, i) => ({ ...fakeDino(s), id: 100 + i, species: species[i % 6] }));
    runHours(sim, 3);
    expect(s.scenario).toMatchObject({ status: 'won', round: 3 });
    expect(events.filter((e) => e.outcome === 'milestone')).toHaveLength(2);
    expect(events.some((e) => e.outcome === 'won' && /all three milestones/.test(e.text))).toBe(true);
    expect(s.unlockedSpecies).toEqual(expect.arrayContaining(['pachycephalosaurus', 'ankylosaurus', 'velociraptor']));
    runHours(sim, 24); // nothing more happens, but the park keeps running
    expect(s.scenario.status).toBe('won');
  });

  it('a species you already have is paid out in cash instead', () => {
    const s = startScenario('first-steps', 1);
    s.unlockedSpecies.push('pachycephalosaurus');
    expect(describeReward(s, SCENARIOS['first-steps'].rounds[0].reward)).toEqual([`$${(5_000 + 4_000).toLocaleString('en-US')} prize`]);
  });

  it('old saves that already won carry on into the Silver round', () => {
    const s = startScenario('first-steps', 1);
    s.hours = 24 * 20;
    const raw = JSON.parse(JSON.stringify(s));
    raw.version = 11;
    raw.scenario = { id: 'first-steps', status: 'won' };
    const m = migrate(raw)!;
    expect(m.scenario).toMatchObject({ status: 'playing', round: 1, roundStart: 21 });
    expect(daysLeft(m)).toBe(60);
  });

  it('is lost when the deadline passes', () => {
    const s = startScenario('first-steps', 1);
    const sim = new Simulation(s);
    const events = watch(sim);
    s.hours = 24 * 45 - 9; // 23:00 on the last day
    runHours(sim, 1);
    expect(daysLeft(s)).toBe(0);
    expect(s.scenario.status).toBe('lost');
    expect(events.some((e) => e.outcome === 'lost' && /Out of time/.test(e.text))).toBe(true);
  });

  it('is lost if the park goes deep into debt, but the sandbox just carries on', () => {
    for (const id of ['first-steps', 'sandbox'] as const) {
      const s = startScenario(id, 1);
      s.money = BANKRUPT_BELOW - 1;
      const sim = new Simulation(s);
      runHours(sim, 16);
      expect(s.scenario.status).toBe(id === 'sandbox' ? 'free' : 'lost');
    }
  });

  it('Storm Coast has far more storms', () => {
    const count = (id: 'storm-coast' | 'fossil-fever') => {
      const s = startScenario(id, 1);
      const sim = new Simulation(s);
      let storms = 0;
      sim.onEvent((e) => {
        if (/storm is rolling/.test(e.text)) storms++;
      });
      runHours(sim, 24 * 90);
      return storms;
    };
    expect(count('storm-coast')).toBeGreaterThan(count('fossil-fever') * 1.8);
  });

  it('records the best visitor day and escapes', () => {
    const s = startScenario('sandbox', 1);
    s.finance.today.visitors = 33;
    s.hours = 15; // 23:00
    runHours(new Simulation(s), 1);
    expect(s.stats.bestDayVisitors).toBe(33);
  });
});

function fakeDino(s: GameState) {
  const { x, y } = s.entrance;
  return {
    id: 0, species: 'protoceratops' as const, name: 'Test', x, y, px: x, py: y, path: [],
    hunger: 0, health: 100, happiness: 100, bornHour: 0, sick: false, escaped: false, homeX: x, homeY: y, baby: false, lastTreatHour: -1e6, lastPatHour: -1e6, huntRestUntil: -1e6,
  };
}

