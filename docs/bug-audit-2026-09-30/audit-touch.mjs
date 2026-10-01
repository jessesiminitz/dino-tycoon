import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();await p.setViewport({width:844,height:390,isMobile:true,hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));const delay=ms=>new Promise(r=>setTimeout(r,ms));
const tap=async s=>{const e=await p.waitForSelector(s,{visible:true});await e.evaluate(el=>el.scrollIntoView({block:'center'}));await e.tap();await delay(250);};
const pick=async(mode,id)=>{await p.evaluate(()=>window.__dino.ui.setMode('select'));await tap('.tool-btn[data-mode="'+mode+'"]');await tap('.modal:not(.hidden) .shop-card[data-id="'+id+'"] button');};
const pos=(x,y)=>p.evaluate((x,y)=>{const c=window.__dino.game.scene.getScene('park').cameras.main;return {x:(x*16-c.scrollX-c.width/2)*c.zoom+c.width/2,y:(y*16-c.scrollY-c.height/2)*c.zoom+c.height/2};},x,y);
const tile=async(x,y)=>{const q=await pos(x+.5,y+.5);await p.touchscreen.tap(q.x,q.y);await delay(200);};
const drag=async(x,y,x2,y2)=>{const a=await pos(x,y),c=await pos(x2,y2);console.log('drag screen',a,c);await p.touchscreen.touchStart(a.x,a.y);await delay(80);for(let i=1;i<=12;i++){await p.touchscreen.touchMove(a.x+(c.x-a.x)*i/12,a.y+(c.y-a.y)*i/12);await delay(30);}await p.touchscreen.touchEnd();await delay(400);};
try{
 await p.goto('http://localhost:5174/?quickstart&seed=7');await p.waitForFunction(()=>window.__dino);await delay(800);
 const {ex,ey}=await p.evaluate(()=>{const {sim,game}=window.__dino;sim.setSpeed(0);const s=sim.state;s.money=1e6;s.parcelsOwned.fill(true);const {x:ex,y:ey}=s.entrance;for(let y=ey-16;y<ey;y++)for(let x=ex-12;x<ex+8;x++)s.map.tiles[y*s.map.width+x]=3;sim.worldRevision++;const c=game.scene.getScene('park').cameras.main;c.setZoom(1.5);c.centerOn((ex-3)*16,(ey-9)*16);return {ex,ey};});await delay(300);
 await pick('fence','4');await drag(ex-6,ey-12,ex,ey-7);
 console.log('touch enclosure=',await p.evaluate((x,y)=>{const r=window.__dino.sim.regions();return r.regions[r.tileRegion[y*window.__dino.sim.state.map.width+x]]?.kind;},ex-4,ey-10));
 await pick('path','path');await drag(ex-5.5,ey-10.5,ex-2.5,ey-10.5);
 console.log('touch path tiles before dino=',await p.evaluate(()=>window.__dino.sim.state.paths.filter(Boolean).length));
 await pick('feeder','plants');await tile(ex-5,ey-11);
 await p.evaluate(()=>window.__dino.ui.setMode('select'));await tap('#btn-catalog');await tap('#catalog .species-card:not(:has(button:disabled)) .action-btn');await tile(ex-3,ey-9);
 console.log('touch bought dinosaur=',await p.evaluate(()=>({dinos:window.__dino.sim.state.dinos.length,feeders:window.__dino.sim.state.feeders.length,paths:window.__dino.sim.state.paths.filter(Boolean).length})));
 await pick('decor','pond');await drag(ex+1.5,ey-10.5,ex+3.5,ey-10.5);
 console.log('touch pond=',await p.evaluate(()=>window.__dino.sim.state.map.tiles.filter(t=>t===8).length));
 await pick('path','path');await drag(ex+1.5,ey-7.5,ex+3.5,ey-7.5);
 const before=await p.evaluate(()=>window.__dino.sim.state.paths.filter(Boolean).length);
 await tap('.tool-btn[data-mode="demolish"]');await drag(ex+1.5,ey-7.5,ex+3.5,ey-7.5);
 console.log('touch path remove=',before,await p.evaluate(()=>window.__dino.sim.state.paths.filter(Boolean).length));
 await p.screenshot({path:'audit-results/touch-construction.png'});console.log('errors=',errors);
}finally{await b.close();}
