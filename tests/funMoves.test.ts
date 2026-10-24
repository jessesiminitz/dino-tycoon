import { describe, expect, it } from 'vitest';
import { advanceMotion, handDrawnRex, idleFun, MOTION_CLIPS } from '../src/render/parkMotion';
import { dinoReaction, REACTION_MS, winkReaction } from '../src/render/dinoReaction';
import { BLENDER_MOTION, FUN_CLIPS } from '../src/render/generated/blenderMotion';
import { REX_ART, REX_PALETTE, REX_SCALE, REX_WALK_CONTACTS, REX_WALK_CYCLE } from '../src/render/generated/rexArt';
import { dinoWorldScale } from '../src/render/dinoSize';
import { SPECIES, SPECIES_IDS } from '../src/sim/data/species';
import { dinoShape } from '../src/render/dinoArt';

const input = { species: 'tyrannosaurus' as const, baby: false, x: 20, y: 20, time: 0, paused: false, moving: false, asleep: false, ambient: true };

describe('playful moves', () => {
  it('gives every species the five new clips, eight frames each, beside the four it had', () => {
    expect(MOTION_CLIPS).toEqual(['walk', 'idle', 'eat', 'rest', 'roar', 'stomp', 'dance', 'hop', 'sneeze', 'wink']);
    for (const id of SPECIES_IDS) for (const clip of FUN_CLIPS) {
      const c = BLENDER_MOTION[id][clip];
      expect(c.frames).toHaveLength(8);
      // the same canvas width as the walk, so the animal doesn't jump sideways when a move starts
      expect(c.width).toBe(BLENDER_MOTION[id].walk.width);
      expect(c.height).toBeGreaterThanOrEqual(BLENDER_MOTION[id].walk.height);
    }
  });

  it('plays one now and then while an animal stands about, then goes back to idling', () => {
    for (const id of SPECIES_IDS) {
      const seen = new Set<string>();
      let idle = 0;
      for (let t = 0; t < 120_000; t += 50) {
        const fun = idleFun(id, 3, t);
        if (!fun) { idle++; continue; }
        expect(FUN_CLIPS).toContain(fun.clip);
        expect(fun.frame).toBeGreaterThanOrEqual(0);
        expect(fun.frame).toBeLessThan(8);
        seen.add(fun.clip);
      }
      expect(seen.size).toBeGreaterThanOrEqual(2);
      // mostly it just stands
      expect(idle / 2400).toBeGreaterThan(.75);
      // not straight away
      expect(idleFun(id, 3, 5000)).toBeUndefined();
    }
  });

  it('keeps every frame of a move in order, start to finish', () => {
    let start = 0;
    while (!idleFun('allosaurus', 0, start)) start += 10;
    const clip = idleFun('allosaurus', 0, start)!.clip, duration = BLENDER_MOTION.allosaurus[clip].durationMs;
    expect([...Array(8)].map((_, i) => idleFun('allosaurus', 0, start + (i + .5) * duration / 8)?.frame)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(idleFun('allosaurus', 0, start + duration + 1)).toBeUndefined();
  });

  it('happy animals dance more, and the hunters roar', () => {
    const count = (id: typeof SPECIES_IDS[number], clip: string, happiness: number) => {
      let n = 0;
      for (let t = 0; t < 600_000; t += 100) if (idleFun(id, 5, t, happiness)?.clip === clip) n++;
      return n;
    };
    expect(count('triceratops', 'dance', 90)).toBeGreaterThan(count('triceratops', 'dance', 40));
    expect(count('tyrannosaurus', 'roar', 50)).toBeGreaterThan(0);
  });

  it('only shows a move when standing, with motion on, in the pixel art', () => {
    const at = (extra: object) => {
      let motion: ReturnType<typeof advanceMotion> | undefined;
      for (let t = 0; t < 60_000; t += 100) {
        motion = advanceMotion(motion, { ...input, offset: 30, time: t, ...extra });
        if (motion.fun) return true;
      }
      return false;
    };
    expect(at({})).toBe(true);
    expect(at({ ambient: false })).toBe(false);
    expect(at({ style: 'cartoon' })).toBe(false);
    expect(at({ moving: true })).toBe(false);
    expect(at({ asleep: true })).toBe(false);
    expect(advanceMotion(undefined, { ...input, offset: 30_000, time: 30_000 }).clip).toBe('idle');
  });

  it('dances when patted in the pixel art, still flutters in the cartoon edition', () => {
    const frames = [...Array(8)].map((_, i) => dinoReaction('triceratops', 'pat', (i + .5) * REACTION_MS / 8, true, true));
    expect(frames.map((r) => r.clip)).toEqual(Array(8).fill('dance'));
    expect(frames.map((r) => r.frame)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(frames.every((r) => r.lift === 0 && r.angle === 0)).toBe(true);
    expect(dinoReaction('pteranodon', 'pat', 300, true, true)).toMatchObject({ clip: 'dance' });
    expect(dinoReaction('pteranodon', 'pat', 300, true, false)).toMatchObject({ clip: 'walk' });
    expect(dinoReaction('triceratops', 'pat', REACTION_MS, true, true)).toEqual({ frame: 0, lift: 0, angle: 0 });
  });
});

describe('eyes', () => {
  it('have a white behind the pupil, looking forward, in every open-eyed frame', () => {
    for (const id of SPECIES_IDS) for (const [name, clip] of Object.entries(BLENDER_MOTION[id])) clip.frames.forEach((rows, i) => {
      if (name === 'wink' && (i === 3 || i === 4)) return;
      const white = rows.flatMap((r, y) => [...r].flatMap((k, x) => k === 'Y' ? [[x, y]] : []));
      const pupil = rows.flatMap((r, y) => [...r].flatMap((k, x) => k === 'E' ? [[x, y]] : []));
      expect(white.length, `${id}:${name}:${i}`).toBeGreaterThan(0);
      // toward the back of the head (a nodding head turns it a little), touching the pupil
      const mean = (pts: number[][]) => pts.reduce((a, [x]) => a + x, 0) / pts.length;
      expect(mean(white), `${id}:${name}:${i}`).toBeLessThan(mean(pupil));
      expect(white.some(([x, y]) => pupil.some(([px, py]) => Math.abs(px - x) <= 1 && Math.abs(py - y) <= 1)), `${id}:${name}:${i}`).toBe(true);
    });
  });

  it('shut for the wink: a lid line, one pixel tall, and no white', () => {
    for (const id of SPECIES_IDS) for (const i of [3, 4]) {
      const rows = BLENDER_MOTION[id].wink.frames[i];
      expect(rows.join(''), id).not.toContain('Y');
      const lid = rows.flatMap((r, y) => r.includes('E') ? [y] : []);
      expect(lid.length, `${id}:${i}`).toBe(1);
    }
    for (const id of SPECIES_IDS) expect(BLENDER_MOTION[id].wink.frames[0].join('')).toContain('Y');
  });

  it('still show their white at park size, adults and babies (all but the speck-sized Microraptor)', () => {
    for (const id of SPECIES_IDS) for (const baby of [false, true]) {
      if (id === 'microraptor') continue;
      const rows = dinoShape(SPECIES[id], 0, baby, 'blender', dinoWorldScale(id, 'blender'));
      const at = (k: string) => rows.flatMap((r, y) => r.flatMap((c, x) => c === k ? [[x, y]] : []));
      const white = at('Y'), pupil = at('E');
      expect(white.length, `${id}${baby ? ' baby' : ''}`).toBeGreaterThan(0);
      expect(white.some(([x, y]) => pupil.some(([px, py]) => Math.abs(px - x) <= 1 && Math.abs(py - y) <= 1)), id).toBe(true);
    }
  });

  it('wink back at a tap, in order, then stop', () => {
    const d = BLENDER_MOTION.triceratops.wink.durationMs;
    expect([...Array(8)].map((_, i) => winkReaction('triceratops', (i + .5) * d / 8)?.frame)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(winkReaction('triceratops', d)).toBeUndefined();
    expect(winkReaction('triceratops', 100, false)).toBeUndefined();
  });

  it('the brown T-rex has white eyes too, and shuts one to wink', () => {
    for (const size of ['adult', 'baby'] as const) {
      const art = REX_ART[size], open = art.clips.idle[0].join(''), shut = art.clips.wink[3].join('');
      const white = Object.entries(REX_PALETTE).find(([, hex]) => hex === '#f6f1e2')![0];
      expect(open).toContain(white);
      expect(shut).not.toContain(white);
    }
  });
});

describe('the hand-drawn T-rex', () => {
  it('replaces only the pixel park T-rex', () => {
    expect(handDrawnRex('tyrannosaurus', 'blender')).toBe(true);
    expect(handDrawnRex('tyrannosaurus', 'cartoon')).toBe(false);
    expect(handDrawnRex('allosaurus', 'blender')).toBe(false);
  });

  it('has all nine clips for adults and babies, on one canvas size each', () => {
    for (const size of ['adult', 'baby'] as const) {
      const art = REX_ART[size], { length: h } = art.clips.walk[0], w = art.clips.walk[0][0].length;
      for (const clip of MOTION_CLIPS) {
        expect(art.clips[clip]).toHaveLength(8);
        for (const rows of art.clips[clip]) {
          expect(rows).toHaveLength(h);
          expect(rows.every((r) => r.length === w)).toBe(true);
        }
        expect(new Set(art.clips[clip].map((rows) => rows.join('\n'))).size).toBeGreaterThanOrEqual(3);
      }
      // standing clips keep a foot on the bottom rows; a hop leaves them
      for (const clip of ['walk', 'idle', 'eat', 'rest'] as const)
        for (const rows of art.clips[clip]) expect(rows.slice(-3).join('')).toMatch(/[^.]/);
      expect(art.clips.hop[3].slice(-3).join('')).toMatch(/^\.+$/);
    }
    // the baby is drawn at six tenths of the adult
    expect(REX_ART.baby.clips.walk[0][0].length / REX_ART.adult.clips.walk[0][0].length).toBeCloseTo(.6, 1);
  });

  it('is as long in the park as the Blender T-rex it replaces', () => {
    const span = (rows: readonly string[]) => {
      let left = Infinity, right = 0;
      for (const row of rows) for (let x = 0; x < row.length; x++) if (row[x] !== '.') { left = Math.min(left, x); right = Math.max(right, x); }
      return right - left + 1;
    };
    const blender = span(BLENDER_MOTION.tyrannosaurus.idle.frames[0]) * dinoWorldScale('tyrannosaurus', 'blender');
    expect(span(REX_ART.adult.clips.idle[0]) / blender).toBeGreaterThan(.9);
    expect(span(REX_ART.adult.clips.idle[0]) / blender).toBeLessThan(1.15);
    expect(REX_SCALE).toBeGreaterThan(0);
  });

  it('keeps a planted foot still on the ground while it walks', () => {
    let checked = 0;
    for (let i = 0; i < 8; i++) for (const before of REX_WALK_CONTACTS[i]) {
      const after = REX_WALK_CONTACTS[(i + 1) % 8].find((f) => f.name === before.name)!;
      if (!before.planted || !after.planted) continue;
      // the body moves forward one eighth of a cycle; the foot slides back the same in the picture
      expect(Math.abs(REX_WALK_CYCLE / 8 + after.x - before.x)).toBeLessThan(.05);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(6);
    const previous = advanceMotion(undefined, { ...input, moving: true });
    expect(advanceMotion(previous, { ...input, moving: true, x: input.x + REX_WALK_CYCLE / 4 }).frame).toBe(2);
  });
});
