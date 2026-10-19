/* FormičkyHub – offline režim. Stránka: nejdřív síť (vždy nejnovější verze), bez signálu nebo při pomalé síti (3 s) z mezipaměti. */
const VER = '202610191252';
const CORE = 'fh-core-' + VER, RT = 'fh-rt-v2';
// písma jsou na webu (fonts/), ukládají se hned, ať fungují i offline; knihovna 3D (lib/) a m3d.json až při prvním otevření 3D
const PRE = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'icon-32.png', 'favicon.svg',
  'fonts/plex-latin.woff2', 'fonts/plex-latin-ext.woff2', 'fonts/plex-greek.woff2', 'fonts/bricolage-latin.woff2', 'fonts/bricolage-latin-ext.woff2'];
self.addEventListener('install', e => {
  // cache: 'reload' obejde mezipaměť prohlížeče, ať se pod novou verzí neuloží stará stránka
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('fh-') && k !== CORE && k !== RT).map(k => caches.delete(k))))
    // z runtime mezipaměti pryč: m3d.json starší verze, dřívější písma z Googlu a 3Dmol z CDN, starší kopie knihovny
    .then(() => caches.open(RT)).then(c => c.keys().then(rs => Promise.all(rs.filter(r => { const u = new URL(r.url); return u.origin !== location.origin || (/\/m3d\.json$/.test(u.pathname) && u.search !== '?v=' + VER) || (/\/lib\//.test(u.pathname) && !u.pathname.endsWith(LIB)); }).map(r => c.delete(r)))))
    .then(() => self.clients.claim()));
});
const LIB = '/lib/3Dmol-2.4.2-min.js';
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
      // Ukládá se jen opravdová stránka Formiček (obsahuje FH_VER, bez přesměrování), ne třeba přihlašovací stránka Wi-Fi na koleji.
      if (res.ok && !res.redirected && /text\/html/.test(res.headers.get('content-type') || '')) {
        const copy = res.clone();
        saved = copy.text().then(t => /const FH_VER = '\d{12}'/.test(t) ? caches.open(CORE).then(c => c.put('./', new Response(t, { headers: { 'content-type': 'text/html; charset=utf-8' } }))) : null);
      }
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
  const lazy = u.origin === location.origin && (u.pathname.endsWith('/m3d.json') || u.pathname.endsWith(LIB));
  if (u.origin === location.origin && !lazy) {
    e.respondWith(caches.match(r).then(m => m || fetch(r)));
    return;
  }
  if (lazy) {
    e.respondWith(caches.open(RT).then(async c => {
      const m = await c.match(r);
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => m);   // jen úspěšné odpovědi, ať se neuloží a pak neopakuje chyba
      return m || net;
    }));
  }
});
