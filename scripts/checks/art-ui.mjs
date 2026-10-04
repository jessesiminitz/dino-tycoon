// Sequential browser tours avoid competing GPU/CPU workloads on the development iMac.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=`${root}docs/art-review/logs`;
mkdirSync(out,{recursive:true});
const checks=['dino-gallery','babies-gallery','shaped-buildings','care-check','habitats-check',
  'attractions-check','dig-check','stickers-check','daynight-check','info-overlap','hud-check','ipad-portrait','icon-preview'];
let failed=false;
for(const check of checks) {
  const result=spawnSync(process.execPath,[`scripts/checks/${check}.mjs`],{
    cwd:root,env:{...process.env,ART_STYLE:'blender'},encoding:'utf8',timeout:180000,
  });
  writeFileSync(`${out}/${check}.log`,result.stdout+result.stderr+(result.error?.message??''));
  console.log(`${result.status===0 ? 'PASS' : 'FAIL'} ${check}`);
  if(result.status!==0) { failed=true; console.log((result.stderr||result.stdout).slice(-1600)); }
}
if(failed) process.exitCode=1;
