import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const out=fileURLToPath(new URL('../../docs/art-review/',import.meta.url));mkdirSync(out,{recursive:true});
const base=process.env.BASE_URL??'http://localhost:5173';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],results=[];
let failed=false;
const check=(name,ok,detail)=>{assert.ok(ok,`${name}: ${JSON.stringify(detail)}`);results.push({name,detail});console.log('OK',name);};
try {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1180,height:1000,deviceScaleFactor:1});
  await page.goto(`${base}/scripts/art/review.html`,{waitUntil:'load'});
  const href=await page.$eval('a[href="./immersion.html"]',a=>a.href);
  await page.goto(href,{waitUntil:'load'});await page.waitForFunction(()=>window.__immersion);
  await page.evaluate(()=>localStorage.setItem('immersion-save-sentinel','unchanged'));
  const initial=await page.evaluate(()=>window.__immersion.snapshot());
  check('three dinosaurs and all cached adult/baby clips',initial.actors.length===3&&initial.cachedSprites===192,initial.cachedSprites);
  await page.screenshot({path:`${out}immersion-dusk-desktop.png`,fullPage:true});
  await page.click('#pause');
  const frozen=await page.evaluate(()=>({state:window.__immersion.snapshot(),pixels:document.querySelector('#world').toDataURL()}));
  await new Promise(r=>setTimeout(r,250));
  const after=await page.evaluate(()=>({state:window.__immersion.snapshot(),pixels:document.querySelector('#world').toDataURL()}));
  check('pause freezes the complete world',frozen.state.clock===after.state.clock&&frozen.pixels===after.pixels);
  const pixels=await page.evaluate(async()=>{
    const {BLENDER_MOTION}=await import('/src/render/generated/blenderMotion.ts');
    const {paintDinoRows}=await import('/src/render/dinoArt.ts');
    const {SPECIES}=await import('/src/sim/data/species.ts');
    const failures=[];let compared=0;
    for(const clip of ['walk','idle','eat','rest'])for(const small of [false,true])for(const mirrored of [false,true])for(let frame=0;frame<8;frame++) {
      for(const [id,value]of [['clip',clip],['baby',small],['left',mirrored],['frame',frame]]) {
        const control=document.getElementById(id);if(typeof value==='boolean')control.checked=value;else control.value=String(value);control.dispatchEvent(new Event('input'));
      }
      for(const id of Object.keys(BLENDER_MOTION)) {
        const actual=document.querySelector(`[data-species="${id}"] canvas`),source=paintDinoRows(SPECIES[id],BLENDER_MOTION[id][clip].frames[frame],small);
        const expected=document.createElement('canvas');expected.width=source.width*2;expected.height=source.height*2;
        const ctx=expected.getContext('2d');ctx.imageSmoothingEnabled=false;if(mirrored){ctx.translate(expected.width,0);ctx.scale(-1,1);}ctx.drawImage(source,0,0,expected.width,expected.height);
        if(actual.toDataURL()!==expected.toDataURL())failures.push(`${id}:${clip}:${frame}:${small}:${mirrored}`);
        const alpha=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
        if(alpha.some((a,i)=>i%4===3&&a!==0&&a!==255))failures.push(`${id}:soft alpha`);
        compared++;
      }
    }
    return {failures,compared};
  });
  check('384 pose/baby/direction previews match the shared pixel painter',pixels.failures.length===0,pixels);
  await page.select('#behavior','walk');await page.select('#speed','2');await page.click('#pause');
  const walking=await page.evaluate(()=>window.__immersion.snapshot());
  await new Promise(r=>setTimeout(r,1500));
  const moved=await page.evaluate(()=>window.__immersion.snapshot());
  check('walking moves animals and emits grounded footfalls',moved.actors.every((a,i)=>a.x!==walking.actors[i].x)&&moved.footfallCount>walking.footfallCount,{before:walking.footfallCount,after:moved.footfallCount});
  await page.$eval('#footsteps',c=>{c.checked=false;c.dispatchEvent(new Event('input'));});
  const silent=await page.evaluate(()=>window.__immersion.snapshot().footfallCount);
  await new Promise(r=>setTimeout(r,550));
  check('footstep switch suppresses new particles',silent===await page.evaluate(()=>window.__immersion.snapshot().footfallCount));
  await page.$eval('#footsteps',c=>{c.checked=true;c.dispatchEvent(new Event('input'));});
  await page.select('#atmosphere','rain');await page.screenshot({path:`${out}immersion-rain-desktop.png`,fullPage:true});
  await page.select('#behavior','eat');await new Promise(r=>setTimeout(r,120));
  check('eating happens at each animal’s feeder',await page.evaluate(()=>window.__immersion.snapshot().actors.every(a=>a.clip==='eat'&&a.x===a.max&&a.facing===1)));
  await page.screenshot({path:`${out}immersion-eating-desktop.png`,fullPage:true});
  await page.select('#behavior','rest');await new Promise(r=>setTimeout(r,120));
  check('rest keeps positions stationary',await page.evaluate(()=>window.__immersion.snapshot().actors.every(a=>a.clip==='rest'&&a.x===a.max)));
  await page.select('#behavior','natural');await page.select('#atmosphere','dusk');
  // Drive the actual animation callback deterministically in a fresh page, avoiding
  // a long real-time wait for the full feeding/resting/walking schedule.
  const natural=await browser.newPage();
  await natural.evaluateOnNewDocument(()=>{
    window.__frames=[];window.requestAnimationFrame=callback=>{window.__frames.push(callback);return window.__frames.length;};
  });
  await natural.goto(href,{waitUntil:'load'});await natural.waitForFunction(()=>window.__immersion);
  const sequence=await natural.evaluate(()=>{
    const seen=Object.fromEntries(window.__immersion.snapshot().actors.map(a=>[a.id,new Set()]));
    for(let tick=1;tick<=550;tick++) {
      window.__frames.shift()(tick*100);
      for(const actor of window.__immersion.snapshot().actors)seen[actor.id].add(actor.clip);
    }
    return Object.fromEntries(Object.entries(seen).map(([id,clips])=>[id,[...clips]]));
  });
  check('natural behavior reaches walk, idle, eat and rest for all three',Object.values(sequence).every(clips=>clips.length===4),sequence);
  await natural.close();
  const performance=await page.evaluate(async()=>{
    const samples=[];let previous;
    await new Promise(resolve=>{const tick=time=>{if(previous!==undefined)samples.push(time-previous);previous=time;if(samples.length<90)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
    samples.sort((a,b)=>a-b);return {p95FrameMs:samples[Math.floor(samples.length*.95)],cachedSprites:window.__immersion.snapshot().cachedSprites};
  });
  check('animation does not grow its sprite cache',performance.cachedSprites===192,performance);
  for(const [width,height,name]of [[390,844,'phone'],[844,390,'phone-landscape'],[820,1180,'ipad']]) {
    await page.setViewport({width,height,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const layout=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth,cards:document.querySelectorAll('.card').length,canvas:document.querySelector('#world').getBoundingClientRect().width}));
    check(`${name} fits without horizontal overflow`,layout.content<=layout.width&&layout.cards===3&&layout.canvas>250,layout);
    await page.screenshot({path:`${out}immersion-${name}.png`,fullPage:true});
  }
  check('prototype leaves storage untouched',await page.evaluate(()=>localStorage.length===1&&localStorage.getItem('immersion-save-sentinel')==='unchanged'));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.__immersion);
  check('reduced-motion preference starts paused',await page.evaluate(()=>window.__immersion.snapshot().paused));
  check('no browser errors',errors.length===0,errors);
  writeFileSync(`${out}immersion-check.json`,JSON.stringify({results,performance},null,2)+'\n');
}catch(error){failed=true;console.error(error);}finally{
  let timer;await Promise.race([browser.close(),new Promise(resolve=>{timer=setTimeout(()=>{browser.disconnect();browser.process()?.kill('SIGKILL');resolve();},10000);})]);clearTimeout(timer);
}
process.exit(failed?1:0);
