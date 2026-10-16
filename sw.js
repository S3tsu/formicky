/* FormičkyHub – offline režim. Stránka: nejdřív síť (vždy nejnovější verze), bez signálu nebo při pomalé síti (3 s) z mezipaměti. */
const VER = '202610161045';
const CORE = 'fh-core-' + VER, RT = 'fh-rt-v1';
const PRE = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'icon-32.png', 'favicon.svg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('fh-core-') && k !== CORE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const RT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (r.mode === 'navigate') {
    // Uložená verze se použije, když síť neodpoví do 3 s. Stahování pak doběhne na pozadí,
    // takže při dalším otevření je stránka zase nejnovější.
    let saved;
    const net = fetch(r, { cache: 'no-cache' }).then(res => { if (res.ok) saved = caches.open(CORE).then(c => c.put('./', res.clone())); return res; });
    e.waitUntil(net.then(() => saved, () => {}));
    e.respondWith((async () => {
      const cached = await caches.match('./');
      if (!cached) { try { return await net; } catch (err) { return Response.error(); } }
      const late = new Promise(ok => setTimeout(() => ok(null), 3000));
      try { return (await Promise.race([net, late])) || cached; } catch (err) { return cached; }
    })());
    return;
  }
  const lazy = u.origin === location.origin && u.pathname.endsWith('/m3d.json');
  if (u.origin === location.origin && !lazy) {
    e.respondWith(caches.match(r).then(m => m || fetch(r)));
    return;
  }
  if (lazy || RT_HOSTS.includes(u.hostname)) {
    e.respondWith(caches.open(RT).then(async c => {
      const m = await c.match(r);
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => m);
      return m || net;
    }));
  }
});
