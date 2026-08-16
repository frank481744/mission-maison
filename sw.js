const CACHE="mission-maison-pwa-v3";
const CORE=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET") return;

  if(req.mode==="navigate"){
    event.respondWith(
      fetch(req).then(resp=>{
        const copy=resp.clone();
        caches.open(CACHE).then(c=>c.put("./index.html",copy));
        return resp;
      }).catch(()=>caches.match("./index.html"))
    );
    return;
  }

  const url=new URL(req.url);
  if(url.origin===self.location.origin){
    event.respondWith(
      caches.match(req).then(cached=>{
        const fresh=fetch(req).then(resp=>{
          if(resp.ok) caches.open(CACHE).then(c=>c.put(req,resp.clone()));
          return resp;
        }).catch(()=>cached);
        return cached || fresh;
      })
    );
  }
});
