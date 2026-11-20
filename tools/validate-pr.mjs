// Sikkerhedstjek før auto-merge af den natlige opdatering.
// Kør:  node tools/validate-pr.mjs <base-ref>     (fx origin/main)
// Exit 0 = trygt at merge, exit 1 = kræver manuel gennemgang.
import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PACKAGES } from './package-type.mjs';

const MAX_REMOVED = 5;       // flere fjernede rejser end dette ligner en site-ændring/nedetid
const MAX_ADDED = 10;        // matcher grænsen i nightly-prompt.txt
const MAX_PRICE_JUMP = 0.3;  // prisændring over 30 % kræver et menneskeligt blik
const ALLOWED_PATHS = [/^data\/[^/]+\.json$/, /^index\.html$/, /^sitemap\.xml$/, /^rejse\//, /^guides\//];
const TRIP_TYPES = ['Rundrejse', 'Solferie', 'Citytrip', 'Krydstogt', 'Aktiv & vandring', 'Kultur & historie', 'Busrejse', 'Andet'];
const SOLO_TYPES = ['ingen-tillaeg', 'reduceret-tillaeg', 'tillaeg', 'solo-gruppe', 'soegepris', 'ukendt'];

const baseRef = process.argv[2] || 'origin/main';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const errors = [];
const notes = [];
const fail = (m) => errors.push(m);

// 1. Kun tilladte filer må være ændret
const changed = git('diff', '--name-only', `${baseRef}...HEAD`).split('\n').filter(Boolean);
for (const f of changed) if (!ALLOWED_PATHS.some((re) => re.test(f))) fail(`Uventet ændret fil: ${f}`);

// 2. Parse trips
let head, base;
try { head = JSON.parse(readFileSync('data/trips.json', 'utf8')); } catch (e) { fail(`trips.json kan ikke parses: ${e.message}`); }
try { base = JSON.parse(git('show', `${baseRef}:data/trips.json`)); } catch (e) { fail(`Kan ikke læse trips.json fra ${baseRef}: ${e.message}`); }

if (head && base) {
  const today = new Date().toISOString().slice(0, 10);
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;

  // 3. Hver rejse er gyldig
  const ids = new Set();
  for (const t of head) {
    const w = `Rejse ${t.id ?? '(uden id)'}`;
    if (!t.id || typeof t.id !== 'string') fail(`${w}: mangler id`);
    else if (ids.has(t.id)) fail(`${w}: dublet-id`);
    ids.add(t.id);
    if (!t.operator) fail(`${w}: mangler operator`);
    if (!t.title) fail(`${w}: mangler title`);
    if (!/^https?:\/\//.test(t.sourceUrl || '')) fail(`${w}: mangler gyldig sourceUrl`);
    if (!PACKAGES.includes(t.packageType)) fail(`${w}: ugyldig packageType "${t.packageType}"`);
    if (!TRIP_TYPES.includes(t.tripType)) fail(`${w}: ugyldig tripType "${t.tripType}"`);
    if (!SOLO_TYPES.includes(t.soloType)) fail(`${w}: ugyldig soloType "${t.soloType}"`);
    if (t.departureDate != null) {
      if (!isoDate.test(t.departureDate)) fail(`${w}: ugyldig departureDate "${t.departureDate}"`);
      else if (t.departureDate <= today) fail(`${w}: afrejse ${t.departureDate} er ikke i fremtiden`);
    }
    if (t.soloPriceDKK != null && !(Number.isFinite(t.soloPriceDKK) && t.soloPriceDKK > 0)) fail(`${w}: ugyldig soloPriceDKK ${t.soloPriceDKK}`);
    if (t.priceCheckedDate != null && !isoDate.test(t.priceCheckedDate)) fail(`${w}: ugyldig priceCheckedDate`);
  }

  // 4. Sammenlign med main
  const byId = (arr) => new Map(arr.map((t) => [t.id, t]));
  const b = byId(base), h = byId(head);
  const removed = base.filter((t) => !h.has(t.id));
  const added = head.filter((t) => !b.has(t.id));
  const priceChanges = [];
  for (const t of head) {
    const o = b.get(t.id);
    if (!o) continue;
    if (o.operator === 'Sembo' && JSON.stringify(o) !== JSON.stringify(t)) fail(`Sembo-rejse må ikke ændres af natjobbet: ${t.id}`);
    if (o.soloPriceDKK !== t.soloPriceDKK) {
      priceChanges.push({ id: t.id, from: o.soloPriceDKK, to: t.soloPriceDKK });
      if (o.soloPriceDKK && t.soloPriceDKK) {
        const jump = Math.abs(t.soloPriceDKK - o.soloPriceDKK) / o.soloPriceDKK;
        if (jump > MAX_PRICE_JUMP) fail(`${t.id}: pris ${o.soloPriceDKK} -> ${t.soloPriceDKK} (${Math.round(jump * 100)} %) er over grænsen på ${MAX_PRICE_JUMP * 100} %`);
      } else {
        fail(`${t.id}: pris gik fra/til tom (${o.soloPriceDKK} -> ${t.soloPriceDKK})`);
      }
    }
    if (o.packageType !== t.packageType) fail(`${t.id}: packageType ændret (${o.packageType} -> ${t.packageType})`);
  }
  for (const t of removed) if (t.operator === 'Sembo') fail(`Sembo-rejse må ikke fjernes af natjobbet: ${t.id}`);
  if (removed.length > MAX_REMOVED) fail(`${removed.length} rejser fjernet (grænse ${MAX_REMOVED})`);
  if (added.length > MAX_ADDED) fail(`${added.length} rejser tilføjet (grænse ${MAX_ADDED})`);

  notes.push(`Rejser: ${base.length} -> ${head.length}`);
  notes.push(`Tilføjet: ${added.length}${added.length ? ' (' + added.map((t) => t.id).join(', ') + ')' : ''}`);
  notes.push(`Fjernet: ${removed.length}${removed.length ? ' (' + removed.map((t) => t.id).join(', ') + ')' : ''}`);
  notes.push(`Prisændringer: ${priceChanges.length}${priceChanges.length ? ' (' + priceChanges.map((p) => `${p.id}: ${p.from} -> ${p.to}`).join('; ') + ')' : ''}`);
}

const summary = [
  `## Auto-merge tjek: ${errors.length ? '❌ kræver manuel gennemgang' : '✅ ok'}`,
  ...notes.map((n) => `- ${n}`),
  ...(errors.length ? ['', '**Problemer:**', ...errors.map((e) => `- ${e}`)] : []),
].join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
process.exit(errors.length ? 1 : 0);
