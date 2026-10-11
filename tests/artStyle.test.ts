import { describe, expect, it } from 'vitest';
import { resolveArtStyle } from '../src/render/artStyle';
describe('core game artwork', () => {
  it('defaults to Blender pixel art for missing and unsupported choices', () => {
    for (const choice of [null, '', 'unknown', 'original', 'blender']) expect(resolveArtStyle(choice)).toBe('blender');
  });
  it('allows the cartoon edition in production', () => { expect(resolveArtStyle('cartoon')).toBe('cartoon'); });
  it('keeps original artwork available for development comparisons', () => { expect(resolveArtStyle('original', true)).toBe('original'); });
});
