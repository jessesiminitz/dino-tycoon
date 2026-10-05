// Integration assertions for the complete Blender art set, without altering personal saves.
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, finish, ready } from './lib.mjs';
const out = fileURLToPath(new URL('../../docs/art-review/', import.meta.url));
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errors = [];
const url = process.env.BASE_URL ?? 'http://localhost:5173';
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${url}/?quickstart&stress&art=blender`, { waitUntil: 'load' });
  await ready(page);
  const shared = await page.evaluate(async () => {
    const { sim, game } = window.__dino;
    sim.setSpeed(0);
    const { paintDino, dinoShape } = await import('/src/render/dinoArt.ts');
    const { SPECIES } = await import('/src/sim/data/species.ts');
    const failures=[];
    for (const id of Object.keys(SPECIES)) {
      const sp=SPECIES[id], expected=paintDino(sp).toDataURL();
      const card=[...document.querySelectorAll('#catalog .species-card')].find((c) => c.querySelector('h3').textContent===sp.name);
      if (card.querySelector('img').src!==expected) failures.push(`${id} catalog mismatch`);
      if (document.querySelector(`#guide .guide-item[data-species="${id}"] img`).src!==expected) failures.push(`${id} guide mismatch`);
      const skin={...sp,art:{...sp.art,body:'#f040a0',dark:'#541c69',accent:'#f7d45c'}};
      if (paintDino(skin).toDataURL()===expected) failures.push(`${id} palette override ignored`);
      for (let f=0;f<4;f++) for (const baby of [false,true]) {
        const tex=game.textures.get(`dino-${id}-${f}${baby ? '-baby' : ''}`).getSourceImage();
        if (tex.toDataURL()!==paintDino(sp,f,baby).toDataURL()) failures.push(`${id}:${f}:${baby} texture mismatch`);
        const shape=dinoShape(sp,f,baby);
        if (tex.width!==shape[0].length+2 || tex.height!==shape.length+2) failures.push(`${id} canvas anchor changed`);
      }
    }
    const {BUILDING_TYPES}=await import('/src/sim/data/economy.ts');
    const {paintBuilding}=await import('/src/render/sceneryArt.ts');
    for (const kind of Object.keys(BUILDING_TYPES)) {
      const tex=game.textures.get(`building-${kind}`).getSourceImage();
      if(tex.toDataURL()!==paintBuilding(kind).toDataURL()) failures.push(`${kind} building texture mismatch`);
      const before=paintBuilding(kind, 'original'), after=paintBuilding(kind, 'blender');
      if(before.width!==after.width || before.height!==after.height) failures.push(`${kind} footprint changed`);
    }
    return failures;
  });
  check('catalog, guide, textures, fossil masks and palette overrides agree', shared.length===0, shared);

  const animation = await page.evaluate(async () => {
    const { sim,game }=window.__dino, scene=game.scene.getScene('park');
    const {SPECIES_IDS,habitatOf}=await import('/src/sim/data/species.ts');
    const fullSet=[];
    const sample=sim.state.dinos[0];
    sim.state.hours=4;sim.speed=1;
    for(const [i,species] of SPECIES_IDS.entries()) {
      const animal={...sample,species,id:98000+i,x:22,px:21,y:20,py:20,baby:false};
      sim.state.dinos.push(animal);
      for(const left of [false,true]) {
        animal.px=left ? animal.x+1 : animal.x-1;
        for(const pose of [0,1,2,3]) {
          Object.defineProperty(sim,'stepProgress',{configurable:true,get:()=>pose/4});
          const habitat=habitatOf(species), duration=habitat==='air'?120:225;
          scene.entities.animalTime=((pose-animal.id%4+4)%4)*duration;
          scene.entities.lastUpdateTime=1000;
          scene.entities.update(1000);
          const img=scene.entities.dinos.get(animal.id);
          if(img.texture.key!==`dino-${species}-${pose}` || img.flipX!==left) fullSet.push(`${species}:${pose}:${left}`);
        }
      }
    }
    delete sim.stepProgress;
    const d=sim.state.dinos.find((d)=>d.species==='triceratops');
    d.px=d.x-1;
    sim.speed=1;
    const frames=[];
    for(const progress of [0,.25,.5,.75]) {
      Object.defineProperty(sim,'stepProgress',{configurable:true,get:()=>progress});
      scene.entities.update(1000+progress*1000);
      frames.push(scene.entities.dinos.get(d.id).texture.key);
    }
    delete sim.stepProgress;
    const source=sim.state.dinos[0];
    for(const [species,id] of [['pteranodon',99001],['plesiosaurus',99002]]) {
      sim.state.dinos.push({...source,species,id,x:22,px:22,y:20,py:20,baby:false});
    }
    sim.setSpeed(0);
    scene.entities.update(2500);
    const snapshot=()=>[...scene.entities.dinos].map(([id,img])=>({id,key:img.texture.key,x:img.x,y:img.y,flip:img.flipX}));
    const first=snapshot(); scene.entities.update(9000); const second=snapshot();
    const swimmer=scene.entities.dinos.get(99002);
    const cropped=swimmer.isCropped && swimmer._crop.height===Math.round(swimmer.height*.62);
    sim.state.hours=15; // 23:00
    scene.entities.update(9500);
    const flyer=sim.state.dinos.find(d=>d.id===99001);
    const img=scene.entities.dinos.get(flyer.id), floor=scene.entities.dinoPosition(flyer).y;
    const sleeping=Math.abs(img.y-Math.round(floor))===0;
    const left=sim.state.dinos.find(d=>d.species==='triceratops');
    left.px=left.x+1; scene.entities.update(10000);
    const flip=scene.entities.dinos.get(left.id).flipX;
    return {fullSet,frames,frozen:JSON.stringify(first)===JSON.stringify(second),cropped,sleeping,flip};
  });
  check('every species selects all four poses in both directions',animation.fullSet.length===0,animation.fullSet);
  check('all four walk poses selected', animation.frames.join(',') === [0,1,2,3].map(f=>`dino-triceratops-${f}`).join(','), animation.frames);
  check('pause freezes land, swimming and flying motion', animation.frozen);
  check('waterline, sleeping flight and left facing preserved', animation.cropped && animation.sleeping && animation.flip, animation);

  for(const [width,height] of [[844,390],[667,375],[1180,820],[820,1180]]) {
    await page.setViewport({width,height,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await page.evaluate(() => {
      document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));
      document.getElementById('catalog').classList.remove('hidden');
    });
    const fits=await page.evaluate(() => {
      const card=document.querySelector('#catalog .modal-card').getBoundingClientRect();
      const imgs=[...document.querySelectorAll('#catalog .species-art')];
      return { fits:card.left>=-1 && card.right<=innerWidth+1 && card.bottom<=innerHeight+1,
        images:imgs.length===16 && imgs.every(img=>img.complete && img.naturalWidth>0)};
    });
    check(`catalog fits ${width}x${height} and all art loads`, fits.fits && fits.images, fits);
    await page.screenshot({path:`${out}catalog-blender-${width}.png`});
  }
  await page.setViewport({width:1000,height:650,deviceScaleFactor:1});
  await page.goto(`${url}/scripts/art/review.html`, {waitUntil:'networkidle0'});
  check('all 57 assets are available in the comparison', await page.$$eval('#asset option',options=>options.length===57));
  check('interactive comparison loads', await page.$eval('#blender',c=>c.width===68*4));
  await page.screenshot({path:`${out}comparison-rex.png`});
  await page.select('#asset','triceratops');
  await page.screenshot({path:`${out}comparison-triceratops.png`});
  await page.select('#asset','tower');
  check('tower comparison preserves dimensions',await page.$eval('#blender',c=>c.width===24*4 && c.height===42*4));
  await page.screenshot({path:`${out}comparison-tower.png`});
  await page.close();
  writeFileSync(`${out}integration.json`,JSON.stringify({shared,animation,errors},null,2)+'\n');
  finish(errors);
} finally { await browser.close(); }
