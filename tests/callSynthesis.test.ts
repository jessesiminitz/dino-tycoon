import { describe, it, expect } from 'vitest';
import { synthesizeCall } from '../src/audio/callSynthesis';
import { SPECIES_IDS } from '../src/sim/data/species';

const rms = (x: Float32Array) => Math.sqrt(x.reduce((s,v) => s + v*v,0) / x.length);
describe('procedural dinosaur voices', () => {
  it('renders every adult and baby as finite, audible, click-free audio with headroom', () => {
    for (const id of SPECIES_IDS) for (const baby of [false,true]) for (const rate of [22050,48000]) {
      const x=synthesizeCall(id,baby,rate);
      let peak=0,step=0,finite=true;
      for(let i=0;i<x.length;i++) {finite &&= Number.isFinite(x[i]);peak=Math.max(peak,Math.abs(x[i]));if(i)step=Math.max(step,Math.abs(x[i]-x[i-1]));}
      expect(finite).toBe(true);
      expect(peak).toBeLessThanOrEqual(.721);
      expect(rms(x)).toBeGreaterThan(.03);
      expect(Math.abs(x[0])+Math.abs(x[x.length-1])).toBe(0);
      expect(Math.abs(x[1])+Math.abs(x[x.length-2])).toBeLessThan(.01);
      expect(step).toBeLessThan(.55);
    }
  });
  it('carries large voices above the bass range for small speakers', () => {
    for (const id of ['tyrannosaurus', 'brachiosaurus', 'triceratops'] as const) {
      const samples = synthesizeCall(id, false, 22050);
      const high = new Float32Array(samples.length), alpha = Math.exp(-2 * Math.PI * 300 / 22050);
      for (let i = 1; i < samples.length; i++) high[i] = alpha * (high[i - 1] + samples[i] - samples[i - 1]);
      expect(rms(high) / rms(samples)).toBeGreaterThan(.25);
    }
  });
  it('retains softer shorter babies and distinct repeat variations', () => {
    const adult=synthesizeCall('tyrannosaurus',false,22050);
    const baby=synthesizeCall('tyrannosaurus',true,22050);
    expect(baby.length).toBeLessThan(adult.length);
    expect(rms(baby)).toBeLessThan(rms(adult));
    expect(synthesizeCall('tyrannosaurus',false,22050)).toEqual(adult);
    expect(synthesizeCall('tyrannosaurus',false,22050,1)).not.toEqual(adult);
    expect(synthesizeCall('parasaurolophus',false,22050)).not.toEqual(adult);
  });
});
