import { SPECIES, type SpeciesId } from '../sim/data/species';
import { ART_STYLE, type ArtStyle } from './artStyle';
import { paintDino, paintDinoRows, dinoCanvasBounds } from './dinoArt';
import { BLENDER_MOTION } from './generated/blenderMotion';
import { paintCartoonAsset } from './cartoonArt';
import type { MotionClip } from './immersionMotion';

/** Menu portraits use native artwork, independently of the park's metre scale. */
export function paintMenuDino(id: SpeciesId, clip: MotionClip = 'walk', frame = 0, style: ArtStyle = ART_STYLE): HTMLCanvasElement {
  const source = style === 'cartoon' ? paintCartoonAsset(id, frame, SPECIES[id], false, 1, clip)
    : style === 'blender' ? paintDinoRows(SPECIES[id], BLENDER_MOTION[id][clip].frames[frame], false)
    : paintDino(SPECIES[id], frame % 2, false, style);
  const b = dinoCanvasBounds(source);
  const canvas = document.createElement('canvas');
  canvas.width = b.right - b.left; canvas.height = b.bottom - b.top;
  canvas.getContext('2d')!.drawImage(source, b.left, b.top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}
