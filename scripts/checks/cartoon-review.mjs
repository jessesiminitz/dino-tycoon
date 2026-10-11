import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ready, check, finish } from './lib.mjs';
const out = fileURLToPath(new URL('../../docs/cartoon-review/', import.meta.url));
mkdirSync(out, { recursive: true });
const errors = [], base = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const exhaustive = !process.argv.includes('--smoke');
const browser = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({width:1180,height:820});
  await page.goto(`${base}/scripts/art/cartoon.html`, {waitUntil:'networkidle0'});
  await page.waitForSelector('#dinosaurs canvas');
  await page.click('#pause');
  await page.screenshot({path:`${out}gallery.png`,fullPage:true});
  const asset = await page.$('[data-asset="tyrannosaurus"]');
  await asset.screenshot({path:`${out}trex.png`});
  const icons = await page.evaluate(async () => {
    const {paintIcon}=await import('/src/render/iconArt.ts');
    return {'apple-touch-icon.png':paintIcon(180).toDataURL(),'icon-192.png':paintIcon(192).toDataURL(),'icon-512.png':paintIcon(512).toDataURL(),'icon-maskable-512.png':paintIcon(512,.1).toDataURL()};
  });
  for(const [name,url] of Object.entries(icons))writeFileSync(fileURLToPath(new URL(`../../public/icons/${name}`,import.meta.url)),Buffer.from(url.split(',')[1],'base64'));
  check('all 69 cartoon asset types appear in gallery', await page.$$eval('article', a=>a.length) === 69);
  await page.goto(`${base}/?quickstart&stress`, {waitUntil:'load'}); await ready(page);
  const result = await page.evaluate(async exhaustive => {
    const {sim,game} = window.__dino, park = game.scene.getScene('park');
    sim.setSpeed(0);
    const {SPECIES,SPECIES_IDS}=await import('/src/sim/data/species.ts');
    const {motionTexture}=await import('/src/render/parkMotion.ts');
    const {paintCartoonAsset,CARTOON_GEOMETRY}=await import('/src/render/cartoonArt.ts');
    const {dinoWorldScale}=await import('/src/render/dinoSize.ts');
    const failures=[];let tested=0,pixels=0;
    for(const id of (exhaustive ? SPECIES_IDS : ['tyrannosaurus','triceratops']))for(const baby of [false,true]){
      const texture=game.textures.get(motionTexture(park,id,baby));
      const source=texture.getSourceImage();pixels+=source.width*source.height;
      for(const clip of ['walk','idle','eat','rest'])for(let i=0;i<8;i++){
        const frame=texture.get(`${clip}-${i}`), expected=paintCartoonAsset(id,i,SPECIES[id],baby,dinoWorldScale(id),clip);
        if(frame.cutWidth!==expected.width||frame.cutHeight!==expected.height||frame.customData.renderResolution!==2)failures.push(`${id}:${baby}:${clip}:${i} frame contract`);
        const ctx=expected.getContext('2d'), image=ctx.getImageData(0,0,expected.width,expected.height).data;
        let opaque=0,soft=0;for(let p=3;p<image.length;p+=4){if(image[p]>0)opaque++;if(image[p]>0&&image[p]<255)soft++;}
        if(!opaque||!soft||image[3]!==0)failures.push(`${id}:${baby}:${clip}:${i} transparency/antialias`);
        tested++;
      }
    }
    // Display a readable mixed enclosure including the approved subject.
    const ids=['tyrannosaurus','triceratops','stegosaurus','brachiosaurus','parasaurolophus','compsognathus'];
    sim.state.dinos.slice(0,6).forEach((d,i)=>{d.species=ids[i];d.x=d.px=5+(i%3)*5;d.y=d.py=5+Math.floor(i/3)*4;});
    park.entities.update(performance.now());
    const rex=park.entities.dinoSprite(sim.state.dinos[0].id);
    if(rex.scaleX!==.5||rex.displayWidth>200||rex.displayHeight>120)failures.push('rex world size');
    const picked=park.entities.dinoAt(rex.x,rex.y-5);
    if(!picked)failures.push('dinosaur selection');
    park.cameras.main.setZoom(3);park.cameras.main.centerOn(10*16,8*16);
    return {tested,atlasMB:pixels*4/1024/1024,geometryAssets:Object.keys(CARTOON_GEOMETRY).length,failures};
  },exhaustive);
  check(`${result.tested} adult/baby animation frames are smooth and transparent`,result.failures.length===0,result);
  for(const [name,width,height] of [['desktop',1180,820],['phone',390,844],['tablet',820,1180]]){
    await page.setViewport({width,height});await new Promise(r=>setTimeout(r,300));
    await page.evaluate(()=>{const cam=window.__dino.game.scene.getScene('park').cameras.main;cam.setZoom(innerWidth<500?2:3);cam.centerOn(9*16,8*16);});
    await page.screenshot({path:`${out}park-${name}.png`});
    check(`${name} controls remain visible`,await page.$eval('.toolbar', e=>{const b=e.getBoundingClientRect();return b.top<innerHeight&&b.bottom<=innerHeight+1;}));
    const hud = await page.evaluate(()=>{
      const {sim}=window.__dino;sim.state.money=12345678;
      const groups=[...document.querySelectorAll('#hud .hud-group')].map(g=>g.getBoundingClientRect());
      const left=document.querySelector('#hud .hud-group');
      return {overlap:groups[0].right>groups[1].left+1&&groups[0].bottom>groups[1].top+1,clipped:left.scrollWidth>left.clientWidth+1,width:left.clientWidth,scroll:left.scrollWidth,classes:document.getElementById('hud').className,text:left.innerText};
    });
    check(`${name} HUD groups do not overlap`,!hud.overlap&&!hud.clipped,hud);
  }
  const behavior=await page.evaluate(async()=>{
    const {sim,game}=window.__dino,entities=game.scene.getScene('park').entities;
    const rex=sim.state.dinos[0];sim.state.hours=4;sim.setSpeed(1);rex.x=rex.px;rex.y=rex.py;
    entities.meals.set(rex.id,entities.animalTime);entities.update(performance.now());
    const eating=entities.dinoSprite(rex.id).frame.name.startsWith('eat-');
    const before=entities.dinoSprite(rex.id).frame.name;const time=entities.animalTime;
    sim.setSpeed(0);entities.update(performance.now()+1000);
    const pause=entities.dinoSprite(rex.id).frame.name===before&&entities.animalTime===time;
    sim.setSpeed(1);sim.state.hours=15;entities.update(performance.now()+1100);
    const rest=entities.dinoSprite(rex.id).frame.name.startsWith('rest-');
    const {saveSlot,loadSlot}=await import('/src/save/storage.ts');
    saveSlot(3,sim.state);const saved=await loadSlot(3);
    return {eating,pause,rest,saved:saved?.state.version===21&&saved.state.dinos[0].species==='tyrannosaurus'};
  });
  check('cartoon eating, nighttime rest, pause and v21 saves work',Object.values(behavior).every(Boolean),behavior);
  await page.setViewport({width:1180,height:820});
  await page.goto(`${base}/`,{waitUntil:'networkidle0'});
  await page.screenshot({path:`${out}menu.png`});
  writeFileSync(`${out}${exhaustive?'results':'smoke-results'}.json`,JSON.stringify({result,behavior,errors},null,2));
} finally { await browser.close(); }
finish(errors);
