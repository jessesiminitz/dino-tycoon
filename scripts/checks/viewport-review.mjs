import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { check, finish, gameUrl, ready } from './lib.mjs';
const art=process.env.ART_STYLE ?? 'blender', out=`docs/viewport-review/${art}`;
await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],results=[];
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:667,height:375});
 // Browser controls can reduce the visual viewport without resizing the layout viewport.
 await page.evaluateOnNewDocument(()=>{
  const viewport=new EventTarget();Object.assign(viewport,{height:305,width:667,offsetTop:0,offsetLeft:0,scale:1});
  Object.defineProperty(window,'visualViewport',{value:viewport});
  window.__setVisibleViewport=(height,top=0)=>{Object.assign(viewport,{height,offsetTop:top});viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));};
 });
 await page.goto(gameUrl('/'),{waitUntil:'networkidle0'});
 await page.evaluate(()=>document.documentElement.style.setProperty('--safe-bottom','22px'));
 for(const [height,top] of [[305,0],[250,30],[375,0]]) {
  await page.evaluate((height,top)=>window.__setVisibleViewport(height,top),height,top);
  const r=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
   return {menu:rect('.menu'),content:rect('.menu-content'),parade:rect('.menu-parade'),layout:innerHeight};
  });
  check(`title fits ${height}px visible height at offset ${top}`,Math.abs(r.menu.top-top)<1&&Math.abs(r.menu.bottom-top-height)<1&&r.content.height===height&&r.parade.bottom<=top+height-22,r);
  await page.$eval('[data-go="settings"]',b=>b.scrollIntoView({block:'start'}));
  check(`Settings stays reachable at ${height}px`,await page.$eval('[data-go="settings"]',b=>{const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-go="settings"]')===b;}));
  results.push({height,top,...r});
  if(height===305)await page.screenshot({path:`${out}/menu-browser-controls.png`});
 }
 await page.goto(gameUrl('/?quickstart'),{waitUntil:'load'});await ready(page);
 await page.evaluate(()=>document.documentElement.style.setProperty('--safe-bottom','22px'));
 for(const [height,top] of [[305,0],[250,30],[375,0]]) {
  await page.evaluate((height,top)=>window.__setVisibleViewport(height,top),height,top);
  await page.waitForFunction(height=>Math.abs(document.querySelector('#game canvas').getBoundingClientRect().height-height)<1,{timeout:10000},height);
  const r=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
   return {game:rect('#game'),canvas:rect('#game canvas'),toolbar:rect('.toolbar'),hud:rect('.hud'),camera:window.__dino.game.scene.getScene('park').cameras.main.height};
  });
  check(`park and tools fit ${height}px visible height at offset ${top}`,Math.abs(r.game.top-top)<1&&Math.abs(r.canvas.bottom-top-height)<1&&r.toolbar.bottom<=top+height-22&&r.hud.top>=top&&r.camera===height,r);
  results.push({height,top,...r});
  if(height===305)await page.screenshot({path:`${out}/park-browser-controls.png`});
 }
 // A runtime-created shop must use the same containing block as the static menu.
 await page.evaluate(()=>window.__setVisibleViewport(305));
 await page.evaluate(()=>document.querySelector('#buy [data-mode="fence"]').click());
 await page.waitForSelector('.modal:not(.hidden) .shop-card',{visible:true});
 const dialog=await page.$eval('.modal:not(.hidden) .shop-card',b=>{const r=b.closest('.modal').getBoundingClientRect();return {top:r.top,bottom:r.bottom};});
 check('runtime shop fits the visible viewport',dialog.top===0&&dialog.bottom===305,dialog);
 const normal=await browser.newPage();normal.on('pageerror',e=>errors.push(e.message));
 await normal.goto(gameUrl('/'),{waitUntil:'networkidle0'});
 for(const [width,height] of [[667,375],[844,390],[390,844],[1180,820]]) {
  await normal.setViewport({width,height});
  await normal.waitForFunction(()=>Math.abs(document.querySelector('.menu').getBoundingClientRect().height-visualViewport.height)<1);
  const r=await normal.evaluate(()=>{const m=document.querySelector('.menu').getBoundingClientRect(),p=document.querySelector('.menu-parade').getBoundingClientRect();return {top:m.top,bottom:m.bottom,paradeBottom:p.bottom,height:visualViewport.height};});
  check(`normal ${width}x${height} screen keeps the bottom visible`,r.top===0&&r.bottom===height&&r.paradeBottom<=height,r);
  results.push({width,height,normal:r});
 }
 await writeFile(`${out}/results.json`,JSON.stringify({results,dialog,errors},null,2)+'\n');finish(errors);
} finally {await browser.close();}
