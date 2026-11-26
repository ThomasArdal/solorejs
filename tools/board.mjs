// Fælles regler for feltet "Forplejning" (board), brugt af build.mjs, merge.mjs, sembo-upsert.mjs og validate-pr.mjs.
// Kun disse fem værdier må vises i filteret. Detaljer (fx "3 x frokost") hører hjemme i includes[].
//   Ingen måltider  – ingen måltider inkluderet
//   Morgenmad       – kun morgenmad
//   Halvpension     – morgenmad + én hovedmåltid (typisk middag)
//   Helpension      – morgenmad + frokost + middag
//   All inclusive   – alt inkl. drikkevarer/snacks
//   Ukendt          – ikke oplyst, eller teksten kan ikke mappes til ovenstående
export const BOARDS = ['Ingen måltider', 'Morgenmad', 'Halvpension', 'Helpension', 'All inclusive', 'Ukendt'];

// Mapper en fri tekst til en kendt værdi. Tom eller umappelig tekst giver 'Ukendt' (aldrig null/undefined).
export function normalizeBoard(raw) {
  if (raw == null || String(raw).trim() === '') return 'Ukendt';
  const s = String(raw).trim();
  if (BOARDS.includes(s)) return s;
  const l = s.toLowerCase();
  if (/all.?inclusive|ultra/.test(l)) return 'All inclusive';
  if (/^(ingen|uden)\b|ingen måltider|ingen forplejning|self.?catering|kun overnatning/.test(l)) return 'Ingen måltider';
  if (/helpension|fuld pension|full board/.test(l) || (/morgenmad/.test(l) && /frokost/.test(l) && /(middag|aften)/.test(l))) return 'Helpension';
  if (/halvpension|delpension|half board|morgenmad.*(middag|aften)|(middag|aften).*morgenmad/.test(l)) return 'Halvpension';
  if (/morgenmad|breakfast/.test(l)) return 'Morgenmad';
  return 'Ukendt';
}

// True hvis der stod en tekst, som vi ikke kunne genkende (til advarsler)
export const isUnmapped = (raw) => raw != null && String(raw).trim() !== '' && normalizeBoard(raw) === 'Ukendt' && String(raw).trim() !== 'Ukendt';

// Udleder forplejning af includes[] når board mangler/er ukendt (fx "Morgenmad dagligt, frokost dag 1-3 og middag dag 1-5").
// Siger kun noget, når måltider faktisk nævnes; "Ingen måltider" udledes aldrig.
export function inferBoardFromIncludes(includes) {
  const l = (includes || []).join(' | ').toLowerCase();
  if (/all.?inclusive/.test(l)) return 'All inclusive';
  const b = /morgenmad|breakfast/.test(l), lunch = /frokost/.test(l), dinner = /middag|aftensmad|aftensmåltid/.test(l);
  if (b && lunch && dinner) return 'Helpension';
  if (b && (lunch || dinner)) return 'Halvpension';
  if (b) return 'Morgenmad';
  return 'Ukendt';
}

// Samlet regel for en rejse: eksplicit board hvis genkendt, ellers udledt af includes, ellers Ukendt
export function boardFor(t) {
  const b = normalizeBoard(t.board);
  return b !== 'Ukendt' ? b : inferBoardFromIncludes(t.includes);
}
