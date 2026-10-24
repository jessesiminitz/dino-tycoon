import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, finish } from './lib.mjs';
const base=process.env.BASE_URL ?? 'http://localhost:5173',style=process.env.ART_STYLE ?? 'blender';
const out=fileURLToPath(new URL(`../../docs/menu-scale-review/${style}/`,import.meta.url));mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const errors=[];
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1180,height:820});await page.goto(`${base}/?art=${style}`,{waitUntil:'networkidle0'});
 const result=await page.evaluate(async()=>{
  const {paintMenuDino,menuDinoSize}=await import('/src/render/menuDino.ts');
  const {SPECIES_IDS,SPECIES}=await import('/src/sim/data/species.ts');
  const {dinoCanvasBounds,paintDinoRows}=await import('/src/render/dinoArt.ts');
  const {dinoWorldScale}=await import('/src/render/dinoSize.ts');const {BLENDER_MOTION}=await import('/src/render/generated/blenderMotion.ts');
  const {ART_STYLE}=await import('/src/render/artStyle.ts');
  const {handDrawnRex,paintMotionFrame}=await import('/src/render/parkMotion.ts');
  const failures=[],zooms=[],widths={};let count=0;
  for(const id of SPECIES_IDS){
   const size=menuDinoSize(paintMenuDino(id));const img=document.querySelector(`.menu-parade-group:first-child [data-species="${id}"] img`);
   zooms.push(img.getBoundingClientRect().width/size.width);
   for(const clip of ['walk','idle','eat','rest'])for(let f=0;f<8;f++){
    const c=paintMenuDino(id,clip,f),m=menuDinoSize(c);count++;
    if(m.width!==size.width||m.height!==size.height)failures.push(`${id}:${clip}:${f} canvas changed size`);
   }
   if(ART_STYLE==='blender'){
    // What the park shows: the Blender walk, or the hand-drawn T-rex.
    const menu=paintMenuDino(id),game=handDrawnRex(id)?paintMotionFrame(id,'walk',0,false):paintDinoRows(SPECIES[id],BLENDER_MOTION[id].walk.frames[0],false,dinoWorldScale(id));
    const m=dinoCanvasBounds(menu),g=dinoCanvasBounds(game);widths[id]=m.right-m.left;
    if(m.right-m.left!==g.right-g.left||m.bottom-m.top!==g.bottom-g.top)failures.push(id+' differs from game body size');
   }
  }
  return {count,failures,zoomSpread:Math.max(...zooms)-Math.min(...zooms),widths};
 });
 check('all 896 adult animation frames keep a fixed canvas and match game sizes',result.count===896&&!result.failures.length,result);
 check('one common zoom preserves species proportions',result.zoomSpread<.005,result.zoomSpread);
 writeFileSync(`${out}results.json`,JSON.stringify(result,null,2)+'\n');
 await page.screenshot({path:`${out}menu-desktop.png`});
 // A fixed-scale Nigersaurus contact sheet makes pose-size regressions visible.
 const sheet=await page.evaluate(async()=>{
  const {paintMenuDino,menuDinoSize}=await import('/src/render/menuDino.ts');
  const images=[];
  for(const clip of ['walk','idle','eat'])for(let f=0;f<8;f++){
   const c=paintMenuDino('nigersaurus',clip,f),size=menuDinoSize(c),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])opaque++;
   images.push({clip,frame:f,url:c.toDataURL(),width:size.width*2,height:size.height*2,opaque});
  }
  return images;
 });
 check('all 24 Nigersaurus review poses paint visible bodies',sheet.every(i=>i.opaque>50));
 await page.goto('about:blank');
 await page.setContent(`<html><body style="margin:0;padding:24px;background:#fff4d5;font:14px monospace"><div style="display:grid;grid-template-columns:repeat(4,max-content);gap:16px">${sheet.map(i=>`<div>${i.clip} ${i.frame}<img src="${i.url}" style="display:block;width:${i.width}px;height:${i.height}px;image-rendering:pixelated"></div>`).join('')}</div></body></html>`);
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
 await page.screenshot({path:`${out}nigersaurus.png`,fullPage:true});
}finally{await browser.close();}finish(errors);
