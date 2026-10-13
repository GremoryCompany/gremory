const CACHE='gremory-v10-static';
const CORE=['/','/index.html','/assets/css/app.css?v=20261013-v10','/assets/js/app.js?v=20261013-v10','/assets/img/profile.jpg','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;if(u.pathname.startsWith('/api/'))return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(CACHE).then(k=>k.put('/index.html',c));return x}).catch(()=>caches.match('/index.html')));return}
  e.respondWith(caches.match(r).then(hit=>{const fresh=fetch(r).then(x=>{if(x.ok)caches.open(CACHE).then(c=>c.put(r,x.clone()));return x}).catch(()=>hit);return hit||fresh}))
});