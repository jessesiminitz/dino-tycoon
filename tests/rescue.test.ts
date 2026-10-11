import { describe, expect, it } from 'vitest';
import { newPark } from '../src/sim/challenges';
import { applyCommand } from '../src/sim/commands';
import { migrate } from '../src/sim/GameState';
import { allFenceEdges, setFence } from '../src/sim/fences';

describe('food-lure rescue', () => {
  it('requires a recent lure, survives reload, returns home once and charges once', () => {
    let s = newPark('great-escape', 1);
    const id = s.dinos.find((d) => d.species === 'velociraptor')!.id;
    expect(applyCommand(s, { type: 'rescueDino', id }).ok).toBe(false);
    expect(applyCommand(s, { type: 'treatDino', id }).ok).toBe(true);
    s = migrate(JSON.parse(JSON.stringify(s)))!;
    const d = s.dinos.find((d) => d.id === id)!;
    const money = s.money;
    expect(applyCommand(s, { type: 'rescueDino', id }).ok).toBe(true);
    expect(d).toMatchObject({ escaped: false, x: d.homeX, y: d.homeY });
    expect(s.money).toBe(money - 250);
    expect(applyCommand(s, { type: 'rescueDino', id }).ok).toBe(false);
    expect(s.money).toBe(money - 250);
  });

  it('an expired lure, very hungry dinosaur, open home or empty wallet prevents rescue', () => {
    const s = newPark('great-escape', 1);
    const d = s.dinos[0];
    applyCommand(s, { type: 'treatDino', id: d.id });
    s.hours += 1;
    expect(applyCommand(s, { type: 'rescueDino', id: d.id }).ok).toBe(false);
    applyCommand(s, { type: 'treatDino', id: d.id });
    d.hunger = 60;
    expect(applyCommand(s, { type: 'rescueDino', id: d.id }).ok).toBe(false);
    d.hunger = 0;
    s.money = 0;
    expect(applyCommand(s, { type: 'rescueDino', id: d.id }).ok).toBe(false);
    s.money = 10000;
    for (const e of allFenceEdges(s)) setFence(s, e, 0);
    expect(applyCommand(s, { type: 'rescueDino', id: d.id }).ok).toBe(false);
    expect(d.escaped).toBe(true);
    expect(s.money).toBe(10000);
  });
});
