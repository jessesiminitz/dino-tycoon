import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '../src/sim/GameState';
import { deleteSlot, lastSlot, listSlots, loadSlot, parseImport, saveSlot, SLOT_IDS, setBootDirective, takeBootDirective } from '../src/save/storage';

describe('twelve park slots', () => {
  let memory: Map<string, string>;
  beforeEach(() => {
    memory = new Map();
    const store = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
    vi.stubGlobal('localStorage', store);
    vi.stubGlobal('sessionStorage', store);
    vi.stubGlobal('indexedDB', undefined);
  });
  afterEach(() => vi.unstubAllGlobals());
  it('preserves the first three parks and independently loads, imports and deletes later parks', async () => {
    for (const slot of SLOT_IDS) { const state = newGame(slot); state.money = slot * 1000; saveSlot(slot, state); }
    const slots = await listSlots();
    expect(Object.keys(slots)).toHaveLength(12);
    for (const slot of SLOT_IDS) expect(slots[slot]?.state.money).toBe(slot * 1000);
    expect(lastSlot()).toBe(12);
    expect(parseImport(JSON.stringify(slots[12]))).toHaveProperty('state.money', 12000);
    setBootDirective({ kind: 'load', slot: 12 });
    expect(takeBootDirective()).toEqual({ kind: 'load', slot: 12 });
    expect(takeBootDirective()).toBeNull();
    await deleteSlot(12);
    expect(await loadSlot(12)).toBeNull();
    expect((await loadSlot(3))?.state.money).toBe(3000);
  });
  it('remembers Continue even when the synchronous mirror exceeds its quota', () => {
    const original = localStorage.setItem;
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.includes(':slot:')) throw new Error('QuotaExceededError');
      original(key, value);
    });
    saveSlot(8, newGame(8));
    expect(lastSlot()).toBe(8);
  });
});
