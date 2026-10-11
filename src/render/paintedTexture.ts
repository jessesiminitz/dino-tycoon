import type Phaser from 'phaser';
import { cartoonMetadata } from './cartoonArt';

/** Keep high-resolution texture pixels separate from logical world dimensions. */
export function addPaintedTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): Phaser.Textures.CanvasTexture {
  const texture = scene.textures.addCanvas(key, canvas)!;
  Object.assign(texture.get().customData, { renderResolution: cartoonMetadata(canvas)?.resolution ?? 1 });
  return texture;
}

export function fitPaintedImage(image: Phaser.GameObjects.Image): void {
  const resolution = Number((image.frame.customData as { renderResolution?: number }).renderResolution ?? 1);
  image.setScale(1 / resolution);
}
