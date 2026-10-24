import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { check, finish, ready, gameUrl, shopPick, toScreen, reach } from './lib.mjs';
const style=process.env.ART_STYLE??'blender', out=`docs/lagoon-review/${style}`;
await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],results=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try {
 for(const [width,height] of [[844,390],[667,375]]) {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.goto(gameUrl('/'),{waitUntil:'networkidle0'});
  await page.click('[data-go="new"]');
  check(`New park goes directly to island selection ${width}`,await page.$eval('.menu-body',b=>!!b.querySelector('[data-start-sandbox]')&&!b.querySelector('[data-scenario], [data-folder]')));
  await page.click('[data-start-sandbox]');await ready(page);
  const area=await page.evaluate(async({width,height})=>{
   const {ParkBuilder}=await import('/src/sim/parkBuilder.ts');
   const {sim,game}=window.__dino;sim.setSpeed(0);const {x:gx,y:gy}=sim.state.entrance;for(let y=gy-14;y<gy;y++)for(let x=gx-8;x<=gx+8;x++)sim.state.map.tiles[y*sim.state.map.width+x]=3;const b=new ParkBuilder(sim.state);b.prepare(-8,-14,8,-1);b.finish(50000,75);
   sim.state.unlockedSpecies.push('plesiosaurus');sim.worldRevision++;
   const {x:ex,y:ey}=sim.state.entrance;
   const sc=game.scene.getScene('park'),cam=sc.cameras.main;cam.setZoom(1.5);
   cam.centerOn(ex*16-((width-128)-width/2)/1.5,(ey-7)*16-(148-height/2)/1.5);
   return {x:ex-3,y:ey-10,free:sim.state.scenario.status==='free'};
  },{width,height});
  check(`new park is free play ${width}`,area.free);
  await shopPick(page,'fence','lagoon');await sleep(300);
  const p=await toScreen(page,area.x,area.y),q=await toScreen(page,area.x+6,area.y+6);
  const targets=await page.evaluate(({p,q})=>[p,q].map(v=>document.elementFromPoint(v.x,v.y)?.tagName),{p,q});
  check(`lagoon drag endpoints clear of phone controls ${width}`,targets.every(t=>t==='CANVAS'),{p,q,targets});
  await page.touchscreen.touchStart(p.x,p.y);
  for(let i=1;i<=10;i++){await page.touchscreen.touchMove(p.x+(q.x-p.x)*i/10,p.y+(q.y-p.y)*i/10);await sleep(20);}
  await page.touchscreen.touchEnd();await sleep(400);
  const built=await page.evaluate(({x,y})=>{
   const {sim}=window.__dino,s=sim.state,w=s.map.width;
   const region=sim.regions();const i=(y+2)*w+x+2;
   const result={water:s.map.tiles.slice().filter((t,i)=>t===8&&(i%w)>x&&(i%w)<x+5&&Math.floor(i/w)>y&&Math.floor(i/w)<y+5).length,home:region.regions[region.tileRegion[i]]?.kind,money:s.money};
   result.release=sim.dispatch({type:'buyDino',species:'plesiosaurus',x:x+2,y:y+2}).ok;
   result.feeder=sim.dispatch({type:'placeFeeder',kind:'fish',x:x+3,y:y+2}).ok;
   return result;
  },area);
  check(`one drag creates paid water and an enclosed lagoon ${width}`,built.water===16&&built.home==='paddock'&&built.money===41200,built);
  check(`water dinosaur and fish feeder work immediately ${width}`,built.release&&built.feeder,built);
  await sleep(500);await page.screenshot({path:`${out}/lagoon-${width}.png`});
  await (await reach(page, '.tool-btn[data-mode="decor"]')).click();
  const waterGarden=await page.$$eval('.modal:not(.hidden) .shop-card',cards=>cards.some(c=>['pond','drain'].includes(c.dataset.id)));
  check(`Gardening has no pond or marsh tools ${width}`,!waterGarden);
  await page.click('.modal:not(.hidden) .modal-close');
  await (await reach(page, '.tool-btn[data-mode="demolish"]')).click();
  const drain=await page.evaluate(({x,y})=>{const {sim,game}=window.__dino;const d={x:x+7,y:y+2};sim.state.map.tiles[d.y*sim.state.map.width+d.x]=10;sim.worldRevision++;game.scene.getScene('park').cameras.main.centerOn((d.x+.5)*16,(d.y+.5)*16);return d;},area);
  await sleep(250);const dp=await toScreen(page,drain.x+.5,drain.y+.5);
  await page.touchscreen.tap(dp.x,dp.y);await sleep(250);
  check(`Remove drains natural marsh ${width}`,await page.evaluate(d=>window.__dino.sim.state.map.tiles[d.y*window.__dino.sim.state.map.width+d.x]===3,drain));
  results.push({width,area,built});await page.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify({results,errors},null,2)+'\n');finish(errors);
}finally{await browser.close();}
