import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1732, height: 500 });
await p.goto('file://' + new URL('sheet.html', import.meta.url).pathname, { waitUntil: 'load' });
await p.screenshot({ path: new URL('more-styles.png', import.meta.url).pathname, fullPage: true }); await b.close();
