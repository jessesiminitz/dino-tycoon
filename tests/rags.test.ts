import { describe, expect, it } from 'vitest';
import { RAGS } from '../src/audio/rags';
import { decodeRag } from '../src/audio/ragNotes';

describe('ragtime', () => {
  it('decodes every rag into playable notes of a sensible length', () => {
    for (const rag of RAGS) {
      const notes = decodeRag(rag);
      expect(notes.length).toBeGreaterThan(1000);
      const end = notes[notes.length - 1].time;
      expect(end).toBeGreaterThan(90);
      expect(end).toBeLessThan(400);
      for (const n of notes) {
        expect(n.midi).toBeGreaterThanOrEqual(21);
        expect(n.midi).toBeLessThanOrEqual(108);
        expect(n.dur).toBeGreaterThan(0);
      }
    }
  });

  it('holds about an hour of public-domain ragtime, each piece credited', () => {
    const minutes = RAGS.reduce((sum, r) => {
      const notes = decodeRag(r);
      const last = notes[notes.length - 1];
      return sum + (last.time + last.dur) / 60;
    }, 0);
    expect(minutes).toBeGreaterThan(55);
    expect(minutes).toBeLessThan(80);
    expect(new Set(RAGS.map((r) => r.title)).size).toBe(RAGS.length);
    for (const r of RAGS) {
      expect(r.composer).toBeTruthy();
      expect(r.year).toBeLessThan(1929); // US public domain
    }
  });

  it('The Entertainer opens with its famous D, D-sharp, E, high C', () => {
    const notes = decodeRag(RAGS.find((r) => r.title === 'The Entertainer')!);
    // Top voice: the highest note at each distinct start time.
    const tops: number[] = [];
    let at = -1;
    for (const n of notes) {
      if (n.time !== at) {
        tops.push(n.midi);
        at = n.time;
      } else tops[tops.length - 1] = Math.max(tops[tops.length - 1], n.midi);
    }
    const pcs = tops.slice(0, 40).map((m) => m % 12);
    const motif = [2, 3, 4, 0]; // D D# E C
    expect(pcs.some((_, i) => motif.every((pc, k) => pcs[i + k] === pc))).toBe(true);
  });
});
