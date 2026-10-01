import puppeteer from 'puppeteer-core';
import {writeFileSync,mkdirSync} from 'node:fs';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const tap=async s=>{await (await page.$(s)).tap();await delay(200);};
const fresh=async()=>{await page.goto('http://localhost:5174/?quickstart');await page.waitForFunction(()=>window.__dino);await delay(700);await page.evaluate(()=>window.__dino.sim.setSpeed(0));};
try{
 await fresh();
 await tap('#btn-menu');await tap('[data-pause="resume"]');console.log('B08 paused before opening menu; speed after Resume=',await page.evaluate(()=>window.__dino.sim.speed));
 await page.evaluate(()=>{const {sim}=window.__dino;sim.setSpeed(0);sim.state.pendingChoice={eventId:'fundraiser',amount:1000,createdHour:sim.state.hours,expiresHour:sim.state.hours+4};sim.setSpeed(0);});
 await tap('.choice-later');console.log('B09 paused before decision; speed after Decide later=',await page.evaluate(()=>window.__dino.sim.speed));
 // Reopen pending choice, deliberately trigger a milestone in the same simulated hour to test stacked pauses.
 await fresh();
 const stacked=await page.evaluate(async()=>{const {sim}=window.__dino;const {showOutcome}=await import('/src/ui/overlays.ts');sim.setSpeed(3);sim.state.pendingChoice={eventId:'fundraiser',amount:1000,createdHour:0,expiresHour:4};sim.setSpeed(3);showOutcome(sim,'lost',()=>{},'audit');return {speed:sim.speed,choice:!document.querySelector('#choice').classList.contains('hidden'),outcome:!document.querySelector('#outcome').classList.contains('hidden')};});
 console.log('stacked modal setup',stacked);
 await tap('[data-outcome="keep"]');console.log('B10 choice still open after outcome dismissed=',await page.evaluate(()=>({speed:window.__dino.sim.speed,choice:!document.querySelector('#choice').classList.contains('hidden')})));
 await fresh();
 console.log('storage roundtrips=',await page.evaluate(async()=>{const st=await import('/src/save/storage.ts');const s=window.__dino.sim.state;const r={};for(const slot of [1,2,3]){const clone=structuredClone(s);clone.money=12000+slot;st.saveSlot(slot,clone);const loaded=await st.loadSlot(slot);r[slot]={money:loaded.state.money,validImport:'state' in st.parseImport(JSON.stringify(loaded))};}await st.deleteSlot(3);r.deleted=(await st.loadSlot(3))===null;return r;}));
 // Verify pending decisions are restored on continue.
 await page.evaluate(async()=>{const st=await import('/src/save/storage.ts');const s=window.__dino.sim.state;s.pendingChoice={eventId:'fundraiser',amount:1000,createdHour:s.hours,expiresHour:s.hours+4};st.saveSlot(1,s);});
 await page.goto('http://localhost:5174/');await page.waitForSelector('[data-go="load"]');await tap('[data-go="load"]');await page.waitForSelector('[data-play="1"]');await tap('[data-play="1"]');await page.waitForFunction(()=>window.__dino);await delay(600);
 await delay(1500);console.log('loaded pending decision=',await page.evaluate(()=>({pending:window.__dino.sim.state.pendingChoice,choiceVisible:!document.querySelector('#choice').classList.contains('hidden'),buttonVisible:!document.querySelector('#choice-btn').classList.contains('hidden'),speed:window.__dino.sim.speed})));
 // Check genuine menu import with malformed current-version JSON.
 await page.goto('http://localhost:5174/');await page.waitForSelector('[data-go="load"]');await tap('[data-go="load"]');
 mkdirSync('audit-results',{recursive:true});writeFileSync('audit-results/incomplete-save.json','{"version":21}');
 await (await page.$('[data-import]')).uploadFile('audit-results/incomplete-save.json');await delay(300);if(await page.$('[data-use]'))await tap('[data-use]');await delay(800);
 console.log('B01 actual malformed import=',await page.evaluate(()=>({menuHidden:document.querySelector('#menu').classList.contains('hidden'),error:document.querySelector('.import-error')?.textContent,body:document.body.className})));
 await page.screenshot({path:'audit-results/incomplete-import.png'});
 console.log('page errors=',errors);
}finally{await browser.close();}
