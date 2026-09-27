export interface Rag {
  title: string;
  composer: string;
  year: number;
  /** Quarter notes per minute. */
  bpm: number;
  notes: string;
}

/** Printable characters safe inside a single-quoted JS string, in value order (see scripts/rags/gen.mjs). */
export const RAG_ALPHABET = "#$%&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}~";
export const PITCH_OFFSET = 20;

export interface Note {
  time: number;
  dur: number;
  midi: number;
}

/** Unpacks a rag into timed notes (seconds from the start). */
export function decodeRag(rag: Rag): Note[] {
  const esc = RAG_ALPHABET.length - 1;
  const val = (ch: string) => RAG_ALPHABET.indexOf(ch);
  const sec32 = 60 / rag.bpm / 8; // a 32nd note, in seconds
  const out: Note[] = [];
  let t = 0;
  for (let i = 0; i < rag.notes.length; ) {
    // Long rests are written as escape characters, each worth `esc`, before the remainder.
    let dt = val(rag.notes[i++]);
    while (dt === esc) {
      t += esc;
      dt = val(rag.notes[i++]);
    }
    t += dt;
    const dur = val(rag.notes[i++]);
    const midi = val(rag.notes[i++]) + PITCH_OFFSET;
    out.push({ time: t * sec32, dur: dur * sec32, midi });
  }
  return out;
}
