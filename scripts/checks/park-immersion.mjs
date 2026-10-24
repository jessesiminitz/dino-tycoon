// Full-game motion review in a disposable Chrome profile; personal saves stay untouched.
import puppeteer from 'puppeteer-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {check,finish,ready} from './lib.mjs';
const out=fileURLToPath(new URL('../../docs/art-review/',import.meta.url));mkdirSync(out,{recursive:true});
const errors=[],url=process.env.BASE_URL??'http://localhost:5173';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1000,height:650,deviceScaleFactor:1});
  await page.goto(`${url}/?quickstart&stress`,{waitUntil:'load'});await ready(page);
  const result=await page.evaluate(async()=>{
    const {sim,game}=window.__dino,park=game.scene.getScene('park'),entities=park.entities;
    const {SPECIES_IDS,SPECIES,habitatOf}=await import('/src/sim/data/species.ts');
    const {BLENDER_MOTION}=await import('/src/render/generated/blenderMotion.ts');
    const {motionTexture,paintMotionFrame,walkCycle,MOTION_CLIPS}=await import('/src/render/parkMotion.ts');
    const {motionWalkSpeed}=await import('/src/render/immersionMotion.ts');
    const {dinoWorldScale}=await import('/src/render/dinoSize.ts');
    game.loop.stop();const saved=sim.state.dinos,failures=[];let atlasFrames=0;
    sim.speed=1;sim.state.hours=4;
    // all nine clips, from the game's own painter (the pixel park's T-rex is hand-drawn)
    const clips=MOTION_CLIPS;
    for(const species of SPECIES_IDS)for(const baby of [false,true]){
      const key=motionTexture(park,species,baby),texture=game.textures.get(key);
      for(const clip of clips)for(let frame=0;frame<8;frame++){
        const expected=paintMotionFrame(species,clip,frame,baby,'blender');
        const canvas=document.createElement('canvas');canvas.width=expected.width;canvas.height=expected.height;
        const ctx=canvas.getContext('2d'),f=texture.get(`${clip}-${frame}`);
        ctx.drawImage(texture.getSourceImage(),f.cutX,f.cutY,f.cutWidth,f.cutHeight,0,0,canvas.width,canvas.height);
        if(canvas.toDataURL()!==expected.toDataURL())failures.push(`${species}:${baby}:${clip}:${frame} atlas`);
        atlasFrames++;
      }
    }
    let tested=0;
    for(const [i,species] of SPECIES_IDS.entries())for(const left of [false,true])for(const baby of [false,true]){
      const d={...saved[0],id:90000+i,species,baby,x:22,px:left?23:21,y:20,py:20,path:[],hunger:0};
      sim.state.dinos=[d];entities.motions.delete(d.id);
      const cycle=walkCycle(species,baby,'blender');
      for(let frame=0;frame<8;frame++){
        Object.defineProperty(sim,'stepProgress',{configurable:true,get:()=>frame*cycle/128});
        entities.update(1000);const img=entities.dinos.get(d.id);
        if(img.frame.name!==`walk-${frame}`||img.flipX!==left)failures.push(`${species}:${left}:${baby}:${frame} runtime ${img.frame.name}`);
        tested++;
      }
      delete sim.stepProgress;
    }
    const feeder=sim.state.feeders.find(f=>f.kind==='plants');
    const d={...saved[0],id:99000,species:'triceratops',x:feeder.x,px:feeder.x,y:feeder.y,py:feeder.y,hunger:90,path:[],baby:false};
    sim.state.dinos=[d];sim.step();entities.update(2000);
    const meal=entities.motions.get(d.id).clip==='eat'&&d.hunger<50;
    entities.update(2250);entities.update(2500);const chewing=entities.motions.get(d.id).frame>0;
    entities.update(2750);const idle=entities.motions.get(d.id).clip==='idle';
    sim.state.hours=15;entities.update(3000);const sleep=entities.motions.get(d.id).clip==='rest';
    const snapshot=()=>JSON.stringify({clock:entities.animalTime,dinos:[...entities.dinos.values()].map(img=>[img.x,img.y,img.texture.key,img.frame.name,img.flipX]),wind:[...park.scenery.trees.values()].map(img=>[img.texture.key,img.frame.name])});
    sim.speed=0;entities.update(3100);park.scenery.update(park.worldTime);const before=snapshot();
    entities.update(9000);park.scenery.update(park.worldTime);const frozen=before===snapshot();
    sim.state.dinos=saved;sim.state.hours=4;sim.speed=1;game.loop.start(game.step.bind(game));
    return {failures,atlasFrames,tested,meal,chewing,idle,sleep,frozen};
  });
  check('all 4,480 adult/baby atlas frames match the park painter',result.atlasFrames===4480&&result.failures.length===0,result.failures.slice(0,12));
  check('all eight runtime walk phases work for 28 species, babies and both directions',result.tested===896&&result.failures.length===0);
  check('actual feeder consumption triggers chewing and returns to idle',result.meal&&result.chewing&&result.idle,result);
  check('night selects rest and pause freezes poses, positions and wind',result.sleep&&result.frozen);
  const wind=await page.evaluate(async()=>{
    const {game}=window.__dino,scene=game.scene.getScene('park');
    const {swayTexture}=await import('/src/render/plantMotion.ts');
    const key='tree-1-0',source=game.textures.get(key).getSourceImage(),texture=game.textures.get(swayTexture(scene,key));
    const rows=[];
    for(let frame=0;frame<7;frame++){
      const c=document.createElement('canvas');c.width=source.width;c.height=4;
      const f=texture.get(frame);c.getContext('2d').drawImage(texture.getSourceImage(),f.cutX+3,source.height-4,source.width,4,0,0,source.width,4);
      rows.push(c.toDataURL());
    }
    return new Set(rows).size===1;
  });check('seven cached wind poses keep the plant roots fixed',wind);
  const metrics=[];
  // Fresh parks ensure the measurement isn't inflated by the exhaustive texture review.
  for(const animation of [false,true]){
    await page.goto(`${url}/?quickstart&stress`,{waitUntil:'load'});await ready(page);
    await page.evaluate(async enabled=>{
      const {updateSettings}=await import('/src/ui/settings.ts');updateSettings({animation:enabled});
      const {sim,game}=window.__dino;sim.state.hours=10;sim.setSpeed(1);
      game.scene.getScene('park').cameras.main.centerOn(390,340);
    },animation);
    await new Promise(r=>setTimeout(r,1000));
    const measured=await page.evaluate(async()=>{
      const {sim,game}=window.__dino,park=game.scene.getScene('park'),samples=[],cost=[];let previous;
      const original=park.entities.update.bind(park.entities);
      park.entities.update=time=>{const start=performance.now();original(time);cost.push(performance.now()-start);};
      const count=()=>Object.keys(game.textures.list).length,before=count();
      await new Promise(resolve=>{const tick=time=>{if(previous!==undefined)samples.push(time-previous);previous=time;if(samples.length<120)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
      park.entities.update=original;samples.sort((a,b)=>a-b);cost.sort((a,b)=>a-b);
      return {p95FrameMs:samples[Math.floor(samples.length*.95)],p95EntityMs:cost[Math.floor(cost.length*.95)],texturesBefore:before,texturesAfter:count(),dinos:sim.state.dinos.length,visitors:sim.state.visitors.length};
    });metrics.push({animation,...measured});check(`bounded texture cache with world animation ${animation?'on':'off'}`,measured.texturesAfter===measured.texturesBefore,measured);
  }
  for(const [width,height] of [[390,844],[844,390],[667,375],[820,1180]]){
    await page.setViewport({width,height,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await page.screenshot({path:`${out}park-immersion-${width}.png`});
    check(`game fits ${width}×${height}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.goto(`${url}/scripts/art/review.html`,{waitUntil:'networkidle0'});
  const gallery=await page.evaluate(async()=>{
    const {SPECIES_IDS,SPECIES}=await import('/src/sim/data/species.ts');
    const {BLENDER_MOTION}=await import('/src/render/generated/blenderMotion.ts');
    const {paintDinoRows}=await import('/src/render/dinoArt.ts');
    const failures=[];
    for(const species of SPECIES_IDS)for(const clip of ['walk','idle','eat','rest'])for(const baby of [false,true])for(const left of [false,true])for(let frame=0;frame<8;frame++){
      for(const [id,value] of Object.entries({asset:species,clip,pose:String(frame)}))document.getElementById(id).value=value;
      document.getElementById('baby').checked=baby;document.getElementById('left').checked=left;document.getElementById('pose').dispatchEvent(new Event('input'));
      const source=paintDinoRows(SPECIES[species],BLENDER_MOTION[species][clip].frames[frame],baby),actual=document.getElementById('blender');
      const expected=document.createElement('canvas');expected.width=source.width*4;expected.height=source.height*4;
      const ctx=expected.getContext('2d');ctx.imageSmoothingEnabled=false;if(left){ctx.translate(expected.width,0);ctx.scale(-1,1);}ctx.drawImage(source,0,0,expected.width,expected.height);
      if(expected.toDataURL()!==actual.toDataURL())failures.push(`${species}:${clip}:${baby}:${left}:${frame}`);
    }
    return {failures,cards:document.querySelectorAll('#motion-gallery .motion-card').length};
  });check('all 3,584 review combinations match, with 28 gallery cards',gallery.cards===28&&gallery.failures.length===0,gallery.failures.slice(0,8));
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  check('full motion gallery fits a portrait phone',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${out}full-motion-review-phone.png`});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluate(()=>localStorage.removeItem('dino-tycoon:settings'));
  await page.goto(`${url}/?quickstart`,{waitUntil:'load'});await ready(page);
  check('reduced-motion preference disables ambient animation by default',await page.evaluate(async()=>!(await import('/src/ui/settings.ts')).getSettings().animation));
  writeFileSync(`${out}park-immersion-check.json`,JSON.stringify({result,metrics,gallery},null,2)+'\n');finish(errors);
}catch(error){console.error(error);process.exitCode=1;}finally{
  let timer;await Promise.race([browser.close(),new Promise(resolve=>{timer=setTimeout(()=>{browser.disconnect();browser.process()?.kill('SIGKILL');resolve();},10000);})]);clearTimeout(timer);
}
process.exit(process.exitCode??0);
