import { SPECIES, type SpeciesId } from '../sim/data/species';
import { ART_STYLE, type ArtStyle } from './artStyle';
import { dinoFrameCount, dinoShape } from './dinoArt';

const scales = new Map<string, number>();

/** Pixel art uses one length scale; the cartoon edition keeps its readable compressed sizes. */
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
  const target = style === 'blender'
    ? Math.max(5, 6 * SPECIES[species].lengthM)
    : Math.max(18, Math.min(200, 14 * SPECIES[species].lengthM ** 0.8));
  // Keep the smallest park resident easy to see at the user's preferred size.
  const visibilityBoost = style === 'blender' && species === 'compsognathus' ? 2 : 1;
  const scale = Math.min(style === 'blender' ? 2.5 : 1.15, target / width) * visibilityBoost;
  scales.set(key, scale);
  return scale;
}
