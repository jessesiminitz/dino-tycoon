import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await browser.newPage();await p.setViewport({width:844,height:390,isMobile:true,hasTouch:true});
const errors=[];p.on('pageerror',e=>errors.push(e.message));const delay=ms=>new Promise(r=>setTimeout(r,ms));
const tap=async s=>{await (await p.waitForSelector(s,{visible:true})).tap();await delay(250);};
try{
 await p.goto('http://localhost:5175/',{waitUntil:'networkidle0'});await tap('[data-go="new"]');await tap('[data-go="island"]');await tap('[data-shape="river"]');await tap('[data-big="1"]');await tap('[data-start-sandbox]');await delay(1500);
 await tap('#btn-menu');await tap('[data-pause="save"]');
 console.log('production sandbox saved=',await p.evaluate(()=>{const r=JSON.parse(localStorage.getItem('dino-tycoon:slot:1'));return {version:r?.state.version,shape:r?.state.map.shape,width:r?.state.map.width,canvas:!!document.querySelector('#game canvas'),devHook:!!window.__dino};}));
 await p.evaluate(async()=>{await navigator.serviceWorker.ready;});await p.reload({waitUntil:'networkidle0'});
 console.log('SW controlled=',await p.evaluate(()=>!!navigator.serviceWorker.controller));
 await p.setOfflineMode(true);await p.reload({waitUntil:'load'});await delay(700);
 console.log('offline menu=',await p.evaluate(()=>({title:document.title,continue:!!document.querySelector('[data-play="1"]'),controller:!!navigator.serviceWorker.controller})));
 await tap('[data-play="1"]');await delay(1200);console.log('offline park=',await p.evaluate(()=>({canvas:!!document.querySelector('#game canvas'),park:document.body.classList.contains('in-park')})));
 await p.screenshot({path:'audit-results/production-offline.png'});
 console.log('production errors=',errors);
}finally{await browser.close();}
