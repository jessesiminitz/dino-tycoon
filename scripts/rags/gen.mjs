// Regenerates src/audio/rags.ts. Download the MIDI files listed below into this folder first,
// from the Mutopia Project (public-domain editions): https://www.mutopiaproject.org/ftp/<Composer>/<piece>/<piece>.mid
// e.g. JoplinS/entertainer/entertainer.mid, TurpinT/turpinhar/turpinhar.mid, HunterC/PossumAndTaters/PossumAndTaters.mid
// then run: node scripts/rags/gen.mjs
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { parseMidi } from './parse.mjs';
// Printable characters that are safe inside a single-quoted JS string.
const ALPHA = [];
for (let c = 35; c <= 126; c++) if (![39, 92, 96].includes(c)) ALPHA.push(String.fromCharCode(c));
const ESC = ALPHA.length - 1; // dt escape: add ESC and keep reading
const UNIT = 48; // ticks per 32nd note at ppq 384
// [file, title, composer, year, quarter notes per minute]. Tempos are relaxed: Joplin warned
// "it is never right to play ragtime fast". Magnetic Rag, Possum and Taters and the waltz
// Bethena are written in longer note values, hence their higher numbers.
const JOPLIN = 'Scott Joplin';
const songs = [
  ['entertainer.mid', 'The Entertainer', JOPLIN, 1902, 76],
  ['maple.mid', 'Maple Leaf Rag', JOPLIN, 1899, 92],
  ['winners.mid', 'The Easy Winners', JOPLIN, 1901, 82],
  ['peacherine.mid', 'Peacherine Rag', JOPLIN, 1901, 84],
  ['EliteSyncopations.mid', 'Elite Syncopations', JOPLIN, 1902, 80],
  ['PineappleRag.mid', 'Pineapple Rag', JOPLIN, 1908, 88],
  ['SomethingDoing.mid', 'Something Doing', 'Scott Joplin & Scott Hayden', 1903, 80],
  ['TheStrenuousLife.mid', 'The Strenuous Life', JOPLIN, 1902, 84],
  ['WallStreetRag.mid', 'Wall Street Rag', JOPLIN, 1909, 72],
  ['a-breeze-from-alabama.mid', 'A Breeze from Alabama', JOPLIN, 1902, 82],
  ['bethena.mid', 'Bethena (a concert waltz)', JOPLIN, 1905, 150],
  ['eugenia.mid', 'Eugenia', JOPLIN, 1906, 72],
  ['magnetic.mid', 'Magnetic Rag', JOPLIN, 1914, 150],
  ['original.mid', 'Original Rags', JOPLIN, 1899, 84],
  ['search.mid', 'Search-Light Rag', JOPLIN, 1907, 84],
  ['solace.mid', 'Solace', JOPLIN, 1909, 60],
  ['sugar-cane.mid', 'Sugar Cane', JOPLIN, 1908, 88],
  ['sun-flower-slow-drag.mid', 'Sun Flower Slow Drag', 'Scott Joplin & Scott Hayden', 1901, 64],
  ['turpinhar.mid', 'Harlem Rag', 'Tom Turpin', 1899, 84],
  ['turpin.mid', 'St. Louis Rag', 'Tom Turpin', 1903, 88],
  ['PossumAndTaters.mid', 'Possum and Taters', 'Charles Hunter', 1900, 150],
];
let out = `// Classic ragtime piano pieces published 1899–1914, all in the public domain. The notes come
// from the Mutopia Project's public-domain editions (https://www.mutopiaproject.org),
// converted from their MIDI files by scripts/rags/gen.mjs.
// Each note is three characters: start (32nds after the previous note), length (32nds) and pitch (MIDI - 20),
// using RAG_ALPHABET in ragNotes.ts (keep it in step with ALPHA here).

import type { Rag } from './ragNotes';

export const RAGS: Rag[] = [
`;
let total = 0;
for (const [file, title, composer, year, bpm] of songs) {
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
  out += `  {\n    title: '${title}',\n    composer: '${composer}',\n    year: ${year},\n    bpm: ${bpm},\n    notes:\n      '${s}',\n  },\n`;
  const secs = Math.round(((prev / 8) * 60) / bpm);
  total += secs;
  console.log(title.padEnd(28), String(count).padStart(5), 'notes', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
}
out += '];\n';
console.log(`${songs.length} pieces, ${Math.round(total / 60)} minutes in all`);
writeFileSync(fileURLToPath(new URL('../../src/audio/rags.ts', import.meta.url)), out);
