// Skriver Sembo-observationer ind i data/trips.json (opretter nye, opdaterer eksisterende).
// Kør:  ADTRACTION_TOKEN=... node tools/sembo-upsert.mjs <observationer.json>
// Observationer = [{ id, price, departureDate, nights, hotelName, roomType, board, flight, checkedDate,
//                    description?, highlights?, includes? }]   (description m.fl. kun nødvendige for nye rejser)
// Kandidater (hvad der må oprettes) ligger i tools/sembo-candidates.json.
// sourceUrl er altid Adtractions trackingUrl for kandidatens feed-sku.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGES } from './package-type.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const obsFile = process.argv[2];
const token = process.env.ADTRACTION_TOKEN;
if (!obsFile || !token) { console.error('Brug: ADTRACTION_TOKEN=... node tools/sembo-upsert.mjs <observationer.json>'); process.exit(1); }

const PROGRAM_ID = 1970763849, CHANNEL_ID = 2126866054;
const cands = JSON.parse(readFileSync(join(root, 'tools', 'sembo-candidates.json'), 'utf8'));
const obs = obsFile === '--images' ? [] : JSON.parse(readFileSync(obsFile, 'utf8')); // --images: kun billeder
const tripsPath = join(root, 'data', 'trips.json');
const trips = JSON.parse(readFileSync(tripsPath, 'utf8'));

const res = await fetch('https://api.adtraction.net/v3/partner/products/feed/', {
  method: 'POST', headers: { 'X-Token': token, 'content-type': 'application/json' },
  body: JSON.stringify({ programId: PROGRAM_ID, channelId: CHANNEL_ID }),
});
if (!res.ok) { console.error('Feed-fejl', res.status); process.exit(1); }
const feed = new Map((await res.json()).map((p) => [p.sku, p]));

const log = { created: [], updated: [], skipped: [] };
for (const o of obs) {
  const c = cands.find((x) => x.id === o.id);
  if (!c) { log.skipped.push(`${o.id}: ikke i kandidatlisten`); continue; }
  const p = feed.get(c.sku);
  if (!p?.trackingUrl) { log.skipped.push(`${o.id}: sku findes ikke længere i feedet`); continue; }
  if (typeof o.price !== 'number' || !(o.price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(o.departureDate || '')) { log.skipped.push(`${o.id}: ugyldig pris/dato`); continue; }
  if (!PACKAGES.includes(c.packageType)) { log.skipped.push(`${o.id}: ugyldig packageType`); continue; }

  const nights = o.nights ?? c.nights;
  const flightTxt = o.flight ? ` Fly: ${o.flight}.` : '';
  const soloNote = `Billigste afrejsedag, vi fandt i Sembos priskalender, for 1 rejsende${o.roomType ? ` (${o.roomType})` : ''}${o.hotelName ? `, hotel: ${o.hotelName}` : ''}.${flightTxt} Prisen er et øjebliksbillede og kan ændre sig, før du booker.`;
  const patch = {
    departureDate: o.departureDate, nights, days: nights + 1, board: o.board ?? null,
    soloType: 'soegepris', soloPriceDKK: Math.round(o.price), soloPriceBasis: 'search', priceIsFrom: true,
    soloNote, sourceUrl: p.trackingUrl, priceCheckedDate: o.checkedDate,
    flightIncluded: c.packageType === 'Fly + hotel',
  };
  const i = trips.findIndex((t) => t.id === o.id);
  if (i >= 0) {
    const old = trips[i].soloPriceDKK;
    Object.assign(trips[i], patch);
    for (const k of ['description', 'highlights', 'includes']) if (o[k] != null) trips[i][k] = o[k];
    log.updated.push(`${o.id}: ${old} -> ${patch.soloPriceDKK} kr. (${o.departureDate})`);
  } else {
    if (!o.description) { log.skipped.push(`${o.id}: ny rejse kræver description`); continue; }
    trips.push({
      id: c.id, operator: 'Sembo',
      title: `${c.name} – ${c.packageType === 'Kun hotel' ? 'hotel' : 'fly og hotel'}, ${nights} nætter`,
      country: c.country, destination: c.name, tripType: c.tripType, packageType: c.packageType,
      alternativeDepartures: [], pricePerPersonDoubleDKK: null, singleSupplementDKK: null,
      guide: null, groupSize: null,
      includes: o.includes ?? [], excludes: [], highlights: o.highlights ?? [], itinerary: [],
      description: o.description, terms: 'Pris og ledighed skifter dag for dag. Vilkår (fx ikke-refunderbar) vises i Sembos bookingflow.',
      ...patch,
    });
    log.created.push(`${o.id}: ${patch.soloPriceDKK} kr. (${o.departureDate})`);
  }
}
// Headerbillede fra Sembos feed (promotionsbillede for destinationen). Gemmes på rejsen, så fetch-images ikke overskriver det.
for (const t of trips) {
  if (t.operator !== 'Sembo') continue;
  const p = feed.get(cands.find((x) => x.id === t.id)?.sku);
  if (p?.imageUrl) t.imageUrl = p.imageUrl;
}
trips.sort((a, b) => (a.departureDate || '9999').localeCompare(b.departureDate || '9999') || a.title.localeCompare(b.title, 'da'));
writeFileSync(tripsPath, JSON.stringify(trips, null, 2) + '\n');
console.log(JSON.stringify(log, null, 2));
