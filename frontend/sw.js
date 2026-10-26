const CACHE='setu-offline-v18';
const FILES=['./','./index.html','./style.css','./app.js','./analysis.js','./charts.js','./report.js','./vendor/pdf-lib.min.js','./vendor/jszip.min.js','./engine.js','./comparison.js','./statements.js','./importer.js','./currency.js','./workbook-import.js','./vendor/xlsx.full.min.js','./icon.svg','./vendor/fonts/sora-latin.woff2','./vendor/fonts/sora-latin-ext.woff2','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('setu-offline-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&new URL(e.request.url).origin===self.location.origin)e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});



