const C='orden-v3';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','shim.js','firebase-config.js','manifest.json','icon-192.png'])).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;const u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
 e.respondWith(fetch(r).then(res=>{if(res&&res.ok){const c=res.clone();caches.open(C).then(x=>x.put(r,c));}return res;}).catch(async()=>{const m=await caches.match(r,{ignoreSearch:true});if(m)return m;if(r.mode==='navigate'){const i=await caches.match('./')||await caches.match('index.html');if(i)return i;}return new Response('Sin conexión',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}));});
