// Serve the Blender build under the same subpath as GitHub Pages and restart offline.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import puppeteer from 'puppeteer-core';
import { check, finish } from './lib.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dist=resolve(root,process.env.ART_DIST ?? 'dist');
const out=resolve(root,'docs/art-review');
mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css','.png':'image/png'};
const server=createServer((req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith('/dino-tycoon/')) {res.writeHead(404);res.end();return;}
  const file=resolve(dist,path.slice('/dino-tycoon/'.length)||'index.html');
  if(!file.startsWith(dist+'/') || !existsSync(file)) {res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-cache'});
  res.end(readFileSync(file));
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4175,'127.0.0.1',resolve);});
let browser;
const errors=[];
try {
  browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const expectedPage=await browser.newPage();
  await expectedPage.goto(`${process.env.BASE_URL ?? 'http://localhost:5173'}/?art=${process.env.ART_STYLE ?? 'blender'}`,{waitUntil:'networkidle0'});
  const expected=await expectedPage.evaluate(async()=>{
    const {paintMenuDino}=await import('/src/render/menuDino.ts');
    const {SPECIES_IDS}=await import('/src/sim/data/species.ts');
    return SPECIES_IDS.map(id=>paintMenuDino(id).toDataURL());
  });
  const offlinePark=await expectedPage.evaluate(async()=>{const {stressPark}=await import('/src/dev/stressPark.ts');const state=stressPark();state.entrance={x:28,y:25};return state;});
  await expectedPage.close();
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true});
  await page.goto('http://127.0.0.1:4175/dino-tycoon/',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-go="new"]',{visible:true});
  const active=await page.evaluate(expected=>{
    const images=[...document.querySelectorAll('.menu-parade img')].map(i=>i.dataset.poster);
    return expected.every(src=>images.includes(src)) && !window.__dino;
  },expected);
  check('production build uses the new art with production dev hooks stripped',active);
  const tap=async selector=>{await (await page.waitForSelector(selector,{visible:true})).tap();};
  await tap('[data-go="new"]');await tap('[data-go="island"]');await tap('[data-start-sandbox]');
  await page.waitForSelector('#game canvas');
  const saved=await page.evaluate(()=>{
    const rec=JSON.parse(localStorage.getItem('dino-tycoon:slot:1'));
    return rec?.state.version===21 && document.body.classList.contains('in-park');
  });
  check('production build starts and saves a normal v21 park',saved);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload({waitUntil:'networkidle0'});
  check('service worker controls the Pages subpath',await page.evaluate(()=>!!navigator.serviceWorker.controller));
  await page.evaluate(state=>{const key='dino-tycoon:slot:1',rec=JSON.parse(localStorage.getItem(key));rec.state=state;rec.savedAt=Date.now()+1000;rec.summary.dinos=state.dinos.length;localStorage.setItem(key,JSON.stringify(rec));},offlinePark);
  await page.setOfflineMode(true);
  await page.reload({waitUntil:'load'});
  await page.waitForSelector('[data-play="1"]',{visible:true});
  check('new menu art is present after offline restart',await page.evaluate(expected=>{
    const images=[...document.querySelectorAll('.menu-parade img')].map(i=>i.dataset.poster);
    return expected.every(src=>images.includes(src));
  },expected));
  await tap('[data-play="1"]');
  await page.waitForSelector('#game canvas');
  check('populated v21 park resumes offline',await page.evaluate(()=>document.body.classList.contains('in-park')&&JSON.parse(localStorage.getItem('dino-tycoon:slot:1')).state.dinos.length>=30));
  await new Promise(resolve=>setTimeout(resolve,1000));
  const before=await page.screenshot();await new Promise(resolve=>setTimeout(resolve,800));const after=await page.screenshot();
  check('offline populated park keeps animating',!before.equals(after));
  await page.screenshot({path:`${out}/blender-offline.png`});
  if (process.env.REVIEW_HATCHING === '1') {
    // Return to the menu so pagehide saves finish before preparing a ready egg.
    await page.goto('http://127.0.0.1:4175/dino-tycoon/',{waitUntil:'load'});
    await page.waitForSelector('[data-play="1"]',{visible:true});
    const beforeHatched=await page.evaluate(()=>{
      const key='dino-tycoon:slot:1',rec=JSON.parse(localStorage.getItem(key));
      rec.state.eggs=[{id:rec.state.nextId++,species:'tyrannosaurus',x:4,y:4,laidHour:rec.state.hours-48}];
      rec.savedAt=Date.now()+1000;
      localStorage.setItem(key,JSON.stringify(rec));return rec.state.stats.hatched;
    });
    await page.reload({waitUntil:'load'});
    await tap('[data-play="1"]');
    await page.waitForSelector('[data-hatch-egg]',{visible:true});
    for(let i=1;i<=2;i++) {
      await tap('[data-hatch-egg]');
      check(`offline production egg tap ${i} keeps the baby unhatched`,await page.evaluate(({i,beforeHatched})=>document.querySelector('[data-hatch-egg]').dataset.cracks===String(i)&&JSON.parse(localStorage.getItem('dino-tycoon:slot:1')).state.stats.hatched===beforeHatched,{i,beforeHatched}));
    }
    await tap('[data-hatch-egg]');
    check('offline production third tap saves exactly one matching baby',await page.evaluate(beforeHatched=>{
      const s=JSON.parse(localStorage.getItem('dino-tycoon:slot:1')).state;
      return s.stats.hatched===beforeHatched+1&&s.eggs.length===0&&s.dinos.at(-1).species==='tyrannosaurus'&&s.dinos.at(-1).baby&&document.querySelector('.hatch-stage canvas').dataset.species==='tyrannosaurus';
    },beforeHatched));
    await page.type('#hatch-name','Offline Pip');
    await tap('.hatch-name-form button');
    check('offline production baby naming persists',await page.evaluate(()=>JSON.parse(localStorage.getItem('dino-tycoon:slot:1')).state.dinos.at(-1).name==='Offline Pip'&&!document.querySelector('.hatch-dialog').open));
  }
  finish(errors);
} finally {if(browser){let timer;await Promise.race([browser.close(),new Promise(resolve=>{timer=setTimeout(()=>{browser.disconnect();browser.process()?.kill('SIGKILL');resolve();},10000);})]);clearTimeout(timer);}await new Promise(resolve=>server.close(resolve));}
process.exit(process.exitCode??0);
