import type Phaser from 'phaser';

/** Cached pixel bends. The bottom scanline stays fixed at the planted root. */
export function swayTexture(scene: Phaser.Scene, base: string): string {
  const key = `${base}-wind`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(base).getSourceImage() as HTMLCanvasElement;
  const resolution = Number((scene.textures.get(base).get().customData as { renderResolution?: number }).renderResolution ?? 1);
  const width = source.width + 6 * resolution, height = source.height;
  const sheet = document.createElement('canvas');
  sheet.width = width * 7; sheet.height = height;
  const ctx = sheet.getContext('2d')!;
  for (let frame = 0; frame < 7; frame++) for (let row = 0; row < height; row++) {
    const bend = Math.round((frame - 3) * resolution * ((height - 1 - row) / Math.max(1, height - 1)) ** 2);
    ctx.drawImage(source, 0, row, source.width, 1, frame * width + 3 * resolution + bend, row, source.width, 1);
  }
  const texture = scene.textures.addCanvas(key, sheet)!;
  for (let frame = 0; frame < 7; frame++) Object.assign(texture.add(frame, 0, frame * width, 0, width, height)!.customData, { renderResolution: resolution });
  return key;
}
