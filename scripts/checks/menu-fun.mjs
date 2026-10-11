import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ready, check, finish } from './lib.mjs';
const art=process.env.ART_STYLE ?? 'blender', base=process.env.BASE_URL ?? 'http://127.0.0.1:5174';
const out=fileURLToPath(new URL(`../../docs/menu-fun/${art}/`,import.meta.url));mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/?art=${art}`,{waitUntil:'networkidle0'});
 await page.waitForSelector('.menu-dino img');
 for(const [w,h] of [[1180,820],[667,375],[844,390],[390,844],[820,1180]]) {
  await page.setViewport({width:w,height:h});
  const r=await page.evaluate(async()=>{
   const buttons=[...document.querySelectorAll('.menu-parade-group:first-child .menu-dino')];
   const {menuDinoSize,paintMenuDino}=await import('/src/render/menuDino.ts');
   const sizes=buttons.map(b=>{const i=b.querySelector('img'),r=i.getBoundingClientRect(),scale=Math.min(r.width/i.naturalWidth,r.height/i.naturalHeight);const world=menuDinoSize(paintMenuDino(b.dataset.species));return {id:b.dataset.species,w:i.naturalWidth*scale,h:i.naturalHeight*scale,zoom:r.width/world.width};});
   const start=document.querySelector('[data-go="new"]').getBoundingClientRect(),parade=document.querySelector('.menu-parade').getBoundingClientRect();
   return {count:buttons.length,comp:sizes.find(s=>s.id==='compsognathus'),minHeight:Math.min(...sizes.map(s=>s.h)),zoomSpread:Math.max(...sizes.map(s=>s.zoom))-Math.min(...sizes.map(s=>s.zoom)),safe:start.bottom<=parade.top,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  check(`${w}x${h}: game-relative dinosaur sizes and unobstructed New park`,r.count===28&&r.comp.h>0&&r.minHeight>0&&r.zoomSpread<0.005&&r.safe&&!r.overflow,r);
  await page.screenshot({path:`${out}menu-${w}x${h}.png`});
 }
 await page.setViewport({width:1180,height:820});
 const before=await page.$eval('.menu-parade-group:nth-child(2) img',i=>i.src);
 await new Promise(r=>setTimeout(r,700));
 check('visible dinosaurs play authored walking frames',before!==await page.$eval('.menu-parade-group:nth-child(2) img',i=>i.src));
 for(const [id,reaction] of [['compsognathus','hop'],['pteranodon','flutter'],['mosasaurus','splash'],['nigersaurus','nod']]) {
  await page.evaluate(id=>{const track=document.querySelector('.menu-parade-track'),button=track.querySelector(`[data-species="${id}"]`);track.style.animation='none';track.style.transform=`translateX(${20-button.offsetLeft}px)`;},id);
  const selector=`.menu-parade-group:first-child [data-species="${id}"]`;
  await page.click(selector);
  if(id==='compsognathus') {
   await new Promise(r=>setTimeout(r,420));
   check('tap animation keeps the body aspect ratio',await page.$eval(selector+' img',i=>{const m=new DOMMatrix(getComputedStyle(i).transform);return Math.abs(Math.hypot(m.a,m.b)-Math.hypot(m.c,m.d))<.001;}));
  }
  check(`${id} answers a tap with ${reaction}`,await page.$eval(selector,(b,reaction)=>b.dataset.reaction===reaction,reaction));
  await page.click(selector);
  check(`${id} enjoys a snack on the next tap`,await page.$eval(selector,b=>b.dataset.reaction==='munch')&&await page.$eval('.menu-parade-hint',p=>p.textContent.includes('yum')));
 }
 await page.evaluate(()=>{const track=document.querySelector('.menu-parade-track');track.style.animation='';track.style.transform='';document.activeElement.blur();});
 await new Promise(r=>setTimeout(r,2000));
 check('parade resumes after the tap reaction',await page.$eval('.menu-parade-track',t=>!t.classList.contains('is-playing')&&getComputedStyle(t).animationPlayState==='running'));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 check('reduced motion stops scrolling and keeps manual browsing',await page.$eval('.menu-parade',p=>getComputedStyle(p).overflowX==='auto'&&getComputedStyle(p.querySelector('.menu-parade-track')).animationName==='none'));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
 await page.goto(`${base}/?quickstart&stress&art=${art}`,{waitUntil:'load'});await ready(page);
 const care=await page.evaluate(async()=>{
  const {sim,game}=window.__dino; const scene=game.scene.getScene('park'),entities=scene.entities;
  game.loop.sleep();sim.setSpeed(0);sim.state.hours=4;
  const {updateSettings}=await import('/src/ui/settings.ts');updateSettings({animation:true});
  const d=sim.state.dinos[0];Object.assign(d,{hunger:10,sick:false,escaped:false,lastPatHour:-999,lastTreatHour:-999});
  let clock=game.loop.now;entities.update(clock);const base=entities.dinoSprite(d.id),angle=base.angle,x=d.x,y=d.y,hours=sim.state.hours;
  scene.care(d.id,'patDino');for(let i=0;i<3;i++)entities.update(clock+=100);
  const happy=entities.dinoSprite(d.id).angle!==angle;
  for(let i=0;i<15;i++)entities.update(clock+=100);
  const reset=entities.dinoSprite(d.id).angle===0;
  scene.care(d.id,'treatDino');entities.update(clock+=200);
  const eats=String(entities.dinoSprite(d.id).frame.name).startsWith('eat-');
  for(let i=0;i<15;i++)entities.update(clock+=100);
  updateSettings({animation:false});scene.care(d.id,'patDino');entities.update(clock+=200);
  const still=entities.dinoSprite(d.id).angle===0;
  return {happy,reset,eats,still,paused:sim.speed===0&&sim.state.hours===hours&&d.x===x&&d.y===y};
 });
 check('park pats, treats and reduced-motion feedback work while paused',Object.values(care).every(Boolean),care);
}finally{await browser.close();}
finish(errors);
