// Finder et billede (og:image) pr. rejse og gemmer det i data/images.json.
// Billederne HOTLINKES kun til preview – få tilladelse/brug feed-billeder før lancering.
// Kør:  node tools/fetch-images.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trips = JSON.parse(readFileSync(join(root, 'data', 'trips.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (compatible; SoloRejsBot/0.1)';

function pick(html, base) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const get = (re) => {
    for (const m of metas) {
      if (!re.test(m)) continue;
      const c = m.match(/content=["']([^"']+)["']/i);
      if (c) return c[1].replace(/&amp;/g, '&');
    }
  };
  let url = get(/property=["']og:image(:secure_url)?["']/i) || get(/name=["']twitter:image["']/i);
  if (!url) {
    const ld = html.match(/"image"\s*:\s*"([^"]+)"/i) || html.match(/"image"\s*:\s*\[\s*"([^"]+)"/i);
    if (ld) url = ld[1];
  }
  if (!url) return null;
  try { return new URL(url, base).href; } catch { return null; }
}

const out = {};
for (const t of trips) {
  try {
    const res = await fetch(t.sourceUrl, { headers: { 'user-agent': UA, 'accept-language': 'da' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const html = res.ok ? await res.text() : '';
    const img = html ? pick(html, res.url) : null;
    console.log(`${res.status} ${img ? 'IMG ' : 'none'} ${t.id}${img ? '  ' + img : ''}`);
    if (img) out[t.id] = img;
  } catch (e) {
    console.log(`ERR  none ${t.id}  ${e.cause?.code || e.message}`);
  }
  await sleep(1500);
}
writeFileSync(join(root, 'data', 'images.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\n${Object.keys(out).length} af ${trips.length} rejser har et billede.`);
