import puppeteer from 'puppeteer-core';
import {check,finish,ready} from './lib.mjs';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.BASE_URL??'http://localhost:5173'}/?quickstart&stress`,{waitUntil:'load'});await ready(page);
  await page.waitForFunction(()=>window.__dino.game.scene.getScene('park').entities?.dinos.size>0);
  const paused=await page.evaluate(()=>{
    const {sim,game}=window.__dino,entities=game.scene.getScene('park').entities;
    sim.speed=1;const d=sim.state.dinos[0];d.px=d.x-1;
    Object.defineProperty(sim,'stepProgress',{configurable:true,get:()=>.35});entities.update(1000);
    const before=entities.dinoPosition(d);delete sim.stepProgress;sim.setSpeed(0);entities.update(2000);
    const after=entities.dinoPosition(d),img=entities.dinos.get(d.id);
    return {same:before.x===after.x&&before.y===after.y,accurate:Math.abs(after.x-img.x)<=.5&&Math.abs(after.y-img.y)<=.5};
  });check('paused position lookup stays at the visible animal',paused.same&&paused.accurate,paused);
  const cleanup=await page.evaluate(()=>{
    const {sim,game}=window.__dino,entities=game.scene.getScene('park').entities;
    const saved=sim.state.dinos,feeder=sim.state.feeders.find(f=>f.kind==='plants');
    sim.state.dinos=[{...saved[0],id:99003,species:'triceratops',x:feeder.x,px:feeder.x,y:feeder.y,py:feeder.y,hunger:90,path:[]}];
    sim.state.hours=4;sim.step();const queued=entities.meals.has(99003);
    sim.state.dinos=[];entities.update(3000);const empty=entities.meals.size===0;
    sim.state.dinos=saved;return {queued,empty};
  });check('meal cues clear when animals disappear before their first frame',cleanup.queued&&cleanup.empty,cleanup);
  for(const [width,height] of [[390,844],[667,375],[844,390],[820,1180]]){
    await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    // Portrait parks show the existing rotate hint; invoke the same menu handlers for layout review.
    await page.$eval('#btn-menu',el=>el.click());
    await page.waitForSelector('[data-pause="settings"]',{visible:true});
    await page.$eval('[data-pause="settings"]',el=>el.click());
    const layout=await page.evaluate(()=>{
      const card=document.querySelector('#pause .modal-card'),r=card.getBoundingClientRect();
      const setting=card.querySelector('[data-key="animation"]');
      return {fits:r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,setting:!!setting,scrollable:card.scrollHeight>card.clientHeight};
    });check(`world animation setting fits ${width}×${height}`,layout.fits&&layout.setting,layout);
    await page.$eval('#pause [data-key="animation"]',el=>{el.checked=false;el.dispatchEvent(new Event('input',{bubbles:true}));});
    check('world animation setting applies',await page.evaluate(async()=>!(await import('/src/ui/settings.ts')).getSettings().animation));
    await page.click('[data-pause="resume"]');
  }
  finish(errors);
}catch(error){console.error(error);process.exitCode=1;}finally{
  let timer;await Promise.race([browser.close(),new Promise(resolve=>{timer=setTimeout(()=>{browser.disconnect();browser.process()?.kill('SIGKILL');resolve();},10000);})]);clearTimeout(timer);
}
process.exit(process.exitCode??0);
