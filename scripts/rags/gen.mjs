// Regenerates src/audio/rags.ts. Download the MIDI files first, into this folder:
//   curl -O https://www.mutopiaproject.org/ftp/JoplinS/entertainer/entertainer.mid   (likewise maple, winners, peacherine)
// then run: node scripts/rags/gen.mjs
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { parseMidi } from './parse.mjs';
// Printable characters that are safe inside a single-quoted JS string.
const ALPHA = [];
for (let c = 35; c <= 126; c++) if (![39, 92, 96].includes(c)) ALPHA.push(String.fromCharCode(c));
const ESC = ALPHA.length - 1; // dt escape: add ESC and keep reading
const UNIT = 48; // ticks per 32nd note at ppq 384
const songs = [
  ['entertainer.mid', 'The Entertainer', 1902, 76],
  ['maple.mid', 'Maple Leaf Rag', 1899, 92],
  ['winners.mid', 'The Easy Winners', 1901, 82],
  ['peacherine.mid', 'Peacherine Rag', 1901, 84],
];
let out = `// Scott Joplin's rags (1899–1902) are in the public domain. The notes come from the
// Mutopia Project's public-domain editions (https://www.mutopiaproject.org, composer JoplinS),
// converted from their MIDI files by scripts/rags/gen.mjs.
// Each note is three characters: start (32nds after the previous note), length (32nds) and pitch (MIDI - ${20}).

export interface Rag {
  title: string;
  year: number;
  /** Quarter notes per minute. */
  bpm: number;
  notes: string;
}

export const RAG_ALPHABET = ${JSON.stringify(ALPHA.join(''))};
export const PITCH_OFFSET = 20;

export const RAGS: Rag[] = [
`;
for (const [file, title, year, bpm] of songs) {
  const m = parseMidi(new URL(file, import.meta.url));
  if (m.ppq !== 384) throw new Error('ppq');
  let prev = 0, s = '', count = 0;
  for (const n of m.notes) {
    const t = Math.round(n.t / UNIT);
    let dt = t - prev;
    prev = t;
    while (dt >= ESC) { s += ALPHA[ESC]; dt -= ESC; }
    const dur = Math.max(1, Math.min(ESC - 1, Math.round(n.d / UNIT)));
    const pitch = n.n - 20;
    if (pitch < 0 || pitch >= ESC) throw new Error('pitch ' + n.n);
    s += ALPHA[dt] + ALPHA[dur] + ALPHA[pitch];
    count++;
  }
  out += `  {\n    title: '${title}',\n    year: ${year},\n    bpm: ${bpm},\n    notes:\n      '${s}',\n  },\n`;
  console.log(title, count, 'notes', s.length, 'chars', Math.round(prev / 8 * 60 / bpm), 's');
}
out += '];\n';
writeFileSync(fileURLToPath(new URL('../../src/audio/rags.ts', import.meta.url)), out);
