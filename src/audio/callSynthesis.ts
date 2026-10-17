import { callFor } from './calls';
import { SPECIES_IDS, type SpeciesId } from '../sim/data/species';

/** Original procedural audio: breath, irregular voicing and resonant overtones.
 * Playful animal-inspired voices, stylized for audibility on small speakers.
 */
export function synthesizeCall(species: SpeciesId, baby: boolean, sampleRate: number, variant = 0): Float32Array {
  const call = callFor(species, baby);
  const seed = SPECIES_IDS.indexOf(species) + 1;
  let randomState = (seed * 19349663 + variant * 83492791) >>> 0;
  const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296 * 2 - 1; };
  const length = call.length * (1 + (variant % 3 - 1) * .025);
  const data = new Float32Array(Math.ceil((length + .08) * sampleRate));
  const pitch = call.pitch * (1 + (variant % 3 - 1) * .025);
  const cluck = call.kind === 'cluck', breath = call.kind === 'breath', rasp = call.kind === 'rasp';
  const pulses = cluck ? 2 + seed % 2 : call.kind === 'grunt' ? 2 : 1;
  let phase = 0, smoothNoise = 0, previous = 0, dc = 0, closedVoice = 0;
  const cutoff = breath ? 950 : cluck || rasp ? 1900 : call.kind === 'crest' ? 1800 : 1600;
  const blend = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const time = i / sampleRate, progress = time / length;
    const pulsePosition = progress * pulses;
    const pulse = Math.floor(pulsePosition);
    const local = pulsePosition - pulse;
    // Slightly different attacks and falls, rather than repeated musical notes.
    const rise = Math.min(1, local / (cluck ? .09 : .17));
    const fall = Math.min(1, (1 - local) / (cluck ? .5 : .3));
    const envelope = progress >= 1 ? 0 : Math.sin(Math.PI / 2 * Math.max(0, Math.min(rise, fall))) ** 2;
    const flutter = 1 + .014 * Math.sin(time * 2 * Math.PI * (19 + seed % 7)) + .009 * random();
    const contour = cluck ? 1.17 - local * .38 : 1.08 + .18 * Math.sin(progress * Math.PI * 2) - .2 * progress;
    phase += 2 * Math.PI * pitch * contour * flutter * (1 + pulse * .035) / sampleRate;
    const air = random(); smoothNoise += blend * (air - smoothNoise);
    const voiced = Math.sin(phase) + .38 * Math.sin(2 * phase + .12) + .2 * Math.sin(3 * phase + .3)
      + (rasp || cluck ? .25 : .3) * Math.sin(5 * phase)
      + .22 * Math.sin(7 * phase) + .14 * Math.sin(9 * phase);
    const chest = call.kind === 'boom' ? .08 * Math.sin(phase / 2) : 0;
    // Audible growl formants carry large, bass-heavy voices on phone speakers.
    const growl = Math.min(1, 150 / pitch) * .65
      * Math.sin(phase * Math.max(2, Math.round(600 / pitch)))
      * (1 + .35 * Math.sin(time * 2 * Math.PI * (27 + seed % 9)));
    // A crest-inspired resonant overtone layer, not a CT reconstruction.
    const resonance = call.kind === 'crest' ? .28 * Math.sin(3 * phase) + .12 * Math.sin(5 * phase) : 0;
    const roughness = rasp ? .35 : breath ? .85 : cluck ? .12 : .16;
    const signal = ((breath ? .14 : .8) * voiced + resonance + chest + growl + roughness * smoothNoise)
      * envelope * (.91 + .09 * Math.sin(time * 2 * Math.PI * (rasp ? 38 : 7 + seed % 4)));
    // DC blocker, followed by a gentle low-pass to soften the growl edges.
    dc = signal - previous + .995 * dc; previous = signal;
    const closed = call.kind === 'boom' || call.kind === 'grunt' || call.kind === 'coo';
    closedVoice += blend * (dc - closedVoice);
    const sample = closedVoice + (closed ? smoothNoise * envelope * .09 : 0);
    data[i] = sample; peak = Math.max(peak, Math.abs(sample));
  }
  // Leave headroom and preserve the smaller baby's lower level. Silence at both ends.
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] *= .72 * call.volume / peak;
  data[0] = 0; data[data.length - 1] = 0;
  return data;
}
