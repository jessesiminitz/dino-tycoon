import puppeteer from 'puppeteer-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {check,finish,gameUrl,ready, reach } from './lib.mjs';
const art=process.env.ART_STYLE??'blender',out=`docs/typography-review/${art}`;await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],results=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:667,height:375});await page.goto(gameUrl('/?quickstart'),{waitUntil:'load'});await ready(page);
 await page.evaluate(()=>window.__dino.sim.setSpeed(0));
 const close=()=>page.evaluate(()=>document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden')));
 const inspect=async(name,width)=>{
  const r=await page.evaluate(()=>{
   const modal=document.querySelector('.modal:not(.hidden)'),card=modal.querySelector('.modal-card'),rect=card.getBoundingClientRect();
   const style=e=>{const s=getComputedStyle(e);return {size:parseFloat(s.fontSize),family:s.fontFamily,adjust:s.fontSizeAdjust,line:s.lineHeight};};
   const visible=e=>e.getClientRects().length>0;
   const buttons=[...modal.querySelectorAll('button')].filter(visible).map(b=>({height:b.getBoundingClientRect().height,...style(b),icon:b.matches('.modal-close,.step-btn')}));
   return {base:style(modal),headings:[...modal.querySelectorAll('h2')].filter(visible).map(style),sections:[...modal.querySelectorAll('h3')].filter(visible).map(style),buttons,card:{top:rect.top,bottom:rect.bottom,width:rect.width},overflow:[...modal.querySelectorAll('.panel-body,.species-grid,.guide-detail')].filter(visible).map(e=>({class:e.className,extra:e.scrollWidth-e.clientWidth})),viewport:{width:innerWidth,height:innerHeight}};
  });
  const standard=r.base.size===13&&r.base.adjust==='none'&&r.base.family.includes('system-ui')&&r.headings.every(h=>h.size===16&&h.family===r.base.family)&&r.sections.every(h=>h.size===14&&h.family===r.base.family)&&r.buttons.every(b=>b.family===r.base.family&&b.adjust==='none'&&b.size===(b.icon?16:13)&&b.height>=43.9);
  check(`${width} ${name}: consistent compact type and tap targets`,standard,r);
  check(`${width} ${name}: panel fits screen without sideways content`,r.card.top>=0&&r.card.bottom<=r.viewport.height+1&&r.card.width<=r.viewport.width&&r.overflow.every(x=>x.extra<=1),r.card);
  results.push({width,name,...r});
  if(width!==844&&['overview','fences','guide','settings'].includes(name))await page.screenshot({path:`${out}/${name}-${width}.png`});
 };
 for(const [width,height] of [[667,375],[844,390],[1180,820]]){
  await page.setViewport({width,height});await close();
  await page.click('#btn-park');
  for(const tab of ['overview','staff','finances','bank']){await page.click(`#park [data-tab="${tab}"]`);await inspect(tab,width);}
  await close();
  for(const [button,name]of[['#btn-people','people'],['#btn-log','news'],['#btn-requests','requests'],['#btn-catalog','dinosaurs'],['#btn-book','guide']]){await (await reach(page,button)).click();await inspect(name,width);await close();}
  await (await reach(page,'[data-mode="fence"]')).click();await inspect('fences',width);await close();
  await page.click('#btn-menu');await inspect('pause',width);
  await page.click('[data-pause="settings"]');await inspect('settings',width);await close();
 }
 // Native hatching dialogs share the scale even though they are not .modal overlays.
 const hatch=await page.evaluate(()=>{
  const dialog=document.querySelector('.hatch-dialog');dialog.innerHTML='<h2>Baby dinosaur</h2><p>A new arrival!</p><input type="text"><button>Welcome</button>';dialog.showModal();
  const style=e=>{const s=getComputedStyle(e);return {size:s.fontSize,family:s.fontFamily,adjust:s.fontSizeAdjust};};
  return {body:style(dialog),heading:style(dialog.querySelector('h2')),input:style(dialog.querySelector('input')),button:style(dialog.querySelector('button'))};
 });
 check('native hatch dialog uses the shared scale and 16px input',hatch.body.size==='13px'&&hatch.body.adjust==='none'&&hatch.heading.size==='16px'&&hatch.input.size==='16px'&&hatch.button.size==='13px',hatch);
 await writeFile(`${out}/results.json`,JSON.stringify({results,hatch,errors},null,2)+'\n');finish(errors);
}finally{await browser.close();}
