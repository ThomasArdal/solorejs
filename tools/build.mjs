// Statisk site-generator for SoloRejs.
// Læser data/trips.json og skriver index.html + rejse/<id>/index.html + sitemap.xml.
// Kør:  node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PACKAGES, derivePackageType } from './package-type.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Versionsparameter på css/js, så browsere (og CDN'et, max-age 4 timer) henter nye udgaver med det samme
const ver = (f) => createHash('md5').update(readFileSync(join(root, f))).digest('hex').slice(0, 8);
const trips = JSON.parse(readFileSync(join(root, 'data', 'trips.json'), 'utf8'));
const FLYHJAELP_URL = 'https://dot.flyhjaelp.dk/t/t?a=1876544746&as=2126866054&t=2&tk=1'; // Adtraction tracking-link
const FLYBILLET_URL = 'https://go.adt212.net/t/t?a=1927268633&as=2126866054&t=2&tk=1'; // Adtraction tracking-link
const SITE_URL ='https://solorejs.dk'; // bruges kun i sitemap (matcher CNAME)

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (n) => (n == null ? null : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(n) + ' kr.');
const dato = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  iso ? new Intl.DateTimeFormat('da-DK', opts).format(new Date(iso + 'T12:00:00')) : null;

const SOLO = {
  'ingen-tillaeg': { label: 'Uden enkeltværelsestillæg', cls: 'good' },
  'solo-gruppe': { label: 'Kun for solorejsende', cls: 'good' },
  'reduceret-tillaeg': { label: 'Reduceret tillæg', cls: 'mid' },
  tillaeg: { label: 'Med tillæg', cls: 'plain' },
  soegepris: { label: 'Pris for 1 rejsende', cls: 'plain' },
  ukendt: { label: 'Solopris ikke oplyst', cls: 'plain' },
};
const TYPE_ICON = { Rundrejse: '🗺️', Solferie: '🏖️', Citytrip: '🏙️', Krydstogt: '🚢', 'Aktiv & vandring': '🥾', 'Kultur & historie': '🏛️', Busrejse: '🚌', Andet: '✈️' };
// Farvegradient pr. rejsetype, så kortene ser ud af noget uden billeder
const TYPE_GRAD = {
  Rundrejse: ['#e8794a', '#7a4a6b'], Solferie: ['#f6a96b', '#e8794a'], Citytrip: ['#7a4a6b', '#1f5f6b'],
  Krydstogt: ['#1f5f6b', '#17484f'], 'Aktiv & vandring': ['#5c8a5a', '#1f5f6b'], 'Kultur & historie': ['#b44a26', '#7a4a6b'],
  Busrejse: ['#d9a23a', '#b44a26'], Andet: ['#1f5f6b', '#7a4a6b'],
};

// Billeder (hotlinket preview – se tools/fetch-images.mjs). Frasorter dem der ser forkerte ud.
const images = existsSync(join(root, 'data', 'images.json')) ? JSON.parse(readFileSync(join(root, 'data', 'images.json'), 'utf8')) : {};
const imgOf = (t) => t.imageUrl || images[t.id]; // imageUrl (fx Sembo-feedet) går forud for hotlinket og:image
const countriesByImg = {};
for (const t of trips) if (imgOf(t)) (countriesByImg[imgOf(t)] ??= new Set()).add(t.country);
for (const t of trips) {
  const u = imgOf(t);
  const bad = !u || u.endsWith('/undefined') || countriesByImg[u].size > 1 || /skiathos/i.test(u);
  t.image = bad ? null : u;
}

// Beregn solo-tillæg i % hvor vi har begge priser
for (const t of trips) {
  t.premiumPct = t.soloPriceDKK && t.pricePerPersonDoubleDKK
    ? Math.round(((t.soloPriceDKK - t.pricePerPersonDoubleDKK) / t.pricePerPersonDoubleDKK) * 100) : null;
  t.packageType = derivePackageType(t);
  // Flybillet-boks: sæt needsFlight i trips.json for at tvinge til/fra. Standard: krydstogter, hvor flyet ikke er oplyst (man skal selv til havnen)
  t.needsFlight = t.needsFlight ?? (t.tripType === 'Krydstogt' && t.flightIncluded == null);
  t.icon = TYPE_ICON[t.tripType] || '✈️';
  t.grad = TYPE_GRAD[t.tripType] || TYPE_GRAD.Andet;
}

const head = (title, desc, css, extra = '') => `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="website">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🧭%3C/text%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${css}">${extra}
</head>`;

const header = (base) => `<header class="top">
  <a class="logo" href="/">Solo<span>Rejs</span></a>
  <nav><a href="/#rejser">Alle rejser</a><a href="/guides/">Guides</a><a href="/#om">Om siden</a></nav>
</header>`;

const footer = () => `<footer>
  <p>Priser og vilkår hentes fra rejseudbydernes egne hjemmesider og kan have ændret sig. Tjek altid den endelige pris hos udbyderen, før du booker.</p>
  <p>Siden indeholder annoncer og links, hvor vi får en kommission, hvis du køber hos udbyderen. Det koster dig ikke noget.</p>
  <p>&copy; <span id="year">2026</span> SoloRejs</p>
  <script>document.getElementById('year').textContent = new Date().getFullYear();</script>
</footer>`;

// ---------- Forside ----------
const countries = [...new Set(trips.map((t) => t.country))].sort((a, b) => a.localeCompare(b, 'da'));
const types = [...new Set(trips.map((t) => t.tripType))].sort((a, b) => a.localeCompare(b, 'da'));
const packages = PACKAGES.filter((p) => trips.some((t) => t.packageType === p));
const operators = [...new Set(trips.map((t) => t.operator))].sort((a, b) => a.localeCompare(b, 'da'));
const boards = [...new Set(trips.map((t) => t.board).filter(Boolean))];
const prices = trips.map((t) => t.soloPriceDKK).filter((p) => p != null);
const maxPrice = prices.length ? Math.ceil(Math.max(...prices) / 1000) * 1000 : 50000;
const months = [...new Set(trips.map((t) => t.departureDate?.slice(0, 7)).filter(Boolean))].sort();

const checks = (name, values, countFn) => values.map((v) => `
        <label class="chk"><input type="checkbox" name="${name}" value="${esc(v)}"><span>${esc(v)}</span><em>${countFn(v)}</em></label>`).join('');

// Kun det filtrering/visning behøver — detaljer ligger på den enkelte rejsesides
const slim = trips.map((t) => ({
  id: t.id, title: t.title, operator: t.operator, country: t.country, destination: t.destination, type: t.tripType, pkg: t.packageType,
  date: t.departureDate, nights: t.nights, days: t.days, board: t.board, solo: t.soloType, price: t.soloPriceDKK,
  from: !!t.priceIsFrom, dbl: t.pricePerPersonDoubleDKK, sup: t.singleSupplementDKK, pct: t.premiumPct,
  guide: t.guide, icon: t.icon, grad: t.grad, note: t.soloNote, img: t.image,
}));

const indexHtml = `${head('SoloRejs – rejser til dig, der rejser alene', 'Find rejser uden eller med lavt enkeltværelsestillæg. Sammenlign solopriser fra danske rejseudbydere på ét sted.', `styles.css?v=${ver('styles.css')}`)}
<body>
${header('')}
<main>
  <section class="intro">
    <p class="eyebrow">Rejs alene. Aldrig ensom.</p>
    <h1>Rejser til dig, der rejser <em>solo</em></h1>
    <p class="lead">Vi samler rejser fra danske udbydere og viser, hvad du faktisk betaler som solorejsende – og hvor meget ekstra det koster at rejse alene.</p>
  </section>

  <section id="rejser" class="finder">
    <button class="filter-toggle" id="filterToggle" aria-expanded="false" aria-controls="filters">Filtre <span id="activeCount"></span></button>

    <aside class="filters" id="filters" aria-label="Filtre">
      <div class="filters-head"><h2>Filtrér rejser</h2><button type="button" class="link" id="reset">Nulstil</button></div>

      <div class="f-group">
        <label class="f-title" for="q">Søg</label>
        <input id="q" type="search" placeholder="Land, by eller rejsenavn" autocomplete="off">
      </div>

      <div class="f-group">
        <span class="f-title">Solo-vilkår</span>
        <label class="chk"><input type="checkbox" id="onlyNoSup"><span>Kun uden/reduceret tillæg</span></label>
        <label class="chk"><input type="checkbox" id="onlyPrice"><span>Kun rejser med oplyst solopris</span></label>
      </div>

      <div class="f-group">
        <span class="f-title">Afrejse</span>
        <div class="row2">
          <label>Fra<input type="date" id="dFrom"></label>
          <label>Til<input type="date" id="dTo"></label>
        </div>
        <div class="months" id="months">${months.map((m) => `<button type="button" class="chip" data-m="${m}">${esc(dato(m + '-01', { month: 'short', year: 'numeric' }))}</button>`).join('')}</div>
      </div>

      <div class="f-group">
        <label class="f-title" for="pmax">Maks. solopris: <strong id="pmaxVal"></strong></label>
        <input id="pmax" type="range" min="0" max="${maxPrice}" step="500" value="${maxPrice}">
      </div>

      <div class="f-group">
        <span class="f-title">Varighed</span>
        <div class="chips" id="dur">
          <button type="button" class="chip" data-d="0-4">1–4 nætter</button>
          <button type="button" class="chip" data-d="5-8">5–8</button>
          <button type="button" class="chip" data-d="9-14">9–14</button>
          <button type="button" class="chip" data-d="15-999">15+</button>
        </div>
      </div>

      <div class="f-group"><span class="f-title">Opbygning</span>${checks('pkg', packages, (v) => trips.filter((t) => t.packageType === v).length)}</div>
      <div class="f-group"><span class="f-title">Rejsetype</span>${checks('type', types, (v) => trips.filter((t) => t.tripType === v).length)}</div>
      <div class="f-group"><span class="f-title">Land</span><div class="scroll">${checks('country', countries, (v) => trips.filter((t) => t.country === v).length)}</div></div>
      ${boards.length ? `<div class="f-group"><span class="f-title">Forplejning</span>${checks('board', boards, (v) => trips.filter((t) => t.board === v).length)}</div>` : ''}
      <div class="f-group"><span class="f-title">Rejseudbyder</span><div class="scroll">${checks('operator', operators, (v) => trips.filter((t) => t.operator === v).length)}</div></div>
    </aside>

    <div class="results">
      <div class="bar">
        <p id="count" aria-live="polite"></p>
        <label>Sortér
          <select id="sort">
            <option value="date" selected>Afrejse (tidligst)</option>
            <option value="price">Solopris (lavest)</option>
            <option value="nights">Varighed (længst)</option>
          </select>
        </label>
      </div>
      <div id="grid" class="grid"></div>
      <p id="empty" class="empty" hidden>Ingen rejser matcher dine filtre. <button class="link" type="button" id="reset2">Nulstil filtre</button></p>
    </div>
  </section>

  <section id="om" class="about">
    <h2>Om SoloRejs</h2>
    <p>At rejse alene handler ikke om at være alene. Det handler om at tage dine egne valg, møde nye mennesker og komme hjem som en lidt anden udgave af dig selv.</p>
    <p>Men enkeltværelsestillægget kan gøre det dyrt. Her samler vi rejser og viser den samlede solopris, så du kan sammenligne på tværs af udbydere.</p>
    <p>Vi sælger ikke rejser selv. Når du klikker videre, kommer du til udbyderens egen hjemmeside, hvor du booker og får den endelige pris og de fulde rejsevilkår. Siden kan indeholde links, hvor vi får en kommission – det koster dig ikke noget.</p>
  </section>
</main>
${footer()}
<script>
const TRIPS = ${JSON.stringify(slim)};
const SOLO = ${JSON.stringify(Object.fromEntries(Object.entries(SOLO).map(([k, v]) => [k, v])))};
</script>
<script src="app.js?v=${ver('app.js')}"></script>
</body>
</html>
`;

// ---------- Detaljesider ----------
const list = (items) => (items?.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');

function detail(t) {
  const solo = SOLO[t.soloType] || SOLO.ukendt;
  const priceLabel = t.soloPriceDKK != null ? `${t.priceIsFrom ? 'fra ' : ''}${kr(t.soloPriceDKK)}` : 'Pris oplyses hos udbyder';
  const facts = [
    ['Afrejse', dato(t.departureDate)],
    ['Varighed', t.nights ? `${t.nights} nætter${t.days ? ` / ${t.days} dage` : ''}` : (t.days ? `${t.days} dage` : null)],
    ['Land', t.country], ['Destination', t.destination], ['Rejsetype', t.tripType], ['Opbygning', t.packageType], ['Forplejning', t.board],
    ['Rejseleder', t.guide], ['Gruppestørrelse', t.groupSize],
    ['Fly inkluderet', t.flightIncluded == null ? null : (t.flightIncluded ? 'Ja' : 'Nej')],
  ].filter(([, v]) => v);
  const alt = (t.alternativeDepartures || []).filter(Boolean);
  const priceRows = [
    ['Solopris (1 person)', t.soloPriceDKK != null ? priceLabel : null],
    ['Pris pr. person ved 2 rejsende', kr(t.pricePerPersonDoubleDKK)],
    ['Enkeltværelsestillæg', t.singleSupplementDKK != null ? (t.singleSupplementDKK === 0 ? 'Ingen' : kr(t.singleSupplementDKK)) : null],
    ['Merpris for at rejse alene', t.premiumPct != null ? `${t.premiumPct > 0 ? '+' : ''}${t.premiumPct} %` : null],
  ].filter(([, v]) => v);
  const desc = (t.description || '').slice(0, 155);

  return `${head(`${t.title} – SoloRejs`, desc, `/styles.css?v=${ver('styles.css')}`)}
<body class="detail">
${header('../')}
<main class="wrap">
  <nav class="crumbs" aria-label="Brødkrumme"><a href="/">Alle rejser</a> › <span>${esc(t.country)}</span></nav>

  <div class="d-hero${t.image ? ' has-img' : ''}" style="--g1:${t.grad[0]};--g2:${t.grad[1]}">
    ${t.image ? `<img class="d-img" src="${esc(t.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();this.parentNode.classList.remove('has-img')">` : ''}
    <span class="d-icon" aria-hidden="true">${t.icon}</span>
    <div>
      <p class="op">${esc(t.operator)} · ${esc(t.tripType)}</p>
      <h1>${esc(t.title)}</h1>
      <span class="solo ${solo.cls}">${solo.label}</span>
    </div>
  </div>

  <div class="d-grid">
    <div class="d-main">
      <p class="d-desc">${esc(t.description)}</p>
      ${t.soloNote ? `<div class="callout"><strong>For solorejsende:</strong> ${esc(t.soloNote)}</div>` : ''}
      ${t.highlights?.length ? `<h2>Højdepunkter</h2>${list(t.highlights)}` : ''}
      ${t.itinerary?.length ? `<h2>Programmet</h2><ol class="itin">${t.itinerary.map((i) => `<li><strong>${esc(i.day)}</strong> ${esc(i.title)}</li>`).join('')}</ol>` : ''}
      <div class="two">
        ${t.includes?.length ? `<div><h2>Inkluderet</h2>${list(t.includes)}</div>` : ''}
        ${t.excludes?.length ? `<div><h2>Ikke inkluderet</h2>${list(t.excludes)}</div>` : ''}
      </div>
      ${t.needsFlight ? `<p>Skal du selv til afrejsestedet? <a href="${FLYBILLET_URL}" target="_blank" rel="sponsored noopener noreferrer">Sammenlign flypriser hos Flybillet.dk</a>.</p>` : ''}
      ${t.terms ? `<h2>Vilkår</h2><p>${esc(t.terms)}</p>` : ''}
    </div>

    <aside class="d-side">
      <div class="box">
        <p class="small">Solopris</p>
        <p class="bigprice">${priceLabel}</p>
        <dl class="pricing">${priceRows.slice(1).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <a class="cta" href="${esc(t.sourceUrl)}" target="_blank" rel="sponsored noopener noreferrer">Se rejsen hos ${esc(t.operator)} →</a>
        <p class="fine">Pris tjekket ${esc(dato(t.priceCheckedDate) || '')}. Den endelige pris og ledige pladser bekræftes hos udbyderen.</p>
      </div>
      <aside class="box ad" aria-label="Annonce">
        <p class="ad-label">Annonce</p>
        <h2>Forsinket eller aflyst fly?</h2>
        <p class="ad-text">Rejser du alene, står du selv med sagen, hvis flyet bliver forsinket, aflyst eller overbooket. Flyhjælp tager kravet for dig, og du betaler kun, hvis du får udbetalt erstatning.</p>
        <a class="cta ghost" href="${FLYHJAELP_URL}" target="_blank" rel="sponsored noopener noreferrer">Tjek dit krav hos Flyhjælp →</a>
      </aside>
      <div class="box">
        <h2>Fakta</h2>
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${alt.length ? `<p class="small">Flere afrejser: ${alt.map((d) => esc(dato(d, { day: 'numeric', month: 'short', year: 'numeric' }))).join(', ')}</p>` : ''}
      </div>
    </aside>
  </div>
</main>
${footer()}
</body>
</html>
`;
}

// ---------- Guides (content/guides/*.md) ----------
const inline = (t) => esc(t)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => {
    const u = url.replace(/&amp;/g, '&');
    return /^https?:/.test(u) ? `<a href="${esc(u)}" target="_blank" rel="sponsored noopener noreferrer">${txt}</a>` : `<a href="${esc(u)}">${txt}</a>`;
  });
function md(src) {
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of src.split('\n')) {
    let m;
    if ((m = line.match(/^## (.+)/))) { close(); out.push(`<h2>${inline(m[1])}</h2>`); }
    else if ((m = line.match(/^- (.+)/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = line.match(/^\d+\. (.+)/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if (line.trim()) { close(); out.push(`<p>${inline(line)}</p>`); }
    else close();
  }
  close(); return out.join('\n');
}
const gdir = join(root, 'content', 'guides');
const guides = existsSync(gdir) ? readdirSync(gdir).filter((f) => f.endsWith('.md')).map((f) => {
  const raw = readFileSync(join(gdir, f), 'utf8').replace(/\r\n/g, '\n');
  const [, fm, body] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = Object.fromEntries(fm.split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
  return { slug: f.replace(/\.md$/, ''), ...meta, order: Number(meta.order) || 99, body };
}).sort((a, b) => a.order - b.order) : [];

const guidePage = (g) => `${head(`${g.title} – SoloRejs`, g.description, `/styles.css?v=${ver('styles.css')}`)}
<body class="detail">
${header('../')}
<main class="wrap prose">
  <nav class="crumbs" aria-label="Brødkrumme"><a href="/guides/">Guides</a> › <span>${esc(g.title)}</span></nav>
  <h1>${esc(g.title)}</h1>
  ${md(g.body)}
  <p class="back"><a href="/">Se rejser til solorejsende →</a></p>
</main>
${footer()}
</body>
</html>
`;
const guideIndex = `${head('Guides til dig, der rejser alene – SoloRejs', 'Korte guides om enkeltværelsestillæg, første rejse alene og at finde billige rejser som solorejsende.', `/styles.css?v=${ver('styles.css')}`)}
<body class="detail">
${header('../')}
<main class="wrap prose">
  <h1>Guides</h1>
  <p class="d-desc">Korte guides til dig, der rejser alene.</p>
  <ul class="guide-list">
${guides.map((g) => `    <li><a href="/guides/${g.slug}/"><strong>${esc(g.title)}</strong><span>${esc(g.description)}</span></a></li>`).join('\n')}
  </ul>
</main>
${footer()}
</body>
</html>
`;

// ---------- Skriv filer ----------
const outDir = join(root, 'rejse');
if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
for (const t of trips) {
  mkdirSync(join(outDir, t.id), { recursive: true });
  writeFileSync(join(outDir, t.id, 'index.html'), detail(t));
  // Gammel URL (<id>.html) sender videre til den nye mappe-URL
  writeFileSync(join(outDir, `${t.id}.html`), `<!doctype html>
<meta charset="utf-8">
<title>${esc(t.title)}</title>
<link rel="canonical" href="${SITE_URL}/rejse/${t.id}/">
<meta http-equiv="refresh" content="0; url=/rejse/${t.id}/">
<p><a href="/rejse/${t.id}/">Gå til rejsen</a></p>
`);
}
writeFileSync(join(root, 'index.html'), indexHtml);
const gOut = join(root, 'guides');
if (existsSync(gOut)) rmSync(gOut, { recursive: true });
mkdirSync(gOut, { recursive: true });
writeFileSync(join(gOut, 'index.html'), guideIndex);
for (const g of guides) {
  mkdirSync(join(gOut, g.slug), { recursive: true });
  writeFileSync(join(gOut, g.slug, 'index.html'), guidePage(g));
}
writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc></url>\n  <url><loc>${SITE_URL}/guides/</loc></url>\n${guides.map((g) => `  <url><loc>${SITE_URL}/guides/${g.slug}/</loc></url>`).join('\n')}\n${trips.map((t) => `  <url><loc>${SITE_URL}/rejse/${t.id}/</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`Byggede forside + ${trips.length} rejsesider + ${guides.length} guides.`);
