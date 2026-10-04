// Native-size comparison, shared artwork contracts, and matched renderer measurements.
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { check, finish, ready } from './lib.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = `${root}docs/art-review/`;
mkdirSync(out, { recursive: true });
const baseline = process.argv.includes('--baseline');
const styles = baseline ? ['original'] : ['original', 'blender'];
const errors = [];
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const url = process.env.BASE_URL ?? 'http://localhost:5173';
const measurements = {};
try {
  for (const style of styles) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const started = Date.now();
    await page.goto(`${url}/?quickstart&stress&art=${style}`, { waitUntil: 'load' });
    await ready(page);
    const startupMs = Date.now()-started;
    await page.evaluate(async () => {
      const { sim, game } = window.__dino;
      sim.setSpeed(0);
      sim.dispatch({ type: 'buyDino', species: 'tyrannosaurus', x: 24, y: 21 });
      sim.dispatch({ type: 'placeBuilding', kind: 'tower', x: 15, y: 14 });
      const trike = sim.state.dinos.find((d) => d.species === 'triceratops');
      sim.state.dinos.push({ ...trike, id: 9991, x: 27, px: 27, y: 20, py: 20, baby: true });
      const cam = game.scene.getScene('park').cameras.main;
      cam.setZoom(1.5); cam.centerOn(28*16, 22*16);
    });
    await new Promise((r) => setTimeout(r, 250));
    for (const [label, hour] of [['noon',4], ['dusk',10], ['night',15]]) {
      await page.evaluate((h) => { window.__dino.sim.state.hours = h; }, hour);
      await new Promise((r) => setTimeout(r, 120));
      await page.screenshot({ path: `${out}park-${style}-${label}.png` });
    }
    const metrics = await page.evaluate(async () => {
      const { sim, game } = window.__dino;
      sim.state.hours = 4;
      const scene = game.scene.getScene('park');
      const original = scene.entities.update.bind(scene.entities);
      const samples = [];
      scene.entities.update = (t) => { const start = performance.now(); original(t); samples.push(performance.now()-start); };
      sim.setSpeed(1);
      const frames = [];
      let last;
      await new Promise((resolve) => {
        const tick = (time) => { if (last !== undefined) frames.push(time-last); last=time;
          if (frames.length < 180) requestAnimationFrame(tick); else resolve(); };
        requestAnimationFrame(tick);
      });
      sim.setSpeed(0);
      scene.entities.update = original;
      frames.sort((a,b) => a-b); samples.sort((a,b) => a-b);
      return { p95FrameMs: frames[Math.floor(frames.length*.95)],
        p95EntityMs: samples[Math.floor(samples.length*.95)],
        dinos: sim.state.dinos.length, visitors: sim.state.visitors.length };
    });
    measurements[style] = { startupMs, ...metrics };
    check(`${style} populated park renders`, metrics.dinos >= 30 && metrics.visitors > 0, metrics);
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
    const contracts = await page.evaluate(async (style) => {
      const art = await import('/src/render/dinoArt.ts');
      const scenery = await import('/src/render/sceneryArt.ts');
      const { SPECIES, SPECIES_IDS } = await import('/src/sim/data/species.ts');
      const failures = [];
      // Remove the running game to make a stable sheet independent of its clock.
      window.__dino.game.destroy(true);
      document.body.innerHTML = '';
      document.documentElement.style.cssText = 'height:auto;overflow:visible';
      document.body.style.cssText = 'height:auto;min-height:100vh;margin:0;padding:12px;background:#223f35;color:#fff;overflow:visible;font:14px monospace';
      const title = document.createElement('h1'); title.textContent = `${style} · native size / 4× · adult poses / baby`;
      document.body.append(title);
      const magnify = (source, scale) => { const c=document.createElement('canvas'); c.width=source.width*scale; c.height=source.height*scale;
        const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false; ctx.drawImage(source,0,0,c.width,c.height); return c; };
      for (const id of SPECIES_IDS) {
        const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:12px;padding:8px;background:#79af5d;margin:4px 0;color:#132b21';
        const label=document.createElement('span'); label.textContent=id; label.style.width='150px'; row.append(label);
        const count=art.dinoFrameCount?.(id,style) ?? 2;
        for (let frame=0; frame<count; frame++) {
          const c=art.paintDino(SPECIES[id],frame,false,style);
          const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          if (pixels.some((a,i) => i%4===3 && a!==0 && a!==255)) failures.push(`${id}:${frame} softened alpha`);
          if (frame===0) row.append(magnify(c,1));
          row.append(magnify(c,4));
        }
        const baby=art.paintDino(SPECIES[id],0,true,style);
        row.append(magnify(baby,1),magnify(baby,4));
        if (!art.dinoShape(SPECIES[id],0,true,style).flat().includes('E')) failures.push(`${id} baby eye`);
        document.body.append(row);
      }
      const tower=scenery.paintTower(style); document.body.append(magnify(tower,1),magnify(tower,4));
      return failures;
    }, style);
    check(`${style} pixel and baby contracts`, contracts.length===0, contracts);
    await page.screenshot({ path: `${out}gallery-${style}.png`, fullPage: true });
    await page.close();
  }
  const transfer = (path) => readdirSync(path).reduce((sum,name) => {
    const file=`${path}/${name}`;
    return sum + (statSync(file).isDirectory() ? transfer(file) : gzipSync(readFileSync(file)).length);
  },0);
  const result={ measuredAt: new Date().toISOString(), measurements, gzipBuildBytes: transfer(`${root}dist`) };
  writeFileSync(`${out}${baseline ? 'baseline' : 'candidate'}.json`, JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
  finish(errors);
} finally { await browser.close(); }
