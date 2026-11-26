// Genererer delingsbilleder (og/*.png, 1200x630) og ikoner (PNG) med headless Chrome/Edge.
// Samme farveforløb og emoji som kortene på forsiden, så rejser uden eget billede får et pænt delingskort.
// Kør kun når designet ændres:  node tools/make-og-images.mjs   (resultatet committes; build.mjs bruger bare filerne)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) throw new Error('Hverken Chrome eller Edge fundet');

// Skal matche TYPE_ICON / TYPE_GRAD i build.mjs
const TYPES = {
  rundrejse: ['Rundrejse', '🗺️', '#e8794a', '#7a4a6b'],
  solferie: ['Solferie', '🏖️', '#f6a96b', '#e8794a'],
  citytrip: ['Citytrip', '🏙️', '#7a4a6b', '#1f5f6b'],
  krydstogt: ['Krydstogt', '🚢', '#1f5f6b', '#17484f'],
  'aktiv-vandring': ['Aktiv & vandring', '🥾', '#5c8a5a', '#1f5f6b'],
  'kultur-historie': ['Kultur & historie', '🏛️', '#b44a26', '#7a4a6b'],
  busrejse: ['Busrejse', '🚌', '#d9a23a', '#b44a26'],
  andet: ['Rejse', '✈️', '#1f5f6b', '#7a4a6b'],
  default: ['Rejs alene. Aldrig ensom.', '🧭', '#d9643a', '#1f5f6b'],
};

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@500;600&display=swap" rel="stylesheet">';
const card = (label, icon, g1, g2, isDefault) => `<!doctype html><meta charset="utf-8">${FONTS}
<style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;overflow:hidden;background:linear-gradient(135deg,${g1},${g2});font-family:Inter,sans-serif;color:#fff;position:relative}
  .icon{position:absolute;right:90px;top:50%;transform:translateY(-52%);font-size:300px;line-height:1;filter:drop-shadow(0 12px 24px rgba(0,0,0,.25))}
  .txt{position:absolute;left:90px;top:50%;transform:translateY(-50%);max-width:640px}
  .logo{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:${isDefault ? 120 : 84}px;line-height:1.05;letter-spacing:-1px}
  .logo span{opacity:.8}
  .tag{margin-top:28px;font-size:${isDefault ? 42 : 40}px;font-weight:600;line-height:1.25;opacity:.95}
  .url{position:absolute;left:90px;bottom:60px;font-size:28px;font-weight:500;opacity:.8}
</style>
<div class="txt"><div class="logo">Solo<span>Rejs</span></div><div class="tag">${isDefault ? label : `${label} for dig, der rejser alene`}</div></div>
<div class="icon">${icon}</div><div class="url">solorejs.dk</div>`;

const icon = (size, bg) => `<!doctype html><meta charset="utf-8"><style>*{margin:0}body{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg};overflow:hidden}
div{font-size:${Math.round(size * 0.68)}px;line-height:1;font-family:'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif}</style><div>🧭</div>`;

const tmp = mkdtempSync(join(tmpdir(), 'solorejs-og-'));
function shot(html, out, w, h, transparent = false) {
  const f = join(tmp, 'p.html');
  writeFileSync(f, html);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, '--virtual-time-budget=8000',
    ...(transparent ? ['--default-background-color=00000000'] : []),
    `--screenshot=${out}`, pathToFileURL(f).href,
  ], { stdio: 'ignore' });
  console.log('skrev', out.replace(root, '.'));
}

for (const [slug, [label, ic, g1, g2]] of Object.entries(TYPES)) {
  shot(card(label, ic, g1, g2, slug === 'default'), join(root, 'og', `${slug}.png`), 1200, 630);
}
// Ikoner: apple-touch-icon skal være ugennemsigtigt (iOS); de øvrige har creme-baggrund som siden
shot(icon(180, '#fbf6ee'), join(root, 'apple-touch-icon.png'), 180, 180);
for (const s of [32, 192, 512]) shot(icon(s, '#fbf6ee'), join(root, `favicon-${s}x${s}.png`), s, s);

writeFileSync(join(root, 'site.webmanifest'), JSON.stringify({
  name: 'SoloRejs', short_name: 'SoloRejs', lang: 'da', start_url: '/', display: 'browser',
  theme_color: '#d9643a', background_color: '#fbf6ee',
  icons: [{ src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' }, { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' }],
}, null, 2) + '\n');
rmSync(tmp, { recursive: true, force: true });
