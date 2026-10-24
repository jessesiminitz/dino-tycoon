import { BLENDER_MOTION } from './generated/blenderMotion';
import { paintDinoRows } from './dinoArt';
import { paintEnvironment, paintBuilding } from './sceneryArt';
import { paintTerrainTile } from './terrainArt';
import { Terrain } from '../sim/terrain';
import { SPECIES } from '../sim/data/species';
import { PROTOTYPE_SPECIES, motionFrame, motionWalkSpeed, type MotionSpecies, type MotionClip } from './immersionMotion';

const input = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const world = input<HTMLCanvasElement>('world'), ctx = world.getContext('2d')!;
const pause = input<HTMLButtonElement>('pause');
const behavior = input<HTMLSelectElement>('behavior'), atmosphere = input<HTMLSelectElement>('atmosphere');
const clipSelect = input<HTMLSelectElement>('clip'), speed = input<HTMLSelectElement>('speed');
const wind = input<HTMLInputElement>('wind'), footsteps = input<HTMLInputElement>('footsteps');
const baby = input<HTMLInputElement>('baby'), left = input<HTMLInputElement>('left'), frameInput = input<HTMLInputElement>('frame');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reducedMotion.matches, clock = 0, lastTime = 0, lastDraw = 0, manualFrame = 0;
const sprites = new Map<string,HTMLCanvasElement>();
// the prototype shows the four behaviour clips; the playful ones live in the park
for (const id of PROTOTYPE_SPECIES) for (const clip of ['walk', 'idle', 'eat', 'rest'] as MotionClip[]) {
  for (const small of [false,true]) BLENDER_MOTION[id][clip].frames.forEach((rows,frame) => {
    sprites.set(`${id}:${clip}:${frame}:${small}`,paintDinoRows(SPECIES[id],rows,small));
  });
}
const sprite = (id: MotionSpecies, clip: MotionClip, frame: number, small = false) => sprites.get(`${id}:${clip}:${frame}:${small}`)!;
const previews = PROTOTYPE_SPECIES.map(id => {
  const card = document.createElement('article'); card.className = 'card'; card.dataset.species = id;
  const title = document.createElement('h2'); title.textContent = SPECIES[id].name;
  const description = document.createElement('p'); description.textContent = ({carnotaurus:'A curious head tilt and a weighty stride.',diplodocus:'A long neck reaching for a leafy meal.',yutyrannus:'Feathers, tail movement and a gentle resting pose.'} as Record<string,string>)[id];
  const stage = document.createElement('div'); stage.className = 'clip-stage';
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label',`${SPECIES[id].name} animation preview`); stage.append(canvas);
  const detail = document.createElement('output'); card.append(title,description,stage,detail); input('clips').append(card);
  return {id,canvas,detail,lastKey:''};
});

type Actor = { id:MotionSpecies; x:number; y:number; min:number; max:number; facing:number; clip:MotionClip; elapsed:number; frame:number; previous:number; wait:number };
const actors: Actor[] = [
  {id:'carnotaurus',x:260,y:205,min:210,max:410,facing:1,clip:'walk',elapsed:0,frame:0,previous:-1,wait:0},
  {id:'diplodocus',x:340,y:306,min:280,max:470,facing:1,clip:'idle',elapsed:0,frame:0,previous:-1,wait:2600},
  {id:'yutyrannus',x:285,y:404,min:205,max:430,facing:1,clip:'idle',elapsed:0,frame:0,previous:-1,wait:5200},
];
type Particle = {x:number;y:number;born:number;wet:boolean};
const particles:Particle[] = [];
let footfallCount = 0;
const tree = paintEnvironment('broadleaf',0,'blender'), palm = paintEnvironment('palm',1,'blender');
const reeds = paintEnvironment('reeds',0,'blender'), bush = paintEnvironment('bush',0,'blender');
const giant = paintEnvironment('giant',0,'blender'), cycad = paintEnvironment('cycad',1,'blender');
function silhouette(source:HTMLCanvasElement,color:string) {
  const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
  const c=canvas.getContext('2d')!;c.drawImage(source,0,0);c.globalCompositeOperation='source-in';c.fillStyle=color;c.fillRect(0,0,canvas.width,canvas.height);return canvas;
}
const distant=silhouette(giant,'#658b7b'), forest=silhouette(giant,'#335e55');
const plantCache=new Map<HTMLCanvasElement,HTMLCanvasElement[]>();
for(const source of [tree,palm,reeds,bush,cycad]) {
  plantCache.set(source,Array.from({length:7},(_,index)=>{
    const canvas=document.createElement('canvas');canvas.width=source.width*2+6;canvas.height=source.height*2;
    const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;
    for(let row=0;row<source.height;row++) {
      const bend=Math.round((index-3)*((source.height-row)/source.height)**2);
      c.drawImage(source,0,row,source.width,1,3+bend,row*2,source.width*2,2);
    }
    return canvas;
  }));
}
const skyCache=new Map<string,HTMLCanvasElement>(),lightCache=new Map<string,HTMLCanvasElement>();
const tower = paintBuilding('tower','blender');
const grass = Array.from({length:4},(_,i)=>paintTerrainTile(Terrain.Grass,i,'blender'));
const sand = paintTerrainTile(Terrain.Sand,0,'blender');
const pond = paintTerrainTile(Terrain.Pond,0,'blender');
const backdrop = document.createElement('canvas'); backdrop.width=768;backdrop.height=480;
const ground = backdrop.getContext('2d')!; ground.imageSmoothingEnabled=false;
for (let y=0;y<480;y+=32) for (let x=0;x<768;x+=32) {
  const tile = y>=432 ? sand : grass[(x/32+y/32*3)%4]; ground.drawImage(tile,x,y,32,32);
}
// Pond along the edge of the enclosure; explicit wet footfall zones stay on land.
const shoreline=[[95,244],[135,244],[151,260],[167,276],[167,324],[151,340],[135,356],[87,356],[71,340],[71,276],[79,260]];
ground.save();ground.beginPath();shoreline.forEach(([x,y],i)=>i?ground.lineTo(x,y):ground.moveTo(x,y));ground.closePath();ground.clip();
for(let y=244;y<360;y+=16) for(let x=64;x<176;x+=16) ground.drawImage(pond,x,y,16,16);
ground.restore();ground.strokeStyle='#b4b981';ground.lineWidth=2;ground.stroke();
ground.fillStyle='#487244';
for(let i=0;i<80;i++)ground.fillRect(72+(i*67)%618,128+(i*47)%293,2,1);

function image(source:HTMLCanvasElement,x:number,y:number,scale=2,flip=false) {
  ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);
  ctx.drawImage(source,Math.round(-source.width*scale/2),-source.height*scale,source.width*scale,source.height*scale);ctx.restore();
}
function plant(source:HTMLCanvasElement,x:number,y:number,phase:number) {
  // Bend upper scanlines, keeping roots and trunks fixed on the ground.
  const breeze = wind.checked ? Math.sin(clock/1700+phase)*1.5+Math.sin(clock/3300)*1 : 0;
  const sx = Math.round(x-source.width), sy = y-source.height*2;
  ctx.drawImage(plantCache.get(source)![Math.round(breeze)+3],sx-3,sy);
}
function fence(y:number) {
  ctx.fillStyle='#d5ad6c';ctx.fillRect(64,y-15,640,3);ctx.fillStyle='#806640';ctx.fillRect(64,y-5,640,3);
  for(let x=64;x<=704;x+=32){ctx.fillStyle='#4c4930';ctx.fillRect(x,y-21,5,24);ctx.fillStyle='#b6955d';ctx.fillRect(x,y-21,3,21);}
}
function feeder(actor:Actor) {
  const x=actor.max+(actor.id==='diplodocus'?79:43), y=actor.y-(actor.id==='diplodocus'?9:23);
  ctx.fillStyle='#4f4534';ctx.fillRect(x-12,y,25,5);ctx.fillRect(x-10,y+5,3,actor.y-y-5);ctx.fillRect(x+7,y+5,3,actor.y-y-5);
  ctx.fillStyle='#bc9762';ctx.fillRect(x-13,y-2,26,3);ctx.fillStyle=actor.id==='diplodocus'?'#9abc64':'#d89b73';
  ctx.fillRect(x-9,y-5,18,3);if(actor.id==='diplodocus'){ctx.fillRect(x-6,y-9,3,6);ctx.fillRect(x+3,y-8,5,4);}
}
function changeClip(actor:Actor,clip:MotionClip,wait=0) {actor.clip=clip;actor.elapsed=0;actor.previous=-1;actor.wait=wait;}
function advance(actor:Actor,dt:number) {
  actor.elapsed+=dt;
  if(behavior.value!=='natural') {
    const selected=behavior.value as MotionClip;
    if(actor.clip!==selected)changeClip(actor,selected);
    if(actor.clip==='eat'){actor.x=actor.max;actor.facing=1;}
  } else if(actor.clip!=='walk' && actor.elapsed>=actor.wait) {
    if(actor.clip==='idle' && actor.x===actor.max)changeClip(actor,'eat',6000);
    else if(actor.clip==='eat')changeClip(actor,'rest',4800);
    else {actor.facing=actor.x>=actor.max?-1:1;changeClip(actor,'walk');}
  }
  if(actor.clip==='walk') {
    actor.x+=motionWalkSpeed(actor.id)*2*dt/1000*actor.facing;
    if(actor.x>actor.max||actor.x<actor.min) {
      actor.x=Math.max(actor.min,Math.min(actor.max,actor.x));
      if(behavior.value==='natural')changeClip(actor,'idle',BLENDER_MOTION[actor.id].idle.durationMs*2);
      else actor.facing*=-1;
    }
  }
  actor.frame=motionFrame(actor.id,actor.clip,actor.elapsed);
  if(actor.clip==='walk' && actor.frame!==actor.previous && footsteps.checked) {
    const contacts=BLENDER_MOTION[actor.id].walk.contacts;
    for(const foot of contacts[actor.frame]) {
      const before=contacts[(actor.frame+7)%8].find(f=>f.name===foot.name);
      if(foot.planted && before && !before.planted) {
        const x=actor.x+(foot.x-(BLENDER_MOTION[actor.id].walk.width/2))*2*actor.facing;
        particles.push({x,y:actor.y-2,born:clock,wet:atmosphere.value==='rain'});footfallCount++;
      }
    }
  }
  actor.previous=actor.frame;
}

function drawWorld() {
  ctx.imageSmoothingEnabled=false;ctx.drawImage(backdrop,0,0);
  const rain=atmosphere.value==='rain', dark=atmosphere.value!=='day';
  // Background silhouettes and canopy frame the enclosure without obscuring it.
  let skyImage=skyCache.get(atmosphere.value);
  if(!skyImage){
  skyImage=document.createElement('canvas');skyImage.width=768;skyImage.height=126;
  const skyContext=skyImage.getContext('2d')!;skyContext.imageSmoothingEnabled=false;
  const sky=skyContext.createLinearGradient(0,0,0,112);
  sky.addColorStop(0,rain?'#304858':dark?'#405b72':'#88b8b6');sky.addColorStop(1,rain?'#7f9b95':dark?'#d7b384':'#d1d6a6');
  skyContext.fillStyle=sky;skyContext.fillRect(0,0,768,112);
  skyContext.fillStyle=dark?'#d5bc8c40':'#f0ead640';skyContext.fillRect(28,26,95,3);skyContext.fillRect(43,22,55,4);skyContext.fillRect(412,43,126,3);skyContext.fillRect(446,39,66,4);
  if(!rain){skyContext.fillStyle=dark?'#f0d49c':'#f6ebbb';skyContext.fillRect(518,30,16,16);skyContext.fillRect(515,33,22,10);}
  for(let i=0;i<19;i++){const scale=1+(i%2);skyContext.drawImage(distant,Math.round(i*47+10-distant.width*scale/2),106+(i%3)*4-distant.height*scale,distant.width*scale,distant.height*scale);}
  for(let i=0;i<13;i++)skyContext.drawImage(forest,i*64+24-forest.width,119+(i%3)*4-forest.height*2,forest.width*2,forest.height*2);
  skyCache.set(atmosphere.value,skyImage);
  }
  ctx.drawImage(skyImage,0,0);
  fence(126);
  plant(tree,108,160,.4);plant(tree,675,180,1.1);plant(palm,604,145,1.8);plant(bush,220,150,.7);plant(cycad,182,194,1.6);
  image(giant,29,280,3);image(giant,746,384,3);
  image(tower,647,250,2);
  ctx.save();ctx.globalAlpha=.3;ctx.strokeStyle='#c3ddcb';
  for(let i=0;i<6;i++){const x=82+i*12,y=270+(i%3)*25;ctx.beginPath();ctx.ellipse(x,y,4+Math.sin(clock/950+i)*2,1,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
  for(const actor of actors)feeder(actor);
  for(const actor of actors) {
    ctx.save();ctx.globalAlpha=.18;ctx.fillStyle='#152e22';ctx.beginPath();ctx.ellipse(actor.x,actor.y-2,actor.id==='diplodocus'?53:29,5,0,0,Math.PI*2);ctx.fill();ctx.restore();
    image(sprite(actor.id,actor.clip,actor.frame),actor.x,actor.y,2,actor.facing===-1);
  }
  for(let i=particles.length-1;i>=0;i--) {
    const p=particles[i],age=(clock-p.born)/650;
    if(age>1){particles.splice(i,1);continue;}
    if(!footsteps.checked)continue;
    ctx.save();ctx.globalAlpha=(1-age)*.55;ctx.strokeStyle='#c5e1db';ctx.fillStyle='#ddc693';
    if(p.wet){ctx.beginPath();ctx.ellipse(p.x,p.y,3+age*9,1+age*2,0,0,Math.PI*2);ctx.stroke();}
    else for(let j=0;j<3;j++)ctx.fillRect(Math.round(p.x+(j-1)*age*9),Math.round(p.y-age*8-j),2,2);
    ctx.restore();
  }
  plant(reeds,170,347,.7);plant(reeds,88,366,1.3);plant(bush,666,397,2.1);
  fence(430);
  for(let i=0;i<4;i++)plant(bush,124+i*175,451,i*.6);
  if(wind.checked) {
    ctx.fillStyle=dark?'#e2b678':'#ccd67d';
    for(let i=0;i<9;i++){const x=(clock/95+i*91)%768,y=140+(i*37)%250+Math.sin(clock/1200+i)*8;ctx.fillRect(Math.round(x),Math.round(y),2,1);}
  }
  // Warm pools sit above the evening tint; fine pixel highlights stay readable.
  let lightImage=lightCache.get(atmosphere.value);
  if(!lightImage){
  lightImage=document.createElement('canvas');lightImage.width=768;lightImage.height=480;
  const lighting=lightImage.getContext('2d')!;
  if(dark){lighting.fillStyle=rain?'#10213e90':'#192f526b';lighting.fillRect(0,112,768,368);}
  for(const [x,y] of [[68,430],[703,430],[647,185]]) {
    if(dark){const glow=lighting.createRadialGradient(x,y-12,0,x,y-12,90);glow.addColorStop(0,'#ffc56b88');glow.addColorStop(.4,'#ffc56b30');glow.addColorStop(1,'#ffc56b00');lighting.fillStyle=glow;lighting.fillRect(x-90,y-102,180,180);}
    lighting.fillStyle='#3f4632';lighting.fillRect(x-2,y-29,3,29);lighting.fillStyle=dark?'#ffdb8c':'#d6c599';lighting.fillRect(x-4,y-31,7,5);
  }
  lightCache.set(atmosphere.value,lightImage);
  }
  ctx.drawImage(lightImage,0,0);
  if(dark&&!rain){for(let i=0;i<8;i++){ctx.fillStyle=`rgba(243,222,132,${.25+.65*(1+Math.sin(clock/780+i*2))/2})`;ctx.fillRect(Math.round(130+i*74+Math.sin(clock/1100+i)*4),Math.round(415-(i%3)*21+Math.cos(clock/1300+i)*3),2,2);}}
  if(rain){ctx.strokeStyle='#bacfdf80';ctx.beginPath();for(let i=0;i<85;i++){const x=(i*137+clock*.035)%800-16,y=(i*79+clock*.21)%490;ctx.moveTo(Math.round(x),Math.round(y));ctx.lineTo(Math.round(x-3),Math.round(y+9));}ctx.stroke();}
  ctx.fillStyle='#f4e8bd';ctx.font='12px monospace';ctx.fillText('FERN VALLEY',80,113);
  const status=actors.map(a=>`${SPECIES[a.id].name}: ${a.clip==='idle'?'looking around':a.clip==='walk'?'walking':a.clip==='eat'?'eating':'resting'}`).join(' · ');
  if(input('world-status').textContent!==status)input('world-status').textContent=status;
}
function drawPreviews() {
  const clip=clipSelect.value as MotionClip;
  if(!paused)frameInput.value=String(motionFrame('carnotaurus',clip,clock));
  for(const preview of previews) {
    const frame=paused?manualFrame:motionFrame(preview.id,clip,clock);
    const key=`${clip}:${frame}:${baby.checked}:${left.checked}`;
    if(preview.lastKey===key)continue;preview.lastKey=key;
    const source=sprite(preview.id,clip,frame,baby.checked),canvas=preview.canvas;
    const w=source.width*2,h=source.height*2;
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const c=canvas.getContext('2d')!;c.clearRect(0,0,w,h);c.save();c.imageSmoothingEnabled=false;
    if(left.checked){c.translate(w,0);c.scale(-1,1);}c.drawImage(source,0,0,w,h);c.restore();
    preview.detail.textContent=`${clip} · frame ${frame+1}/8 · ${baby.checked?'baby':'adult'}`;
  }
}
function syncPause() {pause.textContent=paused?'Play':'Pause';pause.setAttribute('aria-pressed',String(paused));}
pause.addEventListener('click',()=>{paused=!paused;manualFrame=motionFrame('carnotaurus',clipSelect.value as MotionClip,clock);frameInput.value=String(manualFrame);syncPause();drawPreviews();});
frameInput.addEventListener('input',()=>{paused=true;manualFrame=Number(frameInput.value);syncPause();drawPreviews();});
for(const control of [clipSelect,baby,left])control.addEventListener('input',drawPreviews);
for(const control of [atmosphere,wind,footsteps])control.addEventListener('input',drawWorld);
behavior.addEventListener('input',()=>{for(const actor of actors){changeClip(actor,behavior.value==='natural'?'idle':behavior.value as MotionClip,1600);if(actor.clip==='eat'){actor.x=actor.max;actor.facing=1;}actor.frame=0;}drawWorld();});
document.addEventListener('visibilitychange',()=>{lastTime=0;});
reducedMotion.addEventListener('change',event=>{if(event.matches){paused=true;syncPause();}});
syncPause();drawWorld();drawPreviews();
// Read-only inspection for the disposable browser check; the scene touches no saves.
Object.assign(window,{__immersion:{snapshot:()=>({clock,paused,footfallCount,particles:particles.length,actors:actors.map(a=>({...a})),cachedSprites:sprites.size})}});
function tick(time:number) {
  const dt=lastTime?Math.min(100,time-lastTime):0;lastTime=time;
  if(!paused && !document.hidden){const elapsed=dt*Number(speed.value);clock+=elapsed;for(const actor of actors)advance(actor,elapsed);if(time-lastDraw>=1000/30){drawWorld();drawPreviews();lastDraw=time;}}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
