// The playful moves and the hand-drawn T-rex in a running park: every clip in the atlas, the T-rex in its
// own colours (adult and baby), each animal doing a move while it stands about and going back to idling,
// a pat starting the happy dance, the menus' T-rex. Run with the dev server up (npm run dev).
import puppeteer from 'puppeteer-core';
import { HERE, check, finish, ready, gameUrl } from './lib.mjs';
const OUT = HERE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W, H] = (process.argv[2] ?? '844x390').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(gameUrl('/?quickstart'), { waitUntil: 'load' }); await ready(page);
await sleep(1200);

const SPECIES = ['tyrannosaurus', 'allosaurus', 'triceratops', 'stegosaurus', 'parasaurolophus', 'velociraptor'];
const ids = await page.evaluate((list) => {
  const { sim, game } = window.__dino; const s = sim.state; s.money = 1e7; sim.setSpeed(1);
  s.parcelsOwned = s.parcelsOwned.map(() => true);
  for (const sp of list) if (!s.unlockedSpecies.includes(sp)) s.unlockedSpecies.push(sp);
  const { x: ex, y: ey } = s.entrance;
  const A = { x: ex - 9, y: ey - 14 }, C = { x: ex + 9, y: ey - 3 };
  const edges = [];
  for (let x = A.x; x < C.x; x++) edges.push({ dir: 'h', x, y: A.y }, { dir: 'h', x, y: C.y });
  for (let y = A.y; y < C.y; y++) edges.push({ dir: 'v', x: A.x, y }, { dir: 'v', x: C.x, y });
  sim.dispatch({ type: 'buildFences', edges, fence: 4 });
  const out = {};
  // a free tile near each spot (trees and rocks block some)
  const buy = (sp, x, y) => {
    for (let r = 0; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if (sim.dispatch({ type: 'buyDino', species: sp, x: x + dx, y: y + dy }).ok) return s.dinos.at(-1).id;
  };
  list.forEach((sp, i) => { out[sp] = buy(sp, A.x + 3 + (i % 3) * 6, A.y + 3 + Math.floor(i / 3) * 5); });
  // a hatchling T-rex too
  out.baby = buy('tyrannosaurus', A.x + 15, A.y + 8);
  if (out.baby !== undefined) s.dinos.at(-1).baby = true;
  // hold the animals where they stand: the clock keeps running, nobody sets off on a walk
  sim.step = () => {};
  for (const d of s.dinos) { d.hunger = 0; d.happiness = 60; }
  const cam = game.scene.getScene('park').cameras.main; cam.setZoom(3); cam.centerOn((A.x + 9) * 16, (A.y + 6) * 16);
  return out;
}, SPECIES);
check('bought every animal for the paddock', SPECIES.every((sp) => ids[sp] !== undefined) && ids.baby !== undefined, ids);
await sleep(800);

// Keep the animals standing still, and run their clock faster, so the moves come round quickly.
const watch = async (ms, extra = 400) => {
  const seen = {};
  for (let t = 0; t < ms; t += 60) {
    const frames = await page.evaluate((extra) => {
      const sc = window.__dino.game.scene.getScene('park'), e = sc.entities, s = window.__dino.sim.state;
      for (const d of s.dinos) { d.path = []; d.px = d.x; d.py = d.y; d.hunger = 0; }
      e.animalTime += extra;
      return Object.fromEntries(s.dinos.map((d) => [d.id, e.dinoSprite(d.id)?.frame.name]));
    }, extra);
    for (const [id, name] of Object.entries(frames)) (seen[id] ??= []).push(name);
    await sleep(60);
  }
  return seen;
};

const atlas = await page.evaluate(() => {
  const tex = window.__dino.game.textures;
  const names = (key) => tex.exists(key) ? tex.get(key).getFrameNames() : [];
  // the colours actually painted into the T-rex atlas
  const colours = (key) => {
    if (!tex.exists(key)) return [];
    const src = tex.get(key).getSourceImage(), ctx = src.getContext('2d'), data = ctx.getImageData(0, 0, src.width, src.height).data, set = new Set();
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) set.add('#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''));
    return [...set];
  };
  return { rex: names('motion-tyrannosaurus'), baby: names('motion-tyrannosaurus-baby'), allo: names('motion-allosaurus'), rexColours: colours('motion-tyrannosaurus'), babyColours: colours('motion-tyrannosaurus-baby') };
});
const CLIPS = ['walk', 'idle', 'eat', 'rest', 'roar', 'stomp', 'dance', 'hop', 'sneeze', 'wink'];
for (const [label, list] of [['T-rex', atlas.rex], ['baby T-rex', atlas.baby], ['Allosaurus', atlas.allo]])
  check(`${label} atlas holds all ten clips × 8 frames`, CLIPS.every((c) => [...Array(8)].every((_, i) => list.includes(`${c}-${i}`))), list.length);
// rex2's hide: the red-brown back (#97633a) and the tan flank (#a07c56); the Blender T-rex's green is gone
check('the park T-rex is the brown hand-drawn one', atlas.rexColours.includes('#97633a') && atlas.rexColours.includes('#a07c56') && !atlas.rexColours.includes('#6b7a4a'), atlas.rexColours.length);
check('the baby T-rex is the same, a touch paler', atlas.babyColours.length > 0 && !atlas.babyColours.includes('#97633a'), atlas.babyColours.slice(0, 4));

await page.screenshot({ path: `${OUT}fun-1-paddock-${W}.png` });
const seen = await watch(9000);
const fun = new Set(['roar', 'stomp', 'dance', 'hop', 'sneeze', 'wink']);
for (const sp of [...SPECIES, 'baby']) {
  const names = seen[ids[sp]] ?? [];
  const moves = [...new Set(names.filter((n) => fun.has(n?.split('-')[0])).map((n) => n.split('-')[0]))];
  const frames = new Set(names.filter((n) => fun.has(n?.split('-')[0])));
  check(`${sp} does a playful move while standing about`, moves.length > 0 && frames.size >= 4, moves);
  check(`${sp} goes back to idling`, names.at(-1)?.startsWith('idle') || names.slice(-40).some((n) => n?.startsWith('idle')), names.at(-1));
}

// Catch the T-rex mid-move for the screenshots.
const shoot = async (want, file) => {
  const names = [];
  for (let i = 0; i < 400; i++) {
    const name = await page.evaluate((id) => {
      const sc = window.__dino.game.scene.getScene('park'), e = sc.entities, s = window.__dino.sim.state;
      for (const d of s.dinos) { d.path = []; d.px = d.x; d.py = d.y; }
      e.animalTime += 90;
      const d = s.dinos.find((x) => x.id === id), q = e.dinoPosition(d);
      sc.cameras.main.setZoom(6); sc.cameras.main.centerOn(q.x, q.y - 14);
      return e.dinoSprite(id).frame.name;
    }, ids.tyrannosaurus);
    names.push(name);
    await sleep(40);   // let the park draw a frame between steps
    if (want.test(name)) { await sleep(30); await page.screenshot({ path: `${OUT}${file}-${W}.png` }); return name; }
  }
  console.log('seen:', [...new Set(names)].join(' '));
};
const roar = await shoot(/^(roar|stomp|sneeze|hop)-[345]$/, 'fun-2-rex-move');
check('caught the T-rex mid-move on screen', !!roar, roar);

// A pat starts the happy dance (real-time clock, even at speed 0).
await page.evaluate((id) => {
  const sc = window.__dino.game.scene.getScene('park'); const d = window.__dino.sim.state.dinos.find((x) => x.id === id);
  d.hunger = 0; d.happiness = 80; d.lastPatHour = -99; sc.cameras.main.setZoom(3);
  const q = sc.entities.dinoPosition(d); sc.cameras.main.centerOn(q.x, q.y);
}, ids.triceratops);
await sleep(250);
const p = await page.evaluate((id) => { const sc = window.__dino.game.scene.getScene('park'); const d = window.__dino.sim.state.dinos.find((x) => x.id === id); const q = sc.entities.dinoPosition(d); const c = sc.cameras.main; const cx = c.width / 2, cy = c.height / 2; return { x: (q.x - c.scrollX - cx) * c.zoom + cx, y: (q.y - 10 - c.scrollY - cy) * c.zoom + cy }; }, ids.triceratops);
await page.touchscreen.tap(p.x, p.y); await sleep(80);
// tapping it makes it wink back
const winked = new Set();
let shot = false;
for (let i = 0; i < 40; i++) {
  const name = await page.evaluate((id) => window.__dino.game.scene.getScene('park').entities.dinoSprite(id).frame.name, ids.triceratops);
  winked.add(name);
  if (!shot && /^wink-[34]$/.test(name)) { shot = true; await page.screenshot({ path: `${OUT}fun-4-tap-wink-${W}.png` }); }
  await sleep(25);
}
check('tapping the triceratops makes it wink, eye shut and open again', shot && [...winked].filter((n) => n.startsWith('wink')).length >= 5, [...winked]);
const smalls = await page.$$('#info-actions .action-btn.small');
await smalls[1].tap();
const danced = new Set();
for (let i = 0; i < 20; i++) { danced.add(await page.evaluate((id) => window.__dino.game.scene.getScene('park').entities.dinoSprite(id).frame.name, ids.triceratops)); if (i === 6) await page.screenshot({ path: `${OUT}fun-3-pat-dance-${W}.png` }); await sleep(60); }
check('patting the triceratops starts its happy dance', [...danced].filter((n) => n.startsWith('dance')).length >= 4, [...danced]);

// The catalog's T-rex is the hand-drawn one too.
const catalog = await page.evaluate(async () => {
  const { paintDino } = await import('/src/render/dinoArt.ts'); const { SPECIES } = await import('/src/sim/data/species.ts');
  const c = paintDino(SPECIES.tyrannosaurus), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let brown = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && d[i] === 0x97 && d[i + 1] === 0x63 && d[i + 2] === 0x3a) brown++;
  return { w: c.width, h: c.height, brown };
});
check('catalog and guide show the brown T-rex', catalog.brown > 20, catalog);
finish(errors);
await browser.close();
