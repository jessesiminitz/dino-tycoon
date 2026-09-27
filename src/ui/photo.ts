/**
 * Dino snapshots: a patch of the park framed like an instant-camera print with
 * a caption, shown in a popup to save (share sheet on iPhone and iPad, a
 * download elsewhere, or press-and-hold on the picture).
 */

/** Scale the (pixel-art) snapshot up by this much, keeping pixels crisp. */
const PIXEL_SCALE = 3;
const FONT = 'Silkscreen, ui-monospace, monospace';

export async function framePhoto(shot: CanvasImageSource & { width: number; height: number }, caption: string, sub: string): Promise<HTMLCanvasElement> {
  await document.fonts?.load(`28px Silkscreen`).catch(() => undefined);
  const w = shot.width * PIXEL_SCALE;
  const h = shot.height * PIXEL_SCALE;
  const side = Math.round(w * 0.05);
  const bottom = Math.round(side * 3.6);
  const c = document.createElement('canvas');
  c.width = w + side * 2;
  c.height = h + side + bottom;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f7f1e3';
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(shot, side, side, w, h);
  // A thin inner edge so the picture sits in the frame.
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  g.strokeRect(side - 1, side - 1, w + 2, h + 2);
  g.fillStyle = '#2a2317';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const big = Math.round(bottom * 0.3);
  g.font = `${big}px ${FONT}`;
  g.fillText(caption, c.width / 2, h + side + bottom * 0.42, c.width - side * 2);
  g.font = `${Math.round(big * 0.62)}px ${FONT}`;
  g.fillStyle = '#6b5e44';
  g.fillText(sub, c.width / 2, h + side + bottom * 0.75, c.width - side * 2);
  return c;
}

export function showPhoto(photo: HTMLCanvasElement, fileName: string): void {
  const modal = document.getElementById('photo')!;
  const img = modal.querySelector<HTMLImageElement>('.photo-img')!;
  img.src = photo.toDataURL('image/png');
  img.alt = fileName;
  // A quick camera flash.
  const flash = document.getElementById('photo-flash')!;
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');
  modal.classList.remove('hidden');
  modal.onclick = async (e) => {
    const el = e.target as HTMLElement;
    const action = el.closest<HTMLElement>('[data-photo]')?.dataset.photo;
    if (e.target === modal || action === 'close') {
      modal.classList.add('hidden');
      return;
    }
    if (action !== 'share') return;
    const blob = await new Promise<Blob | null>((r) => photo.toBlob(r, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
    // iPhone and iPad: the share sheet has "Save Image" (to Photos) and AirDrop.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
      } catch {
        // Cancelled: nothing to do.
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
}
