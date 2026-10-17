import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { check, finish, gameUrl } from './lib.mjs';
const out='docs/dinosaur-audio';await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=user-gesture-required']});
const errors=[];
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1180,height:820});
 await page.goto(gameUrl('/'),{waitUntil:'networkidle0'});
 const result=await page.evaluate(async()=>{
  const {synthesizeCall}=await import('/src/audio/callSynthesis.ts');
  const {SPECIES}=await import('/src/sim/data/species.ts');
  const clips=[];
  for(const id of ['tyrannosaurus','parasaurolophus','triceratops','ankylosaurus','velociraptor','microraptor','pteranodon','mosasaurus'])for(const baby of id==='tyrannosaurus'||id==='velociraptor'?[false,true]:[false]){
   const samples=synthesizeCall(id,baby,22050);clips.push({id,baby,name:SPECIES[id].name,samples:Array.from(samples)});
  }
  return clips;
 });
 const links=[];
 for(const c of result){
  const n=c.samples.length, b=Buffer.alloc(44+n*2);
  b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(22050,24);b.writeUInt32LE(44100,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
  c.samples.forEach((v,i)=>b.writeInt16LE(Math.round(v*32767),44+i*2));
  const filename=`${c.id}${c.baby?'-baby':''}.wav`;await writeFile(`${out}/${filename}`,b);
  links.push(`<article><h2>${c.name}${c.baby?' · baby':''}</h2><audio controls preload="none" src="${filename}"></audio></article>`);
 }
 await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dinosaur voice previews</title><style>body{max-width:760px;margin:36px auto;padding:20px;background:#f4f0dc;color:#24352a;font:18px system-ui}article{padding:12px;border-bottom:1px solid #b9c4ad}h2{font-size:20px}audio{width:100%}</style><h1>Dinosaur voice previews</h1><p>Original, playful animal-inspired sound design, with brighter growls and chirps for small speakers. These are artistic interpretations, not reconstructions of real dinosaur voices.</p>${links.join('')}<p><a href="../dinosaur-audio.md">Research and design notes</a></p></html>`);
 // Capture actual game playback, not just the pure renderer.
 await page.evaluate(()=>{const connect=AudioBufferSourceNode.prototype.connect;window.__voiceLevels=[];AudioBufferSourceNode.prototype.connect=function(destination,...args){if(this.buffer&&this.buffer.duration>.1&&!this.loop&&destination.gain)window.__voiceLevels.push(destination.gain.value);return connect.call(this,destination,...args);};const original=AudioBufferSourceNode.prototype.start;window.__voiceBuffers=[];AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer&&this.buffer.duration>.1&&!this.loop)window.__voiceBuffers.push(this.buffer.duration);return original.apply(this,args);};});
 await (await page.$('[data-go="settings"]')).click();
 const playback=await page.evaluate(async()=>{
  const loaded=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name ?? path;
  const {playCall,audioDebug}=await import(loaded('/src/audio/audio.ts'));const {updateSettings}=await import(loaded('/src/ui/settings.ts'));
  updateSettings({music:false,sfx:true});window.__voiceBuffers=[];
  playCall('parasaurolophus');const count=window.__voiceBuffers.length;
  await new Promise(r=>setTimeout(r,400));playCall('tyrannosaurus',true);
  const played=window.__voiceBuffers.slice();await new Promise(r=>setTimeout(r,400));
  updateSettings({sfx:false});playCall('velociraptor');
  return {levels:window.__voiceLevels.slice(),count,played,mutedCount:window.__voiceBuffers.length,debug:audioDebug()};
 });
 check('adult and baby game calls create audible buffers',playback.count===1&&playback.played.length===2&&playback.played[0]>playback.played[1],playback);
 check('calls use the louder voice mix',playback.levels.length===2&&playback.levels.every(v=>Math.abs(v-.85)<.001),playback.levels);
 check('gesture unlocks a running audio context with audible SFX volume',playback.debug.state==='running'&&playback.debug.sfx>0,playback.debug);
 check('sound-effects toggle suppresses new calls',playback.mutedCount===2,playback);
 await page.evaluate(async()=>{const entry=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/ui/settings.ts');const {updateSettings}=await import(entry?.name??'/src/ui/settings.ts');updateSettings({sfx:true});});
 await page.click('[data-go="main"]');
 await page.evaluate(()=>{const t=document.querySelector('.menu-parade-track'),b=t.querySelector('[data-species="triceratops"]');t.style.animation='none';t.style.transform=`translateX(${20-b.offsetLeft}px)`;});
 await page.click('.menu-parade-group:first-child [data-species="triceratops"]');
 await new Promise(r=>setTimeout(r,400));
 await page.click('.menu-parade-group:first-child [data-species="triceratops"]');
 const menu=await page.evaluate(()=>window.__voiceBuffers.length);
 check('title greetings and snacks both use species voices',menu===4,menu);
 check('ten playable WAV previews generated',result.length===10);
 await writeFile(`${out}/results.json`,JSON.stringify({playback,menu,errors},null,2)+'\n');finish(errors);
}finally{await browser.close();}
