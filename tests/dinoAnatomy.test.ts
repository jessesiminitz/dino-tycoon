import {describe,it,expect} from 'vitest';
import manifest from '../assets-source/export-manifest.json';
import contacts from '../assets-source/walk-contacts.json';
import {BLENDER_ART} from '../src/render/generated/blenderArt';
import {BLENDER_MOTION} from '../src/render/generated/blenderMotion';
import {SPECIES_IDS} from '../src/sim/data/species';

// World-relative toes before the reference anatomy pass. Extra camera room must
// never slide a walking dinosaur relative to its park position when mirrored.
const originalToes = {
  "compsognathus": [
    0.1,
    -1.5,
    -3.1,
    -1.5
  ],
  "velociraptor": [
    0.85,
    -1.02,
    -2.89,
    -1.02
  ],
  "dilophosaurus": [
    0.9,
    -1.48,
    -3.86,
    -1.48
  ],
  "allosaurus": [
    2.3,
    -0.76,
    -3.82,
    -0.76
  ],
  "tyrannosaurus": [
    7.0,
    4.0,
    1.0,
    4.0
  ],
  "pachycephalosaurus": [
    1.725,
    -0.57,
    -2.865,
    -0.57
  ],
  "parasaurolophus": [
    3.125,
    0.15,
    -2.825,
    0.15
  ],
  "protoceratops": [
    -5.88,
    -7.38,
    -8.88,
    -7.38
  ],
  "triceratops": [
    -10.0,
    -12.0,
    -14.0,
    -12.0
  ],
  "stegosaurus": [
    -8.35,
    -10.3,
    -12.25,
    -10.3
  ],
  "ankylosaurus": [
    -7.66,
    -9.48,
    -11.3,
    -9.48
  ],
  "brachiosaurus": [
    -6.73,
    -8.94,
    -11.15,
    -8.94
  ],
  "spinosaurus": [
    -0.4,
    -3.12,
    -5.84,
    -3.12
  ],
  "therizinosaurus": [
    1.125,
    -1.85,
    -4.825,
    -1.85
  ],
  "amargasaurus": [
    -9.35,
    -11.3,
    -13.25,
    -11.3
  ],
  "kentrosaurus": [
    -5.125,
    -6.75,
    -8.375,
    -6.75
  ],
  "styracosaurus": [
    -10.35,
    -12.3,
    -14.25,
    -12.3
  ],
  "carnotaurus": [
    -1.4,
    -4.12,
    -6.84,
    -4.12
  ],
  "yutyrannus": [
    -0.05,
    -2.94,
    -5.83,
    -2.94
  ],
  "iguanodon": [
    -0.4,
    -3.12,
    -5.84,
    -3.12
  ],
  "microraptor": [
    -0.78,
    -2.38,
    -3.98,
    -2.38
  ],
  "diplodocus": [
    -12.35,
    -14.3,
    -16.25,
    -14.3
  ],
  "argentinosaurus": [
    -11.56,
    -14.68,
    -17.8,
    -14.68
  ],
  "nigersaurus": [
    -11.815,
    -13.57,
    -15.325,
    -13.57
  ]
} as const;

describe('reference anatomy and park placement',()=>{
  for(const id of Object.keys(originalToes) as (keyof typeof originalToes)[]) {
    it(`${id} preserves the original world toe anchors`,()=>{
      contacts[id].forEach((foot,i)=>{
        expect(foot.x-BLENDER_ART[id].width/2).toBeCloseTo(originalToes[id][i],3);
      });
    });
  }
  for(const id of SPECIES_IDS.filter(id=>(manifest.assets[id] as {modelOffsetX?:number}).modelOffsetX)) {
    it(`${id} has camera room for its complete animated silhouette`,()=>{
      const spec=manifest.assets[id] as {modelOffsetX?:number};
      if(!spec.modelOffsetX)return;
      const frames=[...BLENDER_ART[id].frames,...Object.values(BLENDER_MOTION[id]).flatMap(clip=>clip.frames)];
      for(const rows of frames) {
        expect(rows.every(row=>row[0]==='.' && row.at(-1)==='.')).toBe(true);
      }
    });
  }
});
