/** Shared by park textures, catalog, guide and babies. */
export type ArtStyle = 'original' | 'blender' | 'cartoon';
const requested = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('art');
/** Original artwork remains available for local comparisons. */
export const ART_STYLE: ArtStyle = (import.meta.env.DEV || import.meta.env.MODE === 'art-preview') && (requested === 'original' || requested === 'blender')
  ? requested : 'cartoon';
