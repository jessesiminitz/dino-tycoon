/** Shared by park textures, catalog, guide and babies. */
export type ArtStyle = 'original' | 'blender' | 'cartoon';
export function resolveArtStyle(requested: string | null, allowOriginal = false): ArtStyle {
  if (requested === 'cartoon') return 'cartoon';
  if (requested === 'original' && allowOriginal) return 'original';
  return 'blender';
}
const requested = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('art');
/** Blender pixel art is the core game; cartoon remains a public alternative. */
export const ART_STYLE = resolveArtStyle(requested, import.meta.env.DEV || import.meta.env.MODE === 'art-preview');
