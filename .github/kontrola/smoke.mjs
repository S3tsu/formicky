// Kouřový test Formiček: spustí se na GitHubu (workflow kontrola.yml) i lokálně:
//   python3 -m http.server 8765 & node .github/kontrola/smoke.mjs
// Statistiky a formulář hlášení se během testu blokují, nic se neodešle.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('./', import.meta.url));
const { chromium } = require('playwright');

const U = process.env.FH_URL || 'http://localhost:8765/';
const ROOT = new URL('../../', import.meta.url);
const chyby = [];
const fail = m => { chyby.push(m); console.log('✗ ' + m); };
const ok = m => console.log('✓ ' + m);

// 1. Číslo verze: VER v sw.js a FH_VER v index.html musí být stejné
const ver = (/VER = '(\d{12})'/.exec(readFileSync(new URL('sw.js', ROOT), 'utf8')) || [])[1];
const fhv = (/const FH_VER = '(\d{12})'/.exec(readFileSync(new URL('index.html', ROOT), 'utf8')) || [])[1];
if (!ver || ver !== fhv) fail(`verze nesedí: sw.js ${ver}, index.html ${fhv}`); else ok(`verze ${ver}`);

const b = await chromium.launch();
async function strana(o = {}, init, arg) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' }, o));
  await ctx.route(/goatcounter|docs\.google/, r => r.abort());
  if (init) await ctx.addInitScript(init, arg);
  const p = await ctx.newPage(), err = [];
  p.on('pageerror', e => err.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/goatcounter|docs\.google|ERR_FAILED/.test(m.text())) err.push(m.text()); if (m.type() === 'warning' && /Lekce|Analytika:/.test(m.text())) err.push(m.text()); });
  return { ctx, p, err };
}
const viditelne = p => p.evaluate(() => ['hub', 'appOC', 'appAC'].some(id => { const x = document.getElementById(id); return x && !x.hidden; }));

// 2. Hlavní stránky na mobilu i počítači, světlý i tmavý režim
for (const [w, h] of [[375, 812], [1280, 900]]) for (const sc of ['light', 'dark']) {
  const { ctx, p, err } = await strana({ viewport: { width: w, height: h }, colorScheme: sc });
  for (const hsh of ['', '#organicka', '#analyticka', '#analyticka-lekce', '#test', '#navod']) {
    await p.goto(U + hsh); await p.waitForTimeout(1200);
    if (!(await viditelne(p))) fail(`${w} px ${sc} ${hsh || 'úvod'}: nic se nezobrazilo`);
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fail(`${w} px ${sc} ${hsh || 'úvod'}: stránka přetéká do strany`);
  }
  const le = await p.evaluate(() => (typeof LOAD_ERR !== 'undefined' ? LOAD_ERR : []).map(x => x.topic + ': ' + x.msg));
  le.forEach(x => fail('nenačteno ' + x));
  err.forEach(e => fail(`${w} px ${sc}: ${e}`));
  if (!err.length && !le.length) ok(`${w} px ${sc}: bez chyb`);
  await ctx.close();
}

// 3. Kontrola dat (?kontrola): známá varování „správná možnost nápadně delší“ projdou, ostatní ne
{
  const { ctx, p } = await strana();
  await p.goto(U + '?kontrola'); await p.waitForTimeout(1500);
  const W = await p.evaluate(() => window.FH_KONTROLA || null);
  if (!W) fail('kontrola dat neproběhla');
  else { const zle = W.filter(x => x.co !== 'správná možnost nápadně delší'); zle.forEach(x => fail(`data: ${x.co} (${x.kde}) ${x.detail || ''}`)); if (!zle.length) ok(`data: ${W.length} známých varování délky`); }
  await ctx.close();
}

// 4. Odpověď ve Studiu, Herna a systémové Zpět
{
  const { ctx, p, err } = await strana();
  await p.goto(U + '#studium'); await p.waitForTimeout(1200);
  try { await p.click('#view .opt >> nth=0', { timeout: 5000 }); ok('odpověď ve Studiu'); } catch (e) { fail('ve Studiu nejde odpovědět'); }
  await p.goto(U); await p.waitForTimeout(1200);
  try {
    await p.click('#hnHubG [data-hn]', { timeout: 5000 }); await p.waitForTimeout(400);
    await p.goBack(); await p.waitForTimeout(500);
    const open = await p.evaluate(() => { const x = document.getElementById('herna'); return !!x && !x.hidden; });
    const hub = await p.evaluate(() => !document.getElementById('hub').hidden && !location.hash);
    if (open || !hub) fail('Zpět nezavřelo Hernu nebo odešlo z úvodu'); else ok('Herna a Zpět');
  } catch (e) { fail('Herna se neotevřela'); }
  err.forEach(e => fail('Studium/Herna: ' + e));
  await ctx.close();
}

// 5. Poškozená data v úložišti nesmí shodit stránku
for (const [k, v] of [['fg-srs', 'null'], ['fg-settings', '{"fams":5,"mode":"zzz"}'], ['fg-daily', '{"goal":"abc","c":null}'], ['fg-herna', 'null'], ['fg-ac', '{"r":null,"les":5}'], ['fg-progress', '[1,2]']]) {
  const { ctx, p, err } = await strana({}, ([k, v]) => { if (!sessionStorage.getItem('s')) { localStorage.setItem(k, v); sessionStorage.setItem('s', 1); } }, [k, v]);
  await p.goto(U); await p.waitForTimeout(1200);
  const q = await viditelne(p);
  if (!q || err.length) fail(`poškozené ${k}=${v}: ${err[0] || 'nic se nezobrazilo'}`); else ok(`poškozené ${k}`);
  await ctx.close();
}

await b.close();
if (chyby.length) { console.log(`\n${chyby.length} problémů`); process.exit(1); }
console.log('\nVšechno v pořádku');
