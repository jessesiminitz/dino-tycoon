import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ready, check, finish } from './lib.mjs';
const out=fileURLToPath(new URL('../../docs/pixel-size-review/',import.meta.url));mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1180,height:820});
  await page.goto(`${process.env.BASE_URL??'http://127.0.0.1:5173'}/?art=blender&quickstart&stress`,{waitUntil:'load'});await ready(page);
  const result=await page.evaluate(async()=>{
    const {sim,game}=window.__dino,park=game.scene.getScene('park'),entities=park.entities;
    sim.setSpeed(0);game.loop.sleep();
    const {SPECIES,SPECIES_IDS}=await import('/src/sim/data/species.ts');
    const {dinoWorldScale}=await import('/src/render/dinoSize.ts');
    const {paintDino,dinoCanvasBounds}=await import('/src/render/dinoArt.ts');
    const {motionTexture}=await import('/src/render/parkMotion.ts');
    const failures=[];let frames=0;
    for(const id of SPECIES_IDS)for(const baby of [false,true]){
      const texture=game.textures.get(motionTexture(park,id,baby));
      const src=texture.getSourceImage(),ctx=src.getContext('2d');
      for(const clip of ['walk','idle','eat','rest'])for(let index=0;index<8;index++){
        const f=texture.get(`${clip}-${index}`),pixels=ctx.getImageData(f.cutX,f.cutY,f.cutWidth,f.cutHeight).data;
        let eyes=0,filled=0;for(let p=0;p<pixels.length;p+=4){if(pixels[p+3])filled++;if(pixels[p]===16&&pixels[p+1]===16&&pixels[p+2]===16&&pixels[p+3])eyes++;}
        if(!eyes||filled<3||f.customData.renderResolution!==1)failures.push(`${id}:${baby}:${clip}:${index} face/size`);
        frames++;
      }
    }
    const comp=sim.state.dinos[0];Object.assign(comp,{species:'compsognathus',baby:false,x:9,px:9,y:10,py:10});
    sim.state.dinos=[comp];
    entities.motions.delete(comp.id);entities.update(1000);
    const img=entities.dinoSprite(comp.id),hit=entities.dinoAt(img.x+8,img.y-2);
    if(hit?.id!==comp.id)failures.push('tiny Compsognathus expanded touch target');
    const sprite=paintDino(SPECIES.compsognathus,0,false,'blender',dinoWorldScale('compsognathus','blender'));
    const b=dinoCanvasBounds(sprite);
    // Render all species and the visitor at one shared 3x park zoom.
    const visitor=game.textures.get('visitor-0-0-a-n').getSourceImage();
    const widths={};
    game.destroy(true);document.body.innerHTML='';document.body.className='';
    document.documentElement.style.cssText='height:auto;overflow:auto';
    document.body.style.cssText='margin:0;padding:24px;background:#a5be71;color:#202519;font:16px system-ui;overflow:auto;height:auto';
    const title=document.createElement('h1');title.textContent='Pixel dinosaur sizes · shared 3× park zoom';document.body.append(title);
    for(const id of [...SPECIES_IDS].sort((a,b)=>SPECIES[a].lengthM-SPECIES[b].lengthM)){
      const canvas=paintDino(SPECIES[id],0,false,'blender',dinoWorldScale(id,'blender'));
      const bounds=dinoCanvasBounds(canvas);widths[id]=bounds.right-bounds.left;
      const row=document.createElement('div');row.dataset.species=id;row.style.cssText='display:flex;align-items:end;gap:24px;padding:12px 0;border-bottom:1px solid #66864b';
      const label=document.createElement('div');label.style.cssText='width:220px;flex-shrink:0';label.textContent=`${SPECIES[id].name} · ${SPECIES[id].lengthM} m`;
      const person=document.createElement('img');person.src=visitor.toDataURL();person.style.cssText=`width:${visitor.width*3}px;height:${visitor.height*3}px;image-rendering:pixelated`;
      const picture=document.createElement('img');picture.src=canvas.toDataURL();picture.style.cssText=`width:${canvas.width*3}px;height:${canvas.height*3}px;image-rendering:pixelated`;
      row.append(label,person,picture);document.body.append(row);
    }
    return {frames,compWidth:b.right-b.left,compHeight:b.bottom-b.top,widths,failures};
  });
  check('all 1,792 pixel animation frames retain visible faces',result.failures.length===0,result);
  check('Compsognathus is a tiny animal beside visitors',result.compWidth<=9&&result.compHeight<=6,result);
  await page.screenshot({path:`${out}lineup.png`,fullPage:true});
  await (await page.$('[data-species="compsognathus"]')).screenshot({path:`${out}compsognathus.png`});
  writeFileSync(`${out}results.json`,JSON.stringify({result,errors},null,2));
} finally {await browser.close();}
finish(errors);
