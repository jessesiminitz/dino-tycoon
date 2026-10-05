import { SPECIES, type SpeciesId } from '../sim/data/species';
import { ART_STYLE, type ArtStyle } from './artStyle';
import { dinoFrameCount, dinoShape } from './dinoArt';

const scales = new Map<string, number>();

/** A readable park scale: small animals stay little, without filling the park with giants. */
export function dinoWorldScale(species: SpeciesId, style: ArtStyle = ART_STYLE): number {
  const key = `${species}:${style}`;
  const cached = scales.get(key);
  if (cached !== undefined) return cached;
  let width = 1;
  for (let frame = 0; frame < dinoFrameCount(species, style); frame++) {
    const rows = dinoShape(SPECIES[species], frame, false, style);
    let left = rows[0].length, right = 0;
    for (const row of rows) for (let x = 0; x < row.length; x++) if (row[x]) {
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    // Transparent canvas room for long tails must never determine body size.
    width = Math.max(width, right - left + 1);
  }
  const target = Math.max(18, Math.min(200, 14 * SPECIES[species].lengthM ** 0.8));
  const scale = Math.min(1.15, target / width);
  scales.set(key, scale);
  return scale;
}
