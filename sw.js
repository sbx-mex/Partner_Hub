const CACHE_PREFIX='partner-hub-';
const CACHE='partner-hub-directorio-v6';
const ASSETS=['./','index.html','styles.css','app.js','manifest.webmanifest','data/partners.js','assets/partner-hub-logo.png','assets/partner-hub-logo.webp','assets/icon-192.png','assets/icon-512.png','assets/birthday-template.png','assets/anniversary-template.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;
  const isData=url.pathname.endsWith('/data/partners.js');
  if(e.request.mode==='navigate'||isData){
    e.respondWith(fetch(e.request).then(resp=>{if(resp.ok){const copy=resp.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}return resp}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{if(resp.ok){const copy=resp.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}return resp})));
});
