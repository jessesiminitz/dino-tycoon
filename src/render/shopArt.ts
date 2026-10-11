import { FENCE_TYPES, NET, type FenceTypeId } from '../sim/data/fences';
import { paintSprite } from './pixels';
import { ART_STYLE } from './artStyle';
import { cartoonCanvas } from './cartoonArt';

/**
 * Little pictures for the build screens: things that are drawn as tiles or
 * lines in the park (fences, paths, track, ponds) rather than as sprites.
 */

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** A short run of fence: posts with rails (or netting, or a solid wall). */
export function paintFenceSample(id: FenceTypeId): HTMLCanvasElement {
  const t = FENCE_TYPES[id];
  const rail = hex(t.rail);
  const post = hex(t.post);
  if (ART_STYLE === 'cartoon') {
    const [canvas, ctx] = cartoonCanvas(34, 20);ctx.lineWidth=.8;ctx.strokeStyle='#292823';
    if (id === 4 || id === 6) {
      ctx.fillStyle=rail;ctx.beginPath();ctx.roundRect(2,6,30,11,2);ctx.fill();ctx.stroke();
      if(id===6)for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(5+i*6,12,3.6,3,0,0,Math.PI*2);ctx.stroke();}
    } else {
      ctx.strokeStyle=rail;ctx.lineWidth=2;
      for(const y of [6,14]){ctx.beginPath();ctx.moveTo(3,y);ctx.lineTo(30,y);ctx.stroke();}
      if(id===2||id===NET){ctx.lineWidth=.6;for(let x=4;x<29;x+=3){ctx.beginPath();ctx.moveTo(x,6);ctx.lineTo(x+3,14);ctx.stroke();}}
      for(const x of [3,16,29]){ctx.fillStyle=post;ctx.strokeStyle='#292823';ctx.lineWidth=.6;ctx.beginPath();ctx.roundRect(x-1.2,2,2.4,16,.8);ctx.fill();ctx.stroke();}
      if(id===3){ctx.strokeStyle='#fff38d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(9,5);ctx.lineTo(7,9);ctx.lineTo(11,9);ctx.lineTo(9,12);ctx.stroke();}
    }
    return canvas;
  }
  return paintSprite(34, 20, (px) => {
    if (id === 6) {
      // Sandbags: two staggered rows of bags.
      for (let y = 8; y < 17; y++)
        for (let x = 2; x < 32; x++) {
          const row = y < 12 ? 0 : 1;
          const seam = (x + row * 3) % 6 === 0 || y === 12;
          px(x, y, y === 8 ? '#e0c890' : seam ? post : rail);
        }
      return;
    }
    if (id === 4) {
      // Concrete: a solid block wall with mortar lines.
      for (let y = 5; y < 17; y++) for (let x = 2; x < 32; x++) px(x, y, y === 5 ? '#ece8dc' : (y - 5) % 4 === 0 || (x + ((y - 5) >> 2) * 3) % 8 === 0 ? post : rail);
      return;
    }
    for (const x of [3, 16, 29]) for (let y = 3; y < 18; y++) px(x, y, post);
    if (id === NET) {
      // Netting: a pale mesh with a diamond pattern (drawn as one panel so it isn't all outline).
      for (let y = 4; y < 17; y++) for (let x = 4; x < 29; x++) if (x !== 16) px(x, y, (x + y) % 4 === 0 || (x - y + 32) % 4 === 0 ? '#8f9a92' : rail);
      return;
    }
    for (const y of id === 3 ? [6, 9, 12, 15] : [7, 13])
      for (let x = 4; x < 29; x++) if (x !== 16) px(x, y, rail);
    if (id === 3) {
      // Sparks on the electric wires.
      px(10, 5, '#fff6a8');
      px(23, 11, '#fff6a8');
    }
  });
}

/** A strip of footpath, or of safari track with its two ruts. */
export function paintPathSample(track: boolean): HTMLCanvasElement {
  if (ART_STYLE === 'cartoon') {
    const [canvas, ctx] = cartoonCanvas(34,18);ctx.fillStyle=track?'#ba9163':'#e8c896';ctx.strokeStyle='#a78156';ctx.lineWidth=.8;
    ctx.beginPath();ctx.roundRect(1,3,32,12,2);ctx.fill();ctx.stroke();
    if(track){ctx.strokeStyle='#745235';for(const y of [6,12]){ctx.beginPath();ctx.moveTo(2,y);ctx.lineTo(32,y);ctx.stroke();}}
    return canvas;
  }
  return paintSprite(34, 18, (px) => {
    for (let y = 3; y < 15; y++)
      for (let x = 1; x < 33; x++) {
        const speck = (x * 7 + y * 13) % 11 === 0;
        if (track) px(x, y, y === 5 || y === 12 ? '#6b4a2a' : speck ? '#8a6a3e' : '#a8875a');
        else px(x, y, y === 3 || y === 14 ? '#b39a6e' : speck ? '#b8a070' : '#cdb58a');
      }
  });
}

/** A little pond with ripples. */
export function paintPondSample(): HTMLCanvasElement {
  if (ART_STYLE === 'cartoon') {
    const [canvas, ctx]=cartoonCanvas(34,20);ctx.lineWidth=1;ctx.strokeStyle='#ba9e63';ctx.fillStyle='#71c9dc';ctx.beginPath();ctx.ellipse(17,10,15,8,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#dff9fc';for(const y of [7,12]){ctx.beginPath();ctx.moveTo(10,y);ctx.bezierCurveTo(13,y-1,16,y+1,23,y);ctx.stroke();}return canvas;
  }
  return paintSprite(34, 20, (px) => {
    for (let y = 2; y < 18; y++)
      for (let x = 1; x < 33; x++) {
        const d = ((x - 16.5) / 15.5) ** 2 + ((y - 10) / 8) ** 2;
        if (d > 1) continue;
        px(x, y, d > 0.75 ? '#e8c77a' : (x + y * 3) % 9 === 0 ? '#bfe6f2' : y < 8 ? '#5fa8d0' : '#3f86c0');
      }
  });
}

/** A patch of marsh with reeds, for the Drain tool. */
export function paintMarshSample(): HTMLCanvasElement {
  if (ART_STYLE === 'cartoon') {
    const [canvas, ctx]=cartoonCanvas(34,20);ctx.fillStyle='#8fbc82';ctx.beginPath();ctx.roundRect(1,3,32,14,3);ctx.fill();
    ctx.fillStyle='#70b8bb';ctx.beginPath();ctx.ellipse(12,12,8,3,0,0,Math.PI*2);ctx.ellipse(25,8,5,2,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#5f8144';ctx.lineWidth=1;for(const x of [4,7,19,21,29]){ctx.beginPath();ctx.moveTo(x,12);ctx.quadraticCurveTo(x-1,8,x+1,4);ctx.stroke();}return canvas;
  }
  return paintSprite(34, 20, (px) => {
    for (let y = 3; y < 17; y++)
      for (let x = 1; x < 33; x++) {
        const puddle = ((x - 12) / 7) ** 2 + ((y - 11) / 3) ** 2 < 1 || ((x - 25) / 5) ** 2 + ((y - 8) / 2) ** 2 < 1;
        px(x, y, puddle ? (y < 10 ? '#5a8a8a' : '#46706e') : (x * 5 + y * 3) % 7 === 0 ? '#4f6e30' : '#5f7f3a');
      }
    for (const x of [4, 7, 19, 21, 29]) for (let y = 4; y < 10; y++) px(x, y, y < 6 ? '#7a5a30' : '#a8b85a');
  });
}

/** The same picture with a big red cross over it, for the erase tools. */
export function withCross(art: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = art.width;
  out.height = art.height;
  const ctx = out.getContext('2d')!;
  ctx.globalAlpha = 0.55;
  ctx.drawImage(art, 0, 0);
  ctx.globalAlpha = 1;
  if (ART_STYLE === 'cartoon') {
    const pad=out.width*.2;ctx.strokeStyle='#d9352b';ctx.lineWidth=Math.min(out.width,out.height)*.1;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(pad,pad);ctx.lineTo(out.width-pad,out.height-pad);ctx.moveTo(out.width-pad,pad);ctx.lineTo(pad,out.height-pad);ctx.stroke();return out;
  }
  ctx.fillStyle = '#d9352b';
  const size = Math.min(out.width, out.height) - 4;
  const x0 = Math.round((out.width - size) / 2);
  const y0 = Math.round((out.height - size) / 2);
  for (let i = 0; i < size; i++) {
    ctx.fillRect(x0 + i, y0 + i, 2, 2);
    ctx.fillRect(x0 + size - 1 - i, y0 + i, 2, 2);
  }
  return out;
}
