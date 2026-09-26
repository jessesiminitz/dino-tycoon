import { getSettings, onSettings, type Settings } from '../ui/settings';

/**
 * All sound is synthesised with Web Audio: no audio files to download or license.
 * iOS only allows audio after a user gesture, so the context starts on the first tap.
 */
export type Sfx = 'click' | 'build' | 'cash' | 'error' | 'roar' | 'alert' | 'chime' | 'fanfare' | 'sad' | 'thunder';

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
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    src.connect(filter).connect(rainGain).connect(sfxGain);
    src.start();

    applySettings(getSettings());
    onSettings(applySettings);
    startMusic();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

/** Call once at startup: audio starts on the first touch or click anywhere. */
export function initAudio(): void {
  const once = () => unlock();
  window.addEventListener('pointerdown', once, { capture: true });
  window.addEventListener('keydown', once, { capture: true });
  // Resume after the app comes back from the background.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.visibilityState === 'visible') void ctx.resume();
    else void ctx.suspend();
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
const MIN_GAP_MS: Partial<Record<Sfx, number>> = { alert: 700, cash: 120, chime: 300, click: 40 };

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

/** Fades the rain loop in and out (0 = dry, 1 = downpour). */
export function setRain(level: number): void {
  if (!ctx) return;
  rainGain.gain.setTargetAtTime(level * 0.25, ctx.currentTime, 0.8);
}

// --- Music: a gentle chiptune loop, scheduled a little ahead of time. ---

const BPM = 100;
const STEP = 60 / BPM / 2; // eighth notes
/** C – Am – F – G, two bars each. */
const CHORDS = [
  [262, 330, 392],
  [220, 262, 330],
  [175, 220, 262],
  [196, 247, 294],
];
const PENTATONIC = [523, 587, 659, 784, 880, 1047];

function startMusic(): void {
  if (!ctx) return;
  let step = 0;
  let next = ctx.currentTime + 0.2;
  let melody = 2;
  const schedule = () => {
    if (!ctx || ctx.state !== 'running') return;
    while (next < ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 8);
      const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
      const beat = step % 8;
      // Bass on the beat, arpeggio on the off-beats.
      if (beat % 2 === 0) tone('triangle', chord[0] / 2, next, STEP * 1.8, 0.3, musicGain);
      else tone('square', chord[(beat >> 1) % 3], next, STEP * 0.8, 0.05, musicGain);
      // A wandering pentatonic melody, resting now and then.
      if (beat % 2 === 0 && Math.random() > 0.3) {
        melody = Math.max(0, Math.min(PENTATONIC.length - 1, melody + Math.floor(Math.random() * 3) - 1));
        tone('square', PENTATONIC[melody], next, STEP * 1.6, 0.06, musicGain);
      }
      next += STEP;
      step = (step + 1) % (CHORDS.length * 16);
    }
  };
  window.setInterval(schedule, 100);
}

/** For automated checks: whether audio is running and the current volume levels. */
export function audioDebug(): { state: string; sfx: number; music: number; rain: number } | null {
  if (!ctx) return null;
  return { state: ctx.state, sfx: sfxGain.gain.value, music: musicGain.gain.value, rain: rainGain.gain.value };
}
