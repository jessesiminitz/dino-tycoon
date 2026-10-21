import { describe, expect, it } from 'vitest';
import { START_HOUR } from '../src/sim/GameState';
import { currentSeason, DAYS_PER_YEAR, groundTone, leafStage, snowCover, snowFalling, yearDay } from '../src/sim/seasons';
import { plantKind, plantLook, snowBias, snowTileIndex, SNOW_LEVELS, SNOW_PERIOD } from '../src/render/seasonArt';
import { Terrain } from '../src/sim/terrain';

/** `state.hours` at a given hour of a given park day (day 1 = the first). */
const at = (day: number, hour = 12) => ({ hours: (day - 1) * 24 + hour - START_HOUR });

describe('season calendar', () => {
  it('opens a new park in mid spring and runs four week-long seasons', () => {
    expect(currentSeason(at(1))).toEqual({ season: 'spring', day: 4 });
    expect(currentSeason(at(5))).toEqual({ season: 'summer', day: 1 });
    expect(currentSeason(at(12))).toEqual({ season: 'fall', day: 1 });
    expect(currentSeason(at(19))).toEqual({ season: 'winter', day: 1 });
    expect(currentSeason(at(26))).toEqual({ season: 'spring', day: 1 });
    expect(currentSeason(at(1 + DAYS_PER_YEAR))).toEqual(currentSeason(at(1)));
  });

  it('keeps the year-day in range, including the very first hours', () => {
    for (let h = -START_HOUR; h < 24 * 60; h += 5) {
      const t = yearDay({ hours: h });
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(DAYS_PER_YEAR);
    }
  });
});

describe('season scenery', () => {
  it('is green with no snow when a new park opens', () => {
    const t = yearDay(at(1, 8));
    expect(snowCover(t)).toBe(0);
    expect(groundTone(t)).toBe('fresh');
  });

  it('settles snow late in fall, keeps it through winter and melts it in early spring', () => {
    expect(snowCover(10)).toBe(0); // summer
    expect(snowCover(16)).toBe(0); // early fall: leaves only
    expect(snowCover(20)).toBeGreaterThan(0);
    expect(snowCover(25)).toBeGreaterThan(0.8);
    expect(snowCover(2)).toBeLessThan(snowCover(0.5));
    expect(snowCover(4.5)).toBe(0);
    expect(snowFalling(22)).toBe(true);
    expect(snowFalling(10)).toBe(false);
  });

  it('has no sudden jump in snow at the turn of the year', () => {
    expect(Math.abs(snowCover(DAYS_PER_YEAR - 1e-6) - snowCover(0))).toBeLessThan(0.01);
    for (let t = 0; t < DAYS_PER_YEAR; t += 0.05) expect(Math.abs(snowCover(t + 0.05) - snowCover(t))).toBeLessThan(0.05);
  });

  it('takes leaves through buds, blossom, green, autumn colour and bare twigs in order', () => {
    const order = ['bare', 'buds', 'blossom', 'fresh', 'green', 'turning', 'autumn', 'falling', 'bare'];
    const seen: string[] = [];
    for (let t = 0; t < DAYS_PER_YEAR; t += 0.25) {
      const s = leafStage(t, 0);
      if (seen.at(-1) !== s) seen.push(s);
    }
    expect(seen).toEqual(order);
    expect(leafStage(10, 0)).toBe('green'); // summer is full green
    expect(leafStage(24, 0)).toBe('bare'); // winter
  });

  it('staggers trees so a forest turns gradually', () => {
    const looks = new Set(Array.from({ length: 50 }, (_, i) => plantLook('deciduous', 15.6, 0, i / 50)));
    expect(looks.size).toBeGreaterThan(2);
    expect([...looks].some((l) => l.startsWith('turning'))).toBe(true);
    expect([...looks].some((l) => l.startsWith('autumn'))).toBe(true);
  });

  it('gives each kind of plant a fitting look', () => {
    expect(plantKind('tree-1-0')).toBe('deciduous');
    expect(plantKind('bush-2')).toBe('deciduous');
    expect(plantKind('tree-0-1')).toBe('evergreen');
    expect(plantKind('palm-0')).toBe('evergreen');
    expect(plantKind('reeds-1')).toBe('reeds');
    expect(plantKind('mountain-3')).toBe('none');
    // Summer: everything green. Winter: bare, snowy twigs and snowy evergreens.
    for (const kind of ['deciduous', 'evergreen', 'reeds'] as const) expect(plantLook(kind, 10, 0, 0.5)).toBe('green');
    expect(plantLook('deciduous', 24, snowCover(24), 0.5)).toMatch(/^bare-\w+-snow$/);
    expect(plantLook('evergreen', 24, snowCover(24), 0.5)).toBe('evergreen-snow');
    expect(plantLook('reeds', 24, snowCover(24), 0.5)).toBe('reeds-golden-snow');
    expect(plantLook('deciduous', 17, 0, 0.5)).toMatch(/^autumn-(gold|orange|red)$/);
    // Stages without autumn colour share one texture.
    expect(plantLook('deciduous', 2.4, 0, 0.5)).toBe('buds-gold');
  });

  it('keeps snow off water and lava, and piles more on mountains', () => {
    expect(snowBias(Terrain.Pond)).toBeNull();
    expect(snowBias(Terrain.Lava)).toBeNull();
    expect(snowBias(Terrain.HotSpring)).toBeNull();
    expect(snowBias(Terrain.Mountain)!).toBeGreaterThan(snowBias(Terrain.Grass)!);
    expect(snowBias(Terrain.Sand)!).toBeLessThan(snowBias(Terrain.Grass)!);
  });

  it('cuts snow tiles from one repeating pattern', () => {
    const indices = new Set<number>();
    for (let level = 1; level <= SNOW_LEVELS; level++)
      for (let y = 0; y < SNOW_PERIOD; y++) for (let x = 0; x < SNOW_PERIOD; x++) indices.add(snowTileIndex(level, x, y));
    expect(indices.size).toBe(SNOW_LEVELS * SNOW_PERIOD * SNOW_PERIOD);
    expect(Math.min(...indices)).toBe(0);
    expect(snowTileIndex(3, 5, 9)).toBe(snowTileIndex(3, 1, 1));
  });
});
