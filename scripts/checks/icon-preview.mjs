import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';
const OUT = new URL('.', import.meta.url).pathname;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 900, height: 600 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
const urls = await page.evaluate(async () => {
  const { paintIcon } = await import('/src/render/iconArt.ts');
  return { big: paintIcon(512).toDataURL(), small: paintIcon(180).toDataURL(), mask: paintIcon(512, 0.1).toDataURL() };
});
// Preview: large, masked (iOS-style rounded square), and at real Home Screen size.
await page.setContent(`<body style="margin:0;background:#1c2a3a;display:flex;gap:30px;align-items:center;padding:30px;font:12px sans-serif;color:#ccc">
  <img src="${urls.big}" width=360 style="border-radius:80px">
  <div style="display:flex;flex-direction:column;gap:20px;align-items:center">
    <img src="${urls.small}" width=60 style="border-radius:13px"><span>real size</span>
    <img src="${urls.mask}" width=160 style="border-radius:50%"><span>maskable (circle)</span>
  </div></body>`);
await page.screenshot({ path: `${OUT}icon-preview.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
