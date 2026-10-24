import { SPECIES, type SpeciesId } from '../sim/data/species';
import { ART_STYLE, type ArtStyle } from './artStyle';
import { paintDino } from './dinoArt';
import { dinoWorldScale } from './dinoSize';
import { paintMotionFrame } from './parkMotion';
import { paintCartoonAsset, cartoonMetadata } from './cartoonArt';
import type { MotionClip } from './immersionMotion';

/** Use the game's scale and fixed animation canvas; cropping each pose causes stretching. */
export function paintMenuDino(id: SpeciesId, clip: MotionClip = 'walk', frame = 0, style: ArtStyle = ART_STYLE): HTMLCanvasElement {
  const scale = dinoWorldScale(id, style);
  return style === 'cartoon' ? paintCartoonAsset(id, frame, SPECIES[id], false, scale, clip)
    : style === 'blender' ? paintMotionFrame(id, clip, frame, false, style)
    : paintDino(SPECIES[id], frame % 2, false, style, scale);
}

/** Supersampling changes texture pixels, never the dinosaur's displayed world size. */
export function menuDinoSize(canvas: HTMLCanvasElement): {width:number;height:number} {
  const resolution = cartoonMetadata(canvas)?.resolution ?? 1;
  return {width:canvas.width/resolution,height:canvas.height/resolution};
}
