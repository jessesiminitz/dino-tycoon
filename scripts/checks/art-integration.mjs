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
    const {dinoWorldScale}=await import('/src/render/dinoSize.ts');
    const { SPECIES } = await import('/src/sim/data/species.ts');
    const { handDrawnRex } = await import('/src/render/parkMotion.ts');
    const failures=[];
    for (const id of Object.keys(SPECIES)) {
      // The hand-drawn T-rex has its own palette and canvas (fun-moves-check.mjs covers it).
      const rex=handDrawnRex(id,'blender');
      const sp=SPECIES[id], expected=paintDino(sp).toDataURL();
      const card=[...document.querySelectorAll('#catalog .species-card')].find((c) => c.querySelector('h3').textContent===sp.name);
      if (card.querySelector('img').src!==expected) failures.push(`${id} catalog mismatch`);
      if (document.querySelector(`#guide .guide-item[data-species="${id}"] img`).src!==expected) failures.push(`${id} guide mismatch`);
      const skin={...sp,art:{...sp.art,body:'#f040a0',dark:'#541c69',accent:'#f7d45c'}};
      if (!rex && paintDino(skin).toDataURL()===expected) failures.push(`${id} palette override ignored`);
      for (let f=0;f<4;f++) for (const baby of [false,true]) {
        const tex=game.textures.get(`dino-${id}-${f}${baby ? '-baby' : ''}`).getSourceImage();
        if (tex.toDataURL()!==paintDino(sp,f,baby,'blender',dinoWorldScale(id, 'blender')).toDataURL()) failures.push(`${id}:${f}:${baby} texture mismatch`);
        const shape=dinoShape(sp,f,baby,'blender',dinoWorldScale(id, 'blender'));
        if (!rex && (tex.width!==shape[0].length+2 || tex.height!==shape.length+2)) failures.push(`${id} canvas anchor changed`);
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

  // Exhaustive atlas/behavior coverage lives in park-immersion.mjs.
  const animation = await page.evaluate(async () => {
    const {sim,game}=window.__dino,scene=game.scene.getScene('park');
    const {SPECIES_IDS}=await import('/src/sim/data/species.ts');
    const {BLENDER_MOTION}=await import('/src/render/generated/blenderMotion.ts');
    const {walkCycle}=await import('/src/render/parkMotion.ts');
    const failures=[],saved=sim.state.dinos;sim.state.hours=4;sim.speed=1;
    for(const [i,species] of SPECIES_IDS.entries())for(const left of [false,true]){
      const d={...saved[0],species,id:98000+i,x:22,px:left?23:21,y:20,py:20,baby:false,hunger:0};
      sim.state.dinos=[d];scene.entities.motions.delete(d.id);
      const cycle=walkCycle(species,false,'blender');
      for(let pose=0;pose<8;pose++){
        Object.defineProperty(sim,'stepProgress',{configurable:true,get:()=>pose*cycle/128});
        scene.entities.update(1000);const img=scene.entities.dinos.get(d.id);
        if(img.texture.key!==`motion-${species}`||img.frame.name!==`walk-${pose}`||img.flipX!==left)failures.push(`${species}:${pose}:${left}`);
      }
    }
    delete sim.stepProgress;sim.state.dinos=saved;sim.setSpeed(0);scene.entities.update(2500);
    const snapshot=()=>JSON.stringify([...scene.entities.dinos].map(([id,img])=>[id,img.texture.key,img.frame.name,img.x,img.y,img.flipX]));
    const before=snapshot();scene.entities.update(9000);
    return {failures,frozen:before===snapshot()};
  });
  check('every species selects all eight walk phases in both directions',animation.failures.length===0,animation.failures);
  check('pause freezes animal poses and positions',animation.frozen);

  const tailShadows = await page.evaluate(async () => {
    const {sim,game}=window.__dino,entities=game.scene.getScene('park').entities;
    const saved=sim.state.dinos,failures=[];
    const {dinoWorldScale}=await import('/src/render/dinoSize.ts');
    const graphics=entities.shadows,fillEllipse=graphics.fillEllipse;
    const widths={"compsognathus":28,"velociraptor":36,"dilophosaurus":44,"allosaurus":56,"tyrannosaurus":66,"pachycephalosaurus":36,"parasaurolophus":50,"protoceratops":34,"triceratops":60,"stegosaurus":58,"ankylosaurus":54,"brachiosaurus":66,"spinosaurus":76,"therizinosaurus":56,"amargasaurus":70,"kentrosaurus":52,"styracosaurus":60,"carnotaurus":62,"yutyrannus":64,"iguanodon":60,"microraptor":34,"diplodocus":100,"argentinosaurus":104,"nigersaurus":64};
    let calls=[];
    graphics.fillEllipse=function(...args){calls.push(args);return fillEllipse.apply(this,args);};
    try {
      for(const [species,width] of Object.entries(widths)) for(const baby of [false,true]) {
        const d={...saved[0],id:99101,species,baby,x:22,px:22,y:20,py:20,path:[],hunger:0};
        sim.state.dinos=[d];entities.motions.delete(d.id);calls=[];entities.update(3000);
        const scale=(baby?.6:1)*dinoWorldScale(species,'blender'),expected=Math.max(6,(Math.ceil((width+16)*scale)+2-16*scale)*.7);
        const actual=calls.at(-1)?.[2];
        // Baby resampling can round the wider canvas by one native pixel.
        if(actual===undefined||Math.abs(actual-expected)>.71)failures.push(`${species}:${baby} shadow ${actual}/${expected}`);
      }
    } finally {graphics.fillEllipse=fillEllipse;sim.state.dinos=saved;entities.update(3001);}
    return failures;
  });
  check('long-tail canvas room preserves adult and baby ground shadow sizes',tailShadows.length===0,tailShadows);

  for(const [width,height] of [[844,390],[667,375],[1180,820],[820,1180]]) {
    await page.setViewport({width,height,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await page.evaluate(() => {
      document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));
      document.getElementById('btn-catalog').click();
    });
    await new Promise(r=>setTimeout(r,400));
    const fits=await page.evaluate(() => {
      const card=document.querySelector('#catalog .modal-card').getBoundingClientRect();
      const imgs=[...document.querySelectorAll('#catalog .species-art')];
      const speciesCount=document.querySelectorAll('#guide .guide-item[data-species]').length;
      return { fits:card.left>=-1 && card.right<=innerWidth+1 && card.bottom<=innerHeight+1,
        images:imgs.length===speciesCount && imgs.every(img=>img.complete && img.naturalWidth>0)};
    });
    check(`catalog fits ${width}x${height} and all art loads`, fits.fits && fits.images, fits);
    await page.screenshot({path:`${out}catalog-blender-${width}.png`});
  }
  await page.setViewport({width:1000,height:650,deviceScaleFactor:1});
  await page.goto(`${url}/scripts/art/review.html`, {waitUntil:'networkidle0'});
  const expectedAssets=await page.evaluate(async()=>{const {SPECIES_IDS}=await import('/src/sim/data/species.ts');const {BUILDING_TYPES}=await import('/src/sim/data/economy.ts');const {BLENDER_ENVIRONMENT,BLENDER_TERRAIN}=await import('/src/render/generated/blenderEnvironment.ts');return SPECIES_IDS.length+Object.keys(BUILDING_TYPES).length+Object.keys(BLENDER_ENVIRONMENT).length+Object.keys(BLENDER_TERRAIN).length;});
  check('all registered assets are available in the comparison', await page.$$eval('#asset option',options=>options.length)===expectedAssets);
  await page.screenshot({path:`${out}comparison-rex.png`});
  await page.select('#asset','triceratops');
  // The T-rex shown first is hand-drawn now; the Triceratops is still straight from Blender.
  check('interactive comparison loads', await page.evaluate(async()=>{
    const {BLENDER_ART}=await import('/src/render/generated/blenderArt.ts');
    return document.getElementById('blender').width===(BLENDER_ART.triceratops.width+2)*4;
  }));
  await page.screenshot({path:`${out}comparison-triceratops.png`});
  await page.select('#asset','tower');
  check('tower comparison preserves dimensions',await page.$eval('#blender',c=>c.width===24*4 && c.height===42*4));
  await page.screenshot({path:`${out}comparison-tower.png`});
  const additions=await page.evaluate(async()=>{
    const {EXPANSION_SPECIES_IDS,SPECIES}=await import('/src/sim/data/species.ts');
    const {paintDino}=await import('/src/render/dinoArt.ts');
    const select=document.getElementById('asset'), pose=document.getElementById('pose'), baby=document.getElementById('baby'), left=document.getElementById('left');
    const failures=[];
    for(const id of EXPANSION_SPECIES_IDS) {
      const card=document.querySelector(`.dino-card[data-species="${id}"]`);
      card.click();
      if(select.value!==id || new URL(location.href).searchParams.get('asset')!==id || card.getAttribute('aria-pressed')!=='true') failures.push(`${id} selection`);
      if(!document.getElementById('original-panel').hidden) failures.push(`${id} misleading original comparison`);
      for(const isBaby of [false,true]) for(const facingLeft of [false,true]) for(const frame of [0,1,2,3]) {
        baby.checked=isBaby; left.checked=facingLeft; pose.value=String(frame); pose.dispatchEvent(new Event('input'));
        const source=paintDino(SPECIES[id],frame,isBaby,'blender');
        const expected=document.createElement('canvas'); expected.width=source.width*4;expected.height=source.height*4;
        const ctx=expected.getContext('2d');ctx.imageSmoothingEnabled=false;
        if(facingLeft) {ctx.translate(expected.width,0);ctx.scale(-1,1);}
        ctx.drawImage(source,0,0,expected.width,expected.height);
        if(document.getElementById('blender').toDataURL()!==expected.toDataURL()) failures.push(`${id}:${frame}:${isBaby}:${facingLeft} review pixels`);
      }
    }
    baby.checked=false;left.checked=false;pose.value='0';select.value='spinosaurus';select.dispatchEvent(new Event('input'));
    return {count:document.querySelectorAll('#new-gallery .dino-card').length,failures};
  });
  check('new dinosaur gallery selects all twelve and paints every pose, baby and facing correctly',additions.count===12 && additions.failures.length===0,additions);
  await page.setViewport({width:1200,height:900,deviceScaleFactor:1});
  await page.$eval('#new-dinosaurs',el=>el.scrollIntoView());
  await (await page.$('#new-dinosaurs')).screenshot({path:`${out}new-dinosaurs-gallery.png`});
  await page.goto(`${url}/scripts/art/review.html?asset=argentinosaurus`,{waitUntil:'networkidle0'});
  await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  check('largest new dinosaur stays accessible at 4x on a phone',await page.evaluate(()=>{
    const stage=document.getElementById('blender').parentElement;
    return document.documentElement.scrollWidth<=innerWidth+1 && stage.scrollWidth>=document.getElementById('blender').width && stage.scrollHeight>=document.getElementById('blender').height;
  }));
  await page.screenshot({path:`${out}new-dinosaurs-phone.png`,fullPage:true});
  await page.$eval('#asset',el=>{el.value='spinosaurus';el.dispatchEvent(new Event('input'));});
  await page.$eval('#animate',el=>{el.checked=true;el.dispatchEvent(new Event('input'));});
  await page.waitForFunction(()=>document.getElementById('pose').value!=='0');
  check('new dinosaur review animation advances',await page.$eval('#pose',el=>Number(el.value)>0));
  await page.close();
  writeFileSync(`${out}integration.json`,JSON.stringify({shared,animation,errors},null,2)+'\n');
  finish(errors);
} finally { await browser.close(); }
