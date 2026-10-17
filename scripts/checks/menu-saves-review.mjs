import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { check, finish, gameUrl, ready } from './lib.mjs';
const out = `docs/menu-saves-review/${process.env.ART_STYLE ?? 'blender'}`;
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--autoplay-policy=user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], results = [];
try {
 for (const [width, height] of [[667,375],[844,390],[1180,820]]) {
  const context = await browser.createBrowserContext(), page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));await page.setViewport({width,height});
  await page.goto(gameUrl('/'), {waitUntil:'networkidle0'});
  await page.evaluate(async () => {
   const {newGame} = await import('/src/sim/GameState.ts');
   const {saveSlot,loadSlot} = await import('/src/save/storage.ts');
   for (const slot of [1,2,3]) {saveSlot(slot,newGame(slot));await loadSlot(slot);}
  });
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-play="3"]');
  const layout = await page.evaluate(() => {
   const content = document.querySelector('.menu-content'), menu = document.querySelector('.menu');
   return {height:content.clientHeight, menu:menu.clientHeight,scrollHeight:content.scrollHeight};
  });
  check(`${width}: full-height menu can scroll behind parade`,layout.height===layout.menu&&(height>480||layout.scrollHeight>layout.height),layout);
  await page.$eval('[data-go="settings"]', b=>b.scrollIntoView({block:'center'}));
  const accessible = await page.$eval('[data-go="settings"]', b=>{const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-go="settings"]')===b;});
  check(`${width}: Settings scrolls into a tappable position`,accessible);
  await page.screenshot({path:`${out}/menu-${width}.png`});
  await page.click('[data-go="settings"]');await page.waitForSelector('.settings');
  await page.click('[data-go="main"]');await page.click('[data-go="load"]');
  check(`${width}: twelve park rows retain the first three`,await page.$$eval('.slots .slot',rows=>rows.length===12&&rows.slice(0,3).every(r=>!r.classList.contains('empty'))&&rows.slice(3).every(r=>r.classList.contains('empty'))));
  await page.click('[data-go="main"]');await page.click('[data-go="new"]');
  await page.click('[data-start-sandbox]');await ready(page);
  const newSlot=await page.evaluate(()=>window.__dino.slot);
  check(`${width}: new park uses slot four without replacing an old park`,newSlot===4,newSlot);
  // Exercise actual IndexedDB persistence beyond the original slots, then the real Load button.
  await page.evaluate(async()=>{
   const {saveSlot,loadSlot}=await import('/src/save/storage.ts');
   saveSlot(12,window.__dino.sim.state);await loadSlot(12);
  });
  await page.goto(gameUrl('/'),{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-go="load"]');
  await page.click('[data-go="load"]');
  await page.waitForSelector('[data-play="12"]');
  await page.$eval('[data-play="12"]',b=>b.scrollIntoView({block:'center'}));
  await page.click('[data-play="12"]');await ready(page);
  const highSlot=await page.evaluate(()=>window.__dino.slot);
  check(`${width}: saved park twelve loads through the menu`,highSlot===12,highSlot);
  results.push({width,height,layout,newSlot,highSlot});await context.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify({results,errors},null,2)+'\n');finish(errors);
} finally {await browser.close();}
