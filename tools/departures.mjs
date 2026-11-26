// Afrejser pr. rejse: departures = [{ date: 'YYYY-MM-DD', priceDKK: tal|null }] (alle åbne, fremtidige afrejser med egen solopris).
// Rejsens hovedpris/-dato (departureDate/soloPriceDKK) er altid den billigste afrejse med kendt pris (tidligste ved lighed).
// Ældre rejser uden departures bruger departureDate + alternativeDepartures (datoer uden pris) som før.
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function applyDepartures(t, today) {
  const hasList = Array.isArray(t.departures) && t.departures.length > 0;
  let list = hasList
    ? t.departures
    : [
        ...(t.departureDate ? [{ date: t.departureDate, priceDKK: t.soloPriceDKK ?? null }] : []),
        ...(t.alternativeDepartures || []).filter(Boolean).map((date) => ({ date, priceDKK: null })),
      ];
  const seen = new Map();
  for (const d of list) {
    if (!d || !ISO.test(d.date || '') || d.date <= today) continue;
    const price = typeof d.priceDKK === 'number' && d.priceDKK >= 0 ? d.priceDKK : null;
    const prev = seen.get(d.date);
    if (!prev || (price != null && (prev.priceDKK == null || price < prev.priceDKK))) seen.set(d.date, { date: d.date, priceDKK: price });
  }
  list = [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  t.departureList = list;
  const priced = list.filter((d) => d.priceDKK != null);
  t.priceSpread = new Set(priced.map((d) => d.priceDKK)).size > 1; // flere afrejser med forskellig pris
  if (hasList && list.length) {
    const best = priced.length ? priced.reduce((a, b) => (b.priceDKK < a.priceDKK ? b : a)) : list[0];
    t.departureDate = best.date;
    if (priced.length) t.soloPriceDKK = best.priceDKK;
  }
  if (t.priceSpread) t.priceIsFrom = true; // vises som "fra X kr."
  return t;
}
