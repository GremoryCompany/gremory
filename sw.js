const CACHE='gremory-v14-20261030-sync-upload-v4';
const CORE=[
  '/',
  '/index.html',
  '/assets/css/app.css?v=20261030-sync-upload-v4',
  '/assets/js/app.js?v=20261030-sync-upload-v4',
  '/assets/js/community.js?v=20261030-sync-upload-v4',
  '/assets/css/gremory-tools.css?v=20261028-gifts-catalog-02',
  '/assets/js/gremory-tools.js?v=20261028-gifts-catalog-02',
  '/assets/js/watch-device.js',
  '/assets/js/profile-details.js',
  '/assets/js/upload-flow.js',
  '/assets/img/gremory-logo.png',
  '/assets/img/profile.jpg',
  '/manifest.webmanifest'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;if(u.pathname.startsWith('/api/'))return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(CACHE).then(k=>k.put('/index.html',c));return x}).catch(()=>caches.match('/index.html')));return}
  // JS/CSS usam network-first para evitar manter versão antiga após um deploy.
  if(u.pathname.endsWith('.js')||u.pathname.endsWith('.css')||u.pathname.startsWith('/assets/audio/custom/')){e.respondWith(fetch(r).then(x=>{if(x.ok)caches.open(CACHE).then(c=>c.put(r,x.clone()));return x}).catch(()=>caches.match(r)));return}
  e.respondWith(caches.match(r).then(hit=>{const fresh=fetch(r).then(x=>{if(x.ok)caches.open(CACHE).then(c=>c.put(r,x.clone()));return x}).catch(()=>hit);return hit||fresh}))
});
