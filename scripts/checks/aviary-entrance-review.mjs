import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { check, finish, gameUrl, ready } from './lib.mjs';
const style=process.env.ART_STYLE ?? 'blender', out=`docs/aviary-entrance-review/${style}`;
await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],results=[];
try {
 for(const [width,height] of (process.env.REVIEW_SMOKE ? [[844,390]] : [[1180,820],[844,390],[667,375]])) {
  const page=await browser.newPage(); page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width,height,deviceScaleFactor:1,isMobile:width<900,hasTouch:width<900});
  await page.goto(gameUrl(`/?quickstart&seed=4242&art=${style}`),{waitUntil:'load'});await ready(page);
  // Quickstart skips menu gestures: unlock audio through Pause before canvas taps.
  await (await page.$('[data-speed="0"]')).tap();
  await new Promise(r=>setTimeout(r,500));
  const result=await page.evaluate(async()=>{
   const {ParkBuilder}=await import('/src/sim/parkBuilder.ts');
   const {paintDino,dinoCanvasBounds,dinoShape,dinoFrameCount}=await import('/src/render/dinoArt.ts');
   const {dinoWorldScale}=await import('/src/render/dinoSize.ts');
   const {SPECIES}=await import('/src/sim/data/species.ts');
   const {ART_STYLE}=await import('/src/render/artStyle.ts');
   const {sim,game}=window.__dino;sim.setSpeed(0);
   const b=new ParkBuilder(sim.state); b.prepare(-9,-16,9,-1);
   b.path([0,-1],[0,-15]);b.paddock(-8,-14,-1,-6,5);
   b.paddock(2,-13,8,-7,2); b.dino('triceratops',4,-10);
   for(const [species,x,y] of [['pteranodon',-5,-10],['dimorphodon',-3,-8]]) {
    b.state.unlockedSpecies.push(species);b.dino(species,x,y);
   }
   b.feeder('fish',-5,-12); b.finish(50000,75);sim.worldRevision++;
   const failures=[],sizes={};
   for(const species of ['pteranodon','dimorphodon']) {
    // Independent baseline measures the opaque source body before the boost.
    let sourceWidth=1;
    for(let f=0;f<dinoFrameCount(species,ART_STYLE);f++) {
     const rows=dinoShape(SPECIES[species],f,false,ART_STYLE);let l=rows[0].length,r=0;
     for(const row of rows)for(let x=0;x<row.length;x++)if(row[x]){l=Math.min(l,x);r=Math.max(r,x);}
     sourceWidth=Math.max(sourceWidth,r-l+1);
    }
    const target=ART_STYLE==='blender'?Math.max(5,6*SPECIES[species].lengthM):Math.max(18,Math.min(200,14*SPECIES[species].lengthM**.8));
    const baseline=Math.min(ART_STYLE==='blender'?2.5:1.15,target/sourceWidth);
    const scale=dinoWorldScale(species);
    if(Math.abs(scale/baseline-1.5)>.001)failures.push(species+' scale');
    const c=paintDino(SPECIES[species],0,false,ART_STYLE,scale),bounds=dinoCanvasBounds(c);
    sizes[species]={scale,baseline,width:bounds.right-bounds.left};
   }
   return {failures,sizes,covered:sim.regions().regions.filter(r=>r.covered).length};
  });
  check(`one aviary roof, steel paddock uncovered ${width}`,result.covered===1,result);
  check(`both flyers 50% larger ${width}`,!result.failures.length,result.sizes);
  await page.evaluate(()=>{const {sim,game}=window.__dino;const sc=game.scene.getScene('park');sc.cameras.main.setZoom(3);sc.cameras.main.centerOn((sim.state.entrance.x-4)*16,(sim.state.entrance.y-11)*16);});
  await new Promise(r=>setTimeout(r,1400));
  await page.screenshot({path:`${out}/aviary-${width}.png`});
  const roofs=await page.evaluate(()=>{const sc=window.__dino.game.scene.getScene('park');return sc.layers.roofs.commandBuffer.length;});
  check(`curved mesh drawn ${width}`,roofs>100,roofs);
  if(width<900) {
   await page.evaluate(()=>{const sc=window.__dino.game.scene.getScene('park');window.__tapTrace=[];sc.input.on('pointerup',p=>window.__tapTrace.push({type:'up',dt:p.upTime-sc.touch.downAt,x:p.x,y:p.y,moved:sc.touch.moved}));for(const type of ['tap','longpress'])sc.touch.on(type,(x,y)=>window.__tapTrace.push({type,x,y,hit:sc.entities.dinoAt(x,y)?.id}));});
   for(const species of ['pteranodon','dimorphodon']) {
    await page.evaluate(species=>{const {sim,game}=window.__dino;const sc=game.scene.getScene('park');const d=sim.state.dinos.find(d=>d.species===species),img=sc.entities.dinoSprite(d.id);const p=img.getCenter();sc.cameras.main.centerOn(p.x,p.y);},species);
    await new Promise(r=>setTimeout(r,150));
    const p=await page.evaluate(species=>{const {sim,game}=window.__dino;const sc=game.scene.getScene('park');const d=sim.state.dinos.find(d=>d.species===species),img=sc.entities.dinoSprite(d.id),p=img.getCenter(),c=sc.cameras.main;return {x:(p.x-c.worldView.x)*c.zoom,y:(p.y-c.worldView.y)*c.zoom,id:d.id,hit:sc.entities.dinoAt(p.x,p.y)?.id,target:document.elementFromPoint((p.x-c.worldView.x)*c.zoom,(p.y-c.worldView.y)*c.zoom)?.outerHTML.slice(0,160)};},species);
    const traceStart=await page.evaluate(()=>window.__tapTrace.length);
    await page.touchscreen.touchStart(p.x,p.y);
    await new Promise(r=>setTimeout(r,species==='pteranodon'?350:100));
    await page.touchscreen.touchEnd();
    await new Promise(r=>setTimeout(r,150));
    const selection=await page.evaluate(()=>window.__dino.game.scene.getScene('park').entities.selection);
    check(`larger ${species} remains tappable ${width}`,selection?.id===p.id,{p,selection,trace:await page.evaluate(()=>window.__tapTrace)});
    const delivered=await page.evaluate(start=>window.__tapTrace.slice(start).filter(e=>e.type==='tap'||e.type==='longpress').length,traceStart);
    check(`stationary ${species} press delivered once ${width}`,delivered===1,delivered);
   }
   await page.evaluate(()=>{const sc=window.__dino.game.scene.getScene('park');sc.entities.selection=null;sc.hud.showInfo(null);});
   const before=await page.evaluate(()=>window.__dino.game.scene.getScene('park').cameras.main.scrollX);
   await page.touchscreen.touchStart(width/2,180);
   await new Promise(r=>setTimeout(r,100));
   await page.touchscreen.touchMove(width/2+60,180);
   await new Promise(r=>setTimeout(r,100));
   await page.touchscreen.touchEnd();
   await new Promise(r=>setTimeout(r,200));
   const dragged=await page.evaluate(()=>{const sc=window.__dino.game.scene.getScene('park');return {scroll:sc.cameras.main.scrollX,selected:sc.entities.selection};});
   check(`drag pans without selecting ${width}`,Math.abs(dragged.scroll-before)>5&&dragged.selected===null,dragged);
  }
  // Removing a net segment must remove the roof and restoring it restores the dome.
  const lifecycle=await page.evaluate(()=>{const {sim,game}=window.__dino;const x=sim.state.entrance.x-8,y=sim.state.entrance.y-14;const edges=[{dir:'h',x,y}];sim.dispatch({type:'removeFences',edges});const sc=game.scene.getScene('park');sc.redrawWorld();const open=sc.layers.roofs.commandBuffer.length;sim.dispatch({type:'buildFences',edges,fence:5});sc.redrawWorld();return {open,closed:sc.layers.roofs.commandBuffer.length};});
  check(`roof follows broken/restored enclosure ${width}`,lifecycle.open===0&&lifecycle.closed>100,lifecycle);
  await page.evaluate(()=>{const {sim,game}=window.__dino;const sc=game.scene.getScene('park');sc.cameras.main.setZoom(3);sc.cameras.main.centerOn((sim.state.entrance.x+.5)*16,(sim.state.entrance.y-2)*16);});
  await new Promise(r=>setTimeout(r,300));await page.screenshot({path:`${out}/entrance-${width}.png`});
  const entrance=await page.evaluate(()=>{const sc=window.__dino.game.scene.getScene('park');const gate=sc.layers.gate;return {width:gate.displayWidth,height:gate.displayHeight,visible:gate.visible};});
  check(`larger entrance landmark ${width}`,entrance.visible&&entrance.width===96&&entrance.height===64,entrance);
  results.push({width,height,result,lifecycle,entrance});await page.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify({results,errors},null,2)+'\n');finish(errors);
}finally{await browser.close();}
