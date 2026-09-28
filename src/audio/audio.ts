import { getSettings, onSettings, type Settings } from '../ui/settings';
import { decodeRag, type Note, type Rag } from './ragNotes';
import { callFor } from './calls';
import type { SpeciesId } from '../sim/data/species';

/**
 * All sound is synthesised with Web Audio: no audio files to download or license.
 * iOS only allows audio after a user gesture, so the context starts on the first tap.
 */
export type Sfx = 'click' | 'build' | 'cash' | 'error' | 'roar' | 'alert' | 'chime' | 'fanfare' | 'sad' | 'thunder' | 'chirp' | 'snap' | 'shutter' | 'brush' | 'cheer' | 'splash' | 'flap';

let ctx: AudioContext | null = null;
let sfxGain: GainNode;
let musicGain: GainNode;
let rainGain: GainNode;
let noise: AudioBuffer;

function applySettings(s: Settings): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  sfxGain.gain.setTargetAtTime(s.sfx ? s.sfxVolume : 0, t, 0.05);
  musicGain.gain.setTargetAtTime(s.music ? s.musicVolume * 0.5 : 0, t, 0.2);
}

function makeNoise(c: AudioContext): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Creates (or resumes) the audio graph. Must run inside a user gesture on iOS. */
function unlock(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain.connect(master);
    musicGain.connect(master);
    noise = makeNoise(ctx);

    // Rain: looping filtered noise, silent until a storm.
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.4;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    src.connect(filter).connect(rainGain).connect(sfxGain);
    src.start();

    applySettings(getSettings());
    onSettings(applySettings);
    void startMusic();
  }
  if (ctx.state !== 'running') void ctx.resume().then(listenIfSilent, listenIfSilent);
  // iOS only wakes audio once something actually plays during a tap: a one-sample silent blip does it.
  const blip = ctx.createBufferSource();
  blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  blip.connect(ctx.destination);
  blip.start();
  listenIfSilent();
}

/**
 * Browsers only allow sound after the player touches the screen, and iPhones
 * and iPads only count a finished tap (not a finger going down, or a drag).
 * So listen for every kind of touch, keep trying until audio is really running,
 * then stop listening.
 */
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
let listening = false;

function listenIfSilent(): void {
  const running = ctx?.state === 'running';
  if (running === !listening) return;
  listening = !running;
  for (const type of GESTURES) {
    if (listening) window.addEventListener(type, unlock, { capture: true, passive: true });
    else window.removeEventListener(type, unlock, { capture: true });
  }
}

/** Call once at startup: audio starts on the first touch or click anywhere. */
export function initAudio(): void {
  listenIfSilent();
  // Resume after the app comes back from the background (iOS may need another tap first).
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.visibilityState === 'visible') void ctx.resume().then(listenIfSilent, listenIfSilent);
    else void ctx.suspend();
    listenIfSilent();
  });
}

function tone(
  type: OscillatorType,
  freq: number,
  start: number,
  dur: number,
  vol: number,
  dest: AudioNode = sfxGain,
  endFreq?: number,
): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function burst(start: number, dur: number, vol: number, freq: number, q = 1): void {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(sfxGain);
  src.start(start, Math.random());
  src.stop(start + dur + 0.02);
}

const lastPlayed = new Map<Sfx, number>();
/** Minimum gap between repeats of the same sound, so bursts of events don't stack up. */
const MIN_GAP_MS: Partial<Record<Sfx, number>> = { alert: 700, cash: 120, chime: 300, click: 40, brush: 90, cheer: 1500, splash: 600, flap: 600 };

export function playSfx(name: Sfx): void {
  if (!ctx || !getSettings().sfx) return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -Infinity) < (MIN_GAP_MS[name] ?? 80)) return;
  lastPlayed.set(name, now);
  const t = ctx.currentTime;
  switch (name) {
    case 'click':
      return tone('square', 880, t, 0.04, 0.08);
    case 'build':
      burst(t, 0.12, 0.5, 300, 0.8);
      return tone('triangle', 140, t, 0.12, 0.3, sfxGain, 70);
    case 'cash':
      tone('square', 1318, t, 0.07, 0.12);
      return tone('square', 1760, t + 0.07, 0.14, 0.12);
    case 'error':
      tone('square', 196, t, 0.1, 0.15);
      return tone('square', 147, t + 0.1, 0.16, 0.15);
    case 'chirp':
      // A happy little trill.
      tone('triangle', 880, t, 0.09, 0.14, sfxGain, 1320);
      return tone('triangle', 1175, t + 0.1, 0.14, 0.12, sfxGain, 1568);
    case 'snap':
      // A grumpy chomp.
      burst(t, 0.12, 0.5, 400, 3);
      return tone('sawtooth', 140, t, 0.18, 0.14, sfxGain, 70);
    case 'cheer':
      // A happy crowd: bursts of voices and a couple of whoops.
      for (let i = 0; i < 9; i++) burst(t + Math.random() * 0.9, 0.12 + Math.random() * 0.2, 0.14, 900 + Math.random() * 1600, 1.2);
      for (let i = 0; i < 3; i++) tone('sine', 1000 + i * 180, t + 0.1 + i * 0.25, 0.25, 0.035, sfxGain, 1500 + i * 200);
      return;
    case 'splash':
      burst(t, 0.28, 0.3, 650, 0.7);
      for (let i = 0; i < 3; i++) tone('sine', 900 + Math.random() * 600, t + 0.12 + i * 0.07, 0.05, 0.04, sfxGain, 1400);
      return;
    case 'flap':
      for (let i = 0; i < 3; i++) burst(t + i * 0.13, 0.07, 0.25, 380, 0.8);
      return;
    case 'brush':
      // A soft swish of sand.
      return burst(t, 0.12, 0.18, 1800 + Math.random() * 900, 0.8);
    case 'shutter':
      burst(t, 0.03, 0.45, 3500, 1.5);
      return burst(t + 0.07, 0.05, 0.35, 2500, 1.5);
    case 'roar':
      burst(t, 0.7, 0.6, 220, 2);
      return tone('sawtooth', 110, t, 0.7, 0.18, sfxGain, 55);
    case 'alert':
      for (let i = 0; i < 3; i++) tone('square', i % 2 ? 660 : 880, t + i * 0.13, 0.12, 0.12);
      return;
    case 'chime':
      [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, t + i * 0.08, 0.35, 0.14));
      return;
    case 'fanfare':
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('square', f, t + i * 0.12, i === 5 ? 0.6 : 0.14, 0.12));
      return;
    case 'sad':
      [392, 370, 349, 262].forEach((f, i) => tone('triangle', f, t + i * 0.25, 0.3, 0.16));
      return;
    case 'thunder':
      burst(t, 1.6, 0.9, 90, 0.5);
      return burst(t + 0.05, 0.4, 0.5, 400, 0.7);
  }
}

/** An animal's call (see calls.ts): synthesised from an oscillator, a filter and a little noise. */
export function playCall(species: SpeciesId, baby = false): void {
  if (!ctx || !getSettings().sfx) return;
  const now = performance.now();
  if (now - lastCall < 350) return;
  lastCall = now;
  const { kind, pitch: f, length: len, volume } = callFor(species, baby);
  const t = ctx.currentTime;
  const v = 0.16 * volume;
  switch (kind) {
    case 'roar':
      voice('sawtooth', [[0, f * 1.3], [len * 0.3, f], [len, f * 0.75]], t, len, v * 1.1, { type: 'bandpass', from: 520, to: 240, q: 1 });
      return burst(t, len, 0.35 * volume, 320, 0.7);
    case 'bellow':
      return voice('square', [[0, f], [len, f * 0.85]], t, len, v * 0.7, { type: 'lowpass', from: 700, to: 450, q: 0.8 }, 6);
    case 'honk':
      voice('triangle', [[0, f], [len * 0.4, f * 1.05], [len, f * 0.95]], t, len * 0.55, v * 1.2, { type: 'lowpass', from: 1300, to: 900, q: 1 }, 5);
      return voice('triangle', [[0, f * 1.25], [len * 0.45, f * 1.2]], t + len * 0.45, len * 0.55, v, { type: 'lowpass', from: 1300, to: 800, q: 1 }, 5);
    case 'chirp':
      for (let i = 0; i < 3; i++) tone('sine', f, t + i * (len / 2.5), len / 3, v * 0.6, sfxGain, f * 1.5);
      return;
    case 'screech':
      return voice('sawtooth', [[0, f], [len * 0.4, f * 1.45], [len, f * 1.1]], t, len, v * 0.6, { type: 'bandpass', from: 1500, to: 1900, q: 2 });
    case 'song':
      return voice('sine', [[0, f * 1.2], [len * 0.5, f * 1.3], [len, f * 0.8]], t, len, v * 1.3, { type: 'lowpass', from: 900, to: 600, q: 0.7 }, 4);
  }
}
let lastCall = 0;

/**
 * One voice: an oscillator following a pitch path [time, Hz][], through a
 * sweeping filter, with an optional vibrato (Hz) and a soft attack and release.
 */
function voice(
  type: OscillatorType,
  path: [number, number][],
  start: number,
  dur: number,
  vol: number,
  filter: { type: BiquadFilterType; from: number; to: number; q: number },
  vibrato = 0,
): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(path[0][1], start);
  for (const [at, hz] of path.slice(1)) o.frequency.linearRampToValueAtTime(hz, start + at);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = vibrato;
    depth.gain.value = path[0][1] * 0.04;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(start);
    lfo.stop(start + dur + 0.1);
  }
  const f = ctx.createBiquadFilter();
  f.type = filter.type;
  f.Q.value = filter.q;
  f.frequency.setValueAtTime(filter.from, start);
  f.frequency.linearRampToValueAtTime(filter.to, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.06, dur / 4));
  g.gain.setValueAtTime(vol, start + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.1);
  o.connect(f).connect(g).connect(sfxGain);
  o.start(start);
  o.stop(start + dur + 0.15);
}

// --- Ambience: birdsong by day, crickets at night, very quietly. ---

export type Ambience = 'day' | 'night' | 'off';
let ambience: Ambience = 'off';
let ambienceTimer = 0;
/** Ambience sits well under everything else. */
const AMBIENCE_VOLUME = 0.35;

/** Called by the park view as the light changes (and with 'off' in storms or when turned off). */
export function setAmbience(mode: Ambience): void {
  ambience = mode;
  if (ambienceTimer || !ctx) return;
  ambienceTimer = window.setInterval(() => {
    if (!ctx || ctx.state !== 'running' || !getSettings().sfx || ambience === 'off') return;
    const t = ctx.currentTime + Math.random() * 0.8;
    const v = AMBIENCE_VOLUME;
    if (ambience === 'day' && Math.random() < 0.3) {
      // A little birdsong phrase.
      const base = 2200 + Math.random() * 1800;
      const notes = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < notes; i++) {
        const hz = base * (0.85 + Math.random() * 0.4);
        tone('sine', hz, t + i * 0.1, 0.07, 0.03 * v, sfxGain, hz * (1.1 + Math.random() * 0.3));
      }
    } else if (ambience === 'night' && Math.random() < 0.7) {
      // A cricket's chirrup.
      const pulses = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pulses; i++) tone('sine', 4300 + Math.random() * 200, t + i * 0.06, 0.03, 0.02 * v, sfxGain);
    }
  }, 1000);
}

/** Rain at full downpour, relative to other sound effects: a soft patter under the music. */
const RAIN_VOLUME = 0.045;

/** Fades the rain loop in and out (0 = dry, 1 = downpour). */
export function setRain(level: number): void {
  if (!ctx) return;
  rainGain.gain.setTargetAtTime(level * RAIN_VOLUME, ctx.currentTime, 0.8);
}

// --- Music: Scott Joplin rags (public domain) on a synthesised honky-tonk piano. ---

let pianoBus: AudioNode;

/** One piano note: a bright attack that decays like a struck string, a little out of tune for that saloon sound. */
function pianoNote(midi: number, start: number, dur: number): void {
  if (!ctx) return;
  const f = 440 * 2 ** ((midi - 69) / 12);
  const bass = midi < 55;
  const peak = (bass ? 0.13 : 0.16) * (0.9 + Math.random() * 0.2);
  const ring = Math.min(dur, 1.4);
  const end = start + ring + 0.12;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.006);
  g.gain.exponentialRampToValueAtTime(peak * 0.35, start + 0.18);
  g.gain.setValueAtTime(peak * 0.35 * Math.max(0.3, 1 - ring * 0.5), start + ring);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(pianoBus);
  for (const [type, mult, vol] of [
    ['triangle', 1, 1],
    ['triangle', 1.0035, 0.6], // honky-tonk detune
    ['sine', 2, bass ? 0.15 : 0.3],
  ] as const) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f * mult;
    const og = ctx.createGain();
    og.gain.value = vol;
    o.connect(og).connect(g);
    o.start(start);
    o.stop(end + 0.02);
  }
}

const SONG_GAP = 2.5;
let nowPlaying: { title: string; index: number; note: number } | null = null;
type SongListener = (title: string, composer: string, year: number) => void;
const songListeners = new Set<SongListener>();

/** Called with each piece's title, composer and year as it starts. */
export function onSong(fn: SongListener): () => void {
  songListeners.add(fn);
  return () => songListeners.delete(fn);
}

/** A fresh random order of the playlist, not starting with `avoid` (so nothing plays twice running). */
function shuffled(count: number, avoid: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (order.length > 1 && order[0] === avoid) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

async function startMusic(): Promise<void> {
  if (!ctx) return;
  // The playlist is about an hour of music: load it separately so it never delays the game starting.
  const { RAGS } = await import('./rags');
  if (!ctx) return;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3200;
  filter.Q.value = 0.3;
  filter.connect(musicGain);
  pianoBus = filter;

  // Shuffle the set, play it through, then reshuffle for the next time round.
  let order = shuffled(RAGS.length, -1);
  let slot = 0;
  let notes: Note[] = [];
  let i = 0;
  let songStart = 0;
  let pausedAt: number | null = null;
  const begin = (at: number) => {
    if (slot >= order.length) {
      order = shuffled(RAGS.length, order[order.length - 1]);
      slot = 0;
    }
    const rag: Rag = RAGS[order[slot]];
    notes = decodeRag(rag);
    i = 0;
    songStart = at;
    nowPlaying = { title: rag.title, index: order[slot], note: 0 };
    for (const fn of songListeners) fn(rag.title, rag.composer, rag.year);
  };
  begin(ctx.currentTime + 0.3);

  const schedule = () => {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Music switched off: hold our place in the song rather than play silently.
    if (!getSettings().music) {
      pausedAt ??= now - songStart;
      return;
    }
    if (pausedAt !== null) {
      songStart = now + 0.1 - pausedAt;
      pausedAt = null;
    }
    const horizon = now + 0.5;
    while (i < notes.length && songStart + notes[i].time < horizon) {
      const n = notes[i++];
      const at = songStart + n.time + (Math.random() - 0.5) * 0.008; // a human touch
      if (at >= now) pianoNote(n.midi, at, n.dur);
    }
    if (nowPlaying) nowPlaying.note = i;
    if (i >= notes.length) {
      const last = notes[notes.length - 1];
      const done = songStart + (last ? last.time + last.dur : 0);
      if (now > done - 0.4) {
        slot++;
        begin(done + SONG_GAP);
      }
    }
  };
  window.setInterval(schedule, 100);
}

/** For automated checks: whether audio is running and the current volume levels. */
export function audioDebug(): { state: string; sfx: number; music: number; rain: number; song: typeof nowPlaying } | null {
  if (!ctx) return null;
  return { state: ctx.state, sfx: sfxGain.gain.value, music: musicGain.gain.value, rain: rainGain.gain.value, song: nowPlaying };
}
