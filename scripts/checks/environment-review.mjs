// Environment galleries and integration checks in a disposable browser profile.
import puppeteer from 'puppeteer-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {check,finish,ready} from './lib.mjs';
const out=fileURLToPath(new URL('../../docs/art-review/',import.meta.url));
mkdirSync(out,{recursive:true});
const url=process.env.BASE_URL ?? 'http://localhost:5173';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[], results={};
try {
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true});
  await page.goto(`${url}/?quickstart&shape=river&seed=7`,{waitUntil:'load'});await ready(page);
  const integration=await page.evaluate(async()=>{
    const {sim,game}=window.__dino,scene=game.scene.getScene('park');sim.setSpeed(0);
    const art=await import('/src/render/sceneryArt.ts');
    const terrain=await import('/src/render/terrainArt.ts');
    const {TERRAIN_COUNT}=await import('/src/sim/terrain.ts');
    const failures=[];
    const texture=(key,expected)=>{
      const actual=game.textures.get(key).getSourceImage();
      if(actual.toDataURL()!==expected.toDataURL()) failures.push(`${key} texture mismatch`);
    };
    art.FOREST_TREES.forEach((paint,kind)=>{for(let v=0;v<3;v++) texture(`tree-${kind}-${v}`,paint(kind*31+v*7));});
    for(let v=0;v<3;v++) {texture(`palm-${v}`,art.paintPalm(v));texture(`bush-${v}`,art.paintBush(v));texture(`reeds-${v}`,art.paintReeds(v*7+1));}
    for(let v=0;v<6;v++) texture(`mountain-${v}`,art.paintMountain(v*13+3));
    texture('volcano',art.paintVolcano());
    const {ALL_DECOR_KINDS}=await import('/src/sim/data/decor.ts');
    for(const kind of ALL_DECOR_KINDS) texture(`decor-${kind}`,art.paintDecor(kind));
    const atlas=game.textures.get('terrain-tiles').getSourceImage();
    const c=document.createElement('canvas');c.width=16;c.height=16;const ctx=c.getContext('2d');
    for(let t=0;t<TERRAIN_COUNT;t++) for(let v=0;v<4;v++) {
      ctx.clearRect(0,0,16,16);ctx.drawImage(atlas,(t*4+v)*16,0,16,16,0,0,16,16);
      if(c.toDataURL()!==terrain.paintTerrainTile(t,v).toDataURL()) failures.push(`terrain ${t}:${v} atlas mismatch`);
      if(ctx.getImageData(0,0,16,16).data.some((value,i)=>i%4===3 && value!==255)) failures.push(`terrain ${t}:${v} transparent`);
    }
    const pair=[...scene.scenery.trees].find(([,img])=>img.texture.key.startsWith('tree-') && img.visible);
    if(!pair) failures.push('no tree fixture');
    else {
      const [tile,img]=pair,originalDinos=sim.state.dinos,source=originalDinos[0];
      const x=tile%sim.state.map.width,y=Math.floor(tile/sim.state.map.width);
      sim.state.dinos=[{...source,id:99991,x,px:x,y,py:y}];scene.scenery.update(1000);
      if(img.alpha!==.35) failures.push('tree does not fade in front of animal');
      sim.state.dinos=[];scene.scenery.update(1000);
      if(img.alpha!==1) failures.push('tree fade does not restore');
      sim.state.dinos=originalDinos;
      const before=sim.state.paths[tile];sim.state.paths[tile]=1;scene.scenery.refresh();
      if(img.visible) failures.push('built-over tree remains visible');
      sim.state.paths[tile]=before;scene.scenery.refresh();
      if(!img.visible) failures.push('tree not restored after clearing construction fixture');
    }
    return failures;
  });
  results.integration=integration;check('scenery, decor, terrain atlas, tree fading and construction hiding agree',integration.length===0,integration);
  await page.setViewport({width:1500,height:1000,deviceScaleFactor:1});
  for(const style of ['original','blender']) {
    const scenery=await page.evaluate(async style=>{
      const art=await import('/src/render/sceneryArt.ts');
      const {BLENDER_ENVIRONMENT}=await import('/src/render/generated/blenderEnvironment.ts');
      if(window.__dino?.game) window.__dino.game.destroy(true);
      document.body.innerHTML='';document.documentElement.style.cssText='height:auto;overflow:visible';
      document.body.style.cssText='height:auto;overflow:visible;padding:16px;background:#223f35;color:#f4ecd2;font:15px system-ui';
      const title=document.createElement('h1');title.textContent=`${style} environment · native / 4×`;document.body.append(title);
      const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px';document.body.append(grid);
      const scale=(source,n)=>{const c=document.createElement('canvas');c.width=source.width*n;c.height=source.height*n;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0,c.width,c.height);return c;};
      const failures=[];
      for(const [id,spec] of Object.entries(BLENDER_ENVIRONMENT)) {
        const box=document.createElement('article');box.style.cssText='background:#77a954;color:#183729;padding:12px;overflow:hidden';
        const label=document.createElement('h2');label.textContent=id;box.append(label);
        const src=art.paintEnvironment(id,0,style);box.append(src,scale(src,4));
        const variants=document.createElement('div');variants.style.cssText='display:flex;gap:8px;align-items:end;margin-top:12px';
        for(let v=0;v<spec.frames.length;v++) {
          const c=art.paintEnvironment(id,v,style),original=art.paintEnvironment(id,v,'original');variants.append(c);
          if(c.width!==original.width||c.height!==original.height) failures.push(`${id}:${v} footprint`);
        }
        box.append(variants);grid.append(box);
      }
      return failures;
    },style);
    check(`${style} scenery preserves all registered footprints`,scenery.length===0,scenery);
    await page.screenshot({path:`${out}environment-${style}.png`,fullPage:true});
    const tiles=await page.evaluate(async style=>{
      const {paintTerrainTile,TERRAIN_ART_IDS}=await import('/src/render/terrainArt.ts');
      const {TERRAIN_NAMES}=await import('/src/sim/terrain.ts');
      document.body.innerHTML='';
      const title=document.createElement('h1');title.textContent=`${style} terrain · four variants / tiled at 4×`;document.body.append(title);
      const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:16px';document.body.append(grid);
      for(const id of Object.keys(TERRAIN_ART_IDS)) {
        const box=document.createElement('article');box.style.cssText='padding:12px;background:#36543d';
        const h=document.createElement('h2');h.textContent=TERRAIN_NAMES[id];box.append(h);
        for(let v=0;v<4;v++) box.append(paintTerrainTile(Number(id),v,style));
        box.append(document.createElement('br'));
        const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
        for(let y=0;y<4;y++)for(let x=0;x<4;x++)ctx.drawImage(paintTerrainTile(Number(id),(x+y*2)%4,style),x*64,y*64,64,64);
        box.append(c);grid.append(box);
      }
      return grid.childElementCount;
    },style);
    check(`${style} tile gallery covers all sixteen terrains`,tiles===16);
    await page.screenshot({path:`${out}terrain-${style}.png`,fullPage:true});
  }
  // Full-scene captures show shoreline, smoke and lighting with the authored art.
  await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true});
  for(const [shape,seed,label] of [['river',7,'river'],['fire',1000,'volcano'],['crescent',1000,'coast']]) {
    await page.goto(`${url}/?quickstart&shape=${shape}&seed=${seed}`,{waitUntil:'load'});await ready(page);
    await page.evaluate(()=>{const {sim,game}=window.__dino;sim.setSpeed(0);sim.state.parcelsOwned.fill(true);const cam=game.scene.getScene('park').cameras.main;
      const point=sim.state.map.volcano ?? {x:sim.state.map.width/2,y:sim.state.map.height/2};cam.setZoom(2);cam.centerOn(point.x*16,point.y*16);});
    await new Promise(r=>setTimeout(r,150));
    await page.screenshot({path:`${out}environment-park-${label}.png`});
  }
  writeFileSync(`${out}environment-integration.json`,JSON.stringify({...results,errors},null,2)+'\n');
  finish(errors);
} finally {await browser.close();}
