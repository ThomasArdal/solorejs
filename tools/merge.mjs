// Fletter research-filer til data/trips.json og validerer dem.
// Kør:  node tools/merge.mjs <mappe med .json-filer>
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2];
if (!dir) { console.error('Angiv mappe med research-filer'); process.exit(1); }

const TODAY = '2026-11-10';
const TYPES = ['Rundrejse', 'Solferie', 'Citytrip', 'Krydstogt', 'Aktiv & vandring', 'Kultur & historie', 'Busrejse', 'Andet'];
const SOLO = ['ingen-tillaeg', 'reduceret-tillaeg', 'tillaeg', 'solo-gruppe', 'ukendt'];

// Bevidst fravalgt efter gennemgang
const EXCLUDE = new Set([
  'albatros-indien-2027-02-13',            // udsolgt hos udbyder
  'spies-kreta-platanias',                  // dublet af spies-kreta-2027-05-06
  'bravo-krydstogt-5-kanariske-oeer-madeira', // ingen solopris/-vilkår oplyst
]);

const out = [];
const seen = new Set();
const problems = [];

for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  let arr;
  try { arr = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch (e) { problems.push(`${f}: ugyldig JSON`); continue; }
  for (const t of arr) {
    if (EXCLUDE.has(t.id)) continue;
    const why = [];
    if (!t.id || seen.has(t.id)) why.push('mangler/dublet id');
    if (!t.title || !t.operator || !t.country) why.push('mangler title/operator/country');
    if (!/^https?:\/\//.test(t.sourceUrl || '')) why.push('mangler sourceUrl');
    if (t.departureDate && t.departureDate <= TODAY) why.push('afrejse ikke i fremtiden');
    if (!SOLO.includes(t.soloType)) t.soloType = 'ukendt';
    if (!TYPES.includes(t.tripType)) t.tripType = 'Andet';
    for (const k of ['soloPriceDKK', 'pricePerPersonDoubleDKK', 'singleSupplementDKK'])
      if (t[k] != null && (typeof t[k] !== 'number' || t[k] < 0)) why.push(`ugyldig ${k}`);
    if (why.length) { problems.push(`${f} / ${t.id ?? t.title}: ${why.join(', ')}`); continue; }
    seen.add(t.id);
    out.push(t);
  }
}

out.sort((a, b) => (a.departureDate || '9999').localeCompare(b.departureDate || '9999') || a.title.localeCompare(b.title, 'da'));
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(join(root, 'data', 'trips.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`Skrev ${out.length} rejser til data/trips.json`);
if (problems.length) console.log('Fravalgt:\n - ' + problems.join('\n - '));
