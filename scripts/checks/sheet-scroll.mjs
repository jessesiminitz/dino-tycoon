// Does any panel scroll sideways? Measures each sheet's content against its width on phones.
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h] of [[667, 375], [844, 390], [1180, 820]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173/?quickstart', { waitUntil: 'load' });
  await sleep(1200);
  const out = await page.evaluate(async () => {
    const res = {};
    const sheets = [...document.querySelectorAll('.modal')].map((m) => m.id);
    for (const id of sheets) {
      const m = document.getElementById(id);
      m.classList.remove('hidden');
      await new Promise((r) => requestAnimationFrame(r));
      const wide = [...m.querySelectorAll('*')].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible' && !el.matches('.tabs, nav'));
      const card = m.querySelector('.modal-card');
      res[id] = { card: card ? `${Math.round(card.getBoundingClientRect().width)}x${Math.round(card.getBoundingClientRect().height)}` : '-', sideways: wide.map((el) => `${el.className || el.tagName}:${el.scrollWidth}>${el.clientWidth}`) };
      m.classList.add('hidden');
    }
    const hb = [...document.querySelectorAll('.hud-btn:not([hidden]), .speed-btn')].map((b) => { const r = b.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
    return { res, hud: hb.join(' ') };
  });
  console.log(`${w}x${h} hud: ${out.hud}`);
  for (const [k, v] of Object.entries(out.res)) console.log(`  ${k.padEnd(10)} ${v.card.padEnd(10)} ${v.sideways.join(' ')}`);
  await page.close();
}
await browser.close();
