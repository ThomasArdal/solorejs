// Udforsker Adtraction API v3: lister godkendte programmer (DK) og deres feeds.
// Kør:  ADTRACTION_TOKEN=... ADTRACTION_CHANNEL_ID=... node tools/adtraction-discover.mjs [programId]
// Uden programId: lister godkendte programmer + feedinfo.
// Med programId: henter de første produkter fra feedet og viser felterne.
const BASE = 'https://api.adtraction.net/v3';
const token = process.env.ADTRACTION_TOKEN;
const channelId = Number(process.env.ADTRACTION_CHANNEL_ID);
if (!token || !channelId) { console.error('Sæt ADTRACTION_TOKEN og ADTRACTION_CHANNEL_ID'); process.exit(1); }

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'X-Token': token, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return { data: await res.json(), headers: res.headers };
}

const programId = Number(process.argv[2]);
if (!programId) {
  const { data } = await call('POST', '/partner/programs/', { market: 'DK', channelId, approvalStatus: 1 });
  for (const p of data) {
    console.log(`\n#${p.programId} ${p.programName} (${p.currency}) adId=${p.adId}`);
    console.log('  tracking:', p.trackingURL);
    for (const f of p.feeds ?? []) console.log('  feed:', JSON.stringify(f));
  }
  console.log(`\n${data.length} godkendte programmer`);
} else {
  const info = await call('GET', `/partner/products/feedinfo/${programId}/${channelId}/`);
  console.log('Feedinfo:', JSON.stringify(info.data, null, 2));
  const { data, headers } = await call('POST', '/partner/products/feed/', { programId, channelId });
  console.log('count:', headers.get('count'), 'lastupdated:', headers.get('feed_lastupdated'));
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
}
