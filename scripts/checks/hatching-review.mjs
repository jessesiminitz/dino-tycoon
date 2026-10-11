import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ready, check, finish } from './lib.mjs';
const art=process.env.ART_STYLE ?? 'blender';
const base=process.env.BASE_URL ?? 'http://127.0.0.1:5174';
const out=fileURLToPath(new URL(`../../docs/hatching-review/${art==='cartoon'?'cartoon/':''}`,import.meta.url));
mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1180,height:820});
  await page.goto(`${base}/?quickstart&art=${art}`,{waitUntil:'load'});await ready(page);
  const ids=await page.evaluate(async()=>{const {SPECIES_IDS}=await import('/src/sim/data/species.ts');return SPECIES_IDS;});
  async function lay(id, extra=false) {
    await page.evaluate(async ({id,extra})=>{
      const {sim}=window.__dino; const {HATCH_HOURS}=await import('/src/sim/systems/breeding.ts');
      const {habitatOf}=await import('/src/sim/data/species.ts');
      sim.setSpeed(3);sim.state.eggs.push({id:sim.state.nextId++,species:id,x:4,y:4,laidHour:sim.state.hours-HATCH_HOURS});
      if(extra)sim.state.eggs.push({id:sim.state.nextId++,species:'triceratops',x:5,y:4,laidHour:sim.state.hours-HATCH_HOURS});
      if(habitatOf(id)==='water') {sim.state.stepInHour=23; const {STEPS_PER_HOUR}=await import('/src/sim/systems/dinos.ts');sim.state.stepInHour=STEPS_PER_HOUR-1;sim.step();}
      sim.setSpeed(sim.speed);
    },{id,extra});
    await page.waitForSelector('.hatch-dialog[open]',{visible:true});
  }
  for(const id of (process.argv.includes('--smoke') ? ['compsognathus','tyrannosaurus','mosasaurus'] : ids)) {
    await lay(id);
    const egg=await page.$('[data-hatch-egg]');
    if(egg) {
      const before=await page.evaluate(()=>window.__dino.sim.state.stats.hatched);
      for(let i=1;i<=2;i++) {
        if(i===2&&id==='compsognathus') await page.evaluate(()=>{window.__shellBursts=0;const original=AudioContext.prototype.createBufferSource;AudioContext.prototype.createBufferSource=function(...args){window.__shellBursts++;return original.apply(this,args);};});
        await page.click('[data-hatch-egg]');
        if(i===2&&id==='compsognathus')check('egg tap produces synthesized shell crack sound',await page.evaluate(()=>window.__shellBursts>=2));
        check(`${id}: tap ${i} cracks without creating baby`,await page.evaluate(({before,i})=>document.querySelector('[data-hatch-egg]').dataset.cracks===String(i)&&window.__dino.sim.state.stats.hatched===before&&window.__dino.sim.speed===0,{before,i}));
      }
      if(id==='tyrannosaurus')await page.screenshot({path:`${out}egg-cracked.png`});
      await page.click('[data-hatch-egg]');
    }
    check(`${id}: species-specific baby artwork`,await page.evaluate(async id=>{
      const {sim}=window.__dino;const baby=sim.state.dinos.at(-1);
      const {paintDino,dinoCanvasBounds}=await import('/src/render/dinoArt.ts');const {SPECIES}=await import('/src/sim/data/species.ts');
      const source=paintDino(SPECIES[id],0,true);const b=dinoCanvasBounds(source);const c=document.createElement('canvas');c.width=b.right-b.left;c.height=b.bottom-b.top;c.getContext('2d').drawImage(source,b.left,b.top,c.width,c.height,0,0,c.width,c.height);
      return baby.species===id&&baby.baby&&document.querySelector('.hatch-stage canvas').toDataURL()===c.toDataURL()&&document.querySelector('#hatch-title').textContent==='Congratulations!';
    },id));
    if(id==='compsognathus') {
      await page.type('#hatch-name','  Little   Pip  ');
      await new Promise(r=>setTimeout(r,450));
      await page.screenshot({path:`${out}baby-reveal.png`});
    }
    await page.click('.hatch-name-form button');
    check(`${id}: returns to previous speed`,await page.evaluate(()=>window.__dino.sim.speed===3&&!document.querySelector('.hatch-dialog').open));
    if(id==='compsognathus') check('optional name normalizes and saves',await page.evaluate(async()=>{const {loadSlot}=await import('/src/save/storage.ts');return (await loadSlot(3)).state.dinos.at(-1).name==='Little Pip';}));
  }
  check('tap gestures unlock audio without errors',await page.evaluate(()=>window.__dino.audioDebug()?.state==='running'));
  await lay('protoceratops',true);
  await page.click('[data-hatch-egg]');
  await page.evaluate(async()=>{const {setBootDirective}=await import('/src/save/storage.ts');setBootDirective({kind:'load',slot:3});});
  await page.goto(`${base}/?art=${art}`,{waitUntil:'load'});await ready(page);
  check('reload keeps ready eggs and reopens the hatch popup',await page.evaluate(()=>document.querySelector('[data-hatch-egg]')?.dataset.cracks==='0'&&window.__dino.sim.state.eggs.length===2));
  for(let i=0;i<3;i++)await page.click('[data-hatch-egg]');
  await page.click('.hatch-name-form button');
  check('simultaneous eggs queue without unpausing the park',await page.evaluate(()=>!!document.querySelector('[data-hatch-egg]')&&window.__dino.sim.speed===0));
  for(let i=0;i<3;i++)await page.click('[data-hatch-egg]');
  await page.click('.hatch-name-form button');
  check('queue finishes and restores original speed',await page.evaluate(()=>window.__dino.sim.speed===1&&!document.querySelector('.hatch-dialog').open));
  for(const [w,h] of [[667,375],[844,390],[390,844],[820,1180]]) {
    await page.setViewport({width:w,height:h,isMobile:true,hasTouch:true});
    await page.goto(`${base}/?quickstart&art=${art}`,{waitUntil:'load'});await ready(page);
    await lay('tyrannosaurus');
    check(`${w}x${h}: egg visible inside viewport`,await page.$eval('[data-hatch-egg]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
    for(let i=0;i<3;i++)await page.tap('[data-hatch-egg]');
    await new Promise(r=>setTimeout(r,450));
    await page.screenshot({path:`${out}baby-${w}x${h}.png`});
    await page.$eval('.hatch-name-form button',el=>el.scrollIntoView({block:'nearest'}));
    check(`${w}x${h}: welcome button remains tappable`,await page.$eval('.hatch-name-form button',el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.bottom<=innerHeight&&r.top>=0;}));
    await page.tap('.hatch-name-form button');
  }
} finally {await browser.close();}
finish(errors);
