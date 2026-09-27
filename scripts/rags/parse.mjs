import { readFileSync } from 'fs';
export function parseMidi(path) {
  const b = readFileSync(path);
  let p = 0;
  const u32 = () => { const v = b.readUInt32BE(p); p += 4; return v; };
  const u16 = () => { const v = b.readUInt16BE(p); p += 2; return v; };
  const vlq = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
  if (b.toString('ascii', 0, 4) !== 'MThd') throw new Error('not midi');
  p = 8; const format = u16(), ntracks = u16(), ppq = u16();
  const notes = [], tempos = [], meta = [];
  for (let t = 0; t < ntracks; t++) {
    while (b.toString('ascii', p, p + 4) !== 'MTrk') p++;
    p += 4; const len = u32(); const end = p + len;
    let tick = 0, status = 0; const open = new Map();
    while (p < end) {
      tick += vlq();
      let s = b[p];
      if (s & 0x80) { status = s; p++; } else s = status;
      const type = status & 0xf0, ch = status & 0x0f;
      if (status === 0xff) { const mt = b[p++]; const l = vlq(); const d = b.subarray(p, p + l); p += l;
        if (mt === 0x51) tempos.push({ tick, us: (d[0] << 16) | (d[1] << 8) | d[2] });
        if (mt === 0x58) meta.push({ tick, ts: `${d[0]}/${2 ** d[1]}` });
        if (mt === 0x03) meta.push({ tick, name: d.toString() });
      } else if (status === 0xf0 || status === 0xf7) { const l = vlq(); p += l; }
      else if (type === 0x90 || type === 0x80) { const n = b[p++], v = b[p++]; const k = ch * 128 + n;
        if (type === 0x90 && v > 0) open.set(k, { tick, v });
        else { const o = open.get(k); if (o) { notes.push({ t: o.tick, d: tick - o.tick, n, v: o.v, track: t, ch }); open.delete(k); } }
      } else if (type === 0xc0 || type === 0xd0) p += 1; else p += 2;
    }
    p = end;
  }
  notes.sort((a, b) => a.t - b.t || a.n - b.n);
  return { format, ntracks, ppq, notes, tempos, meta };
}
