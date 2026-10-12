/* FormičkyHub – offline režim. Stránka: nejdřív síť (vždy nejnovější verze), bez signálu z mezipaměti. */
const VER = '202610121939';
const CORE = 'fh-core-' + VER, RT = 'fh-rt-v1';
const PRE = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'icon-32.png'];
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
    e.respondWith((async () => {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
      try {
        const res = await fetch(r, { signal: ctl.signal, cache: 'no-cache' }); clearTimeout(t);
        if (res.ok) { const c = await caches.open(CORE); c.put('./', res.clone()); }
        return res;
      } catch (err) {
        clearTimeout(t);
        return (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }
  if (u.origin === location.origin) {
    e.respondWith(caches.match(r).then(m => m || fetch(r)));
    return;
  }
  if (RT_HOSTS.includes(u.hostname)) {
    e.respondWith(caches.open(RT).then(async c => {
      const m = await c.match(r);
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => m);
      return m || net;
    }));
  }
});
