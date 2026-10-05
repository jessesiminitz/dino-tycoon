import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assertAttachedSilhouette } from './silhouette.mjs';

test('diagonal native pixels form an attached spine', () => {
  assert.doesNotThrow(() => assertAttachedSilhouette(['..A..', '.A...', 'BBBBB'], 'spine'));
});
test('a distant tiny spine fails even when its outline would mask the gap', () => {
  assert.throws(() => assertAttachedSilhouette(['..A..', '.....', '.....', 'BBBBB'], 'spine'), /Detached anatomy spine/);
});
test('a detached claw fails even one pixel from the body', () => {
  assert.throws(() => assertAttachedSilhouette(['BBB.W', 'BBB.W', 'BBB.W'], 'claw'), /Detached anatomy claw/);
});
test('a thin tip with a one-pixel raster gap is accepted', () => {
  assert.doesNotThrow(() => assertAttachedSilhouette(['..W..', '.....', 'BBBBB'], 'tip'));
});
test('row boundaries cannot create false attachment', () => {
  assert.throws(() => assertAttachedSilhouette(['....W', 'B....', 'BB...'], 'edge'), /Detached anatomy edge/);
});
