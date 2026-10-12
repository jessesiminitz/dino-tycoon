import type { ArtStyle } from './artStyle';

const LETTERS: Record<string, string[]> = {
  D: ['11110','10001','10001','10001','11110'], I: ['111','010','010','010','111'],
  N: ['10001','11001','10101','10011','10001'], O: ['01110','10001','10001','10001','01110'],
  P: ['11110','10001','11110','10000','10000'], A: ['01110','10001','11111','10001','10001'],
  R: ['11110','10001','11110','10010','10001'], K: ['10001','10010','11100','10010','10001'],
};

/** A six-tile landmark with a clear central passage and native bitmap lettering. */
export function paintParkEntrance(style: ArtStyle): HTMLCanvasElement {
  const resolution = style === 'cartoon' ? 2 : 1;
  const canvas = document.createElement('canvas'); canvas.width = 96 * resolution; canvas.height = 64 * resolution;
  const c = canvas.getContext('2d')!; c.scale(resolution, resolution);
  const box = (x: number, y: number, w: number, h: number, fill: string, radius = 0) => {
    c.fillStyle = fill;
    if (style === 'cartoon' && radius) { c.beginPath(); c.roundRect(x,y,w,h,radius); c.fill(); }
    else c.fillRect(x,y,w,h);
  };
  // Stone plinths and wooden pillars leave the entrance tile unobstructed.
  for (const x of [22, 67]) {
    box(x-3,54,13,8,'#484f3c',2); box(x-2,54,11,3,'#aeb69a',1);
    box(x,19,7,37,'#483522',2); box(x+1,20,5,34,'#946838',1); box(x+1,20,1,34,'#c39754');
    box(x-2,18,11,5,'#d6bd80',2);
  }
  // A generous overhead sign, with a leafy stepped crown.
  box(12,8,72,18,'#273b27',4); box(14,10,68,14,'#47743c',3);
  box(14,10,68,2,'#91b35c'); box(9,6,78,4,'#664628',2);
  box(17,3,62,4,'#987042',2); box(31,0,34,4,'#47743c',2);
  let x = 22;
  for (const letter of 'DINO PARK') {
    if (letter === ' ') { x += 4; continue; }
    const glyph = LETTERS[letter];
    for (let y=0;y<glyph.length;y++) for(let col=0;col<glyph[y].length;col++) if(glyph[y][col]==='1') {
      box(x+col,16+y,1,1,'#263424'); box(x+col,15+y,1,1,'#ffe9a3');
    }
    x += glyph[0].length + 1;
  }
  // Ticket booths, shaded roofs, lit service windows and little flags.
  for (const x of [2, 78]) {
    box(x,39,16,22,'#554032',2); box(x+1,40,14,19,'#ba8750',2);
    box(x+3,43,10,8,'#243d40',1); box(x+4,44,8,2,'#a9d0ce');
    box(x+2,52,12,2,'#f4d795'); box(x+2,59,12,3,'#5e6249');
    box(x-2,35,20,5,'#365b32',2); box(x,34,16,2,'#71954b');
    box(x+7,25,1,9,'#64533a'); box(x+8,25,8,5,'#edb947',1);
  }
  // Warm entrance lamps.
  for (const x of [20, 73]) { box(x,29,3,6,'#383c2d',1); box(x+1,30,1,3,'#ffe08c'); }
  return canvas;
}
