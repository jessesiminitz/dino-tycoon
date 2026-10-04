/** Comparison mode chosen once before textures and menus are built. */
export type ArtStyle = 'original' | 'blender';

const requested = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('art');
/** Separate cached build for device/offline review; normal release builds retain original art. */
const preview = import.meta.env.MODE === 'art-preview';
export const ART_STYLE: ArtStyle = preview && requested !== 'original' || import.meta.env.DEV && requested === 'blender'
  ? 'blender' : 'original';
