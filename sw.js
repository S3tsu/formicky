/* FormičkyHub – offline režim. Stránka: nejdřív síť (vždy nejnovější verze), bez signálu nebo při pomalé síti (3 s) z mezipaměti. */
const VER = '202610191038';
const CORE = 'fh-core-' + VER, RT = 'fh-rt-v2';   // v2: písma a 3Dmol se načítají s CORS, staré neprůhledné odpovědi z v1 se nepoužijí
const PRE = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'icon-32.png', 'favicon.svg'];
self.addEventListener('install', e => {
  // cache: 'reload' obejde mezipaměť prohlížeče, ať se pod novou verzí neuloží stará stránka
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('fh-') && k !== CORE && k !== RT).map(k => caches.delete(k))))
    .then(() => caches.open(RT)).then(c => c.keys().then(rs => Promise.all(rs.filter(r => /\/m3d\.json$/.test(new URL(r.url).pathname) && new URL(r.url).search !== '?v=' + VER).map(r => c.delete(r)))))
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
    // Kopie se dělá hned, dokud tělo odpovědi nikdo nečetl; ukládá se jen stránka (HTML), ne chyba ani obrázek.
    let saved;
    const net = fetch(r, { cache: 'no-cache' }).then(res => {
      if (res.ok && /text\/html/.test(res.headers.get('content-type') || '')) { const copy = res.clone(); saved = caches.open(CORE).then(c => c.put('./', copy)); }
      return res;
    });
    e.waitUntil(net.then(() => saved, () => {}));
    e.respondWith((async () => {
      const cached = await caches.match('./');
      if (!cached) { try { return await net; } catch (err) { return Response.error(); } }
      const late = new Promise(ok => setTimeout(() => ok(null), 3000));
      try { const res = await Promise.race([net, late]); return res && res.ok ? res : cached; } catch (err) { return cached; }   // chyba serveru (404, 5xx) → uložená verze
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
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => m);   // jen úspěšné odpovědi, ať se neuloží a pak neopakuje chyba
      return m || net;
    }));
  }
});
