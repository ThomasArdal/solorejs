// Fælles regler for feltet "Opbygning" (packageType), brugt af merge.mjs og build.mjs.
//   Fly + hotel        – fly og hotel i én pakke (fx Spies, Sembo fly+hotel)
//   Kun hotel          – kun overnatning, man kommer selv derhen (fx Sembo hotel)
//   Arrangeret rejse   – rundrejse, krydstogt, busrejse, gruppe m.m.
export const PACKAGES = ['Fly + hotel', 'Kun hotel', 'Arrangeret rejse'];

// Udleder opbygning, når feltet mangler eller er ugyldigt.
export function derivePackageType(t) {
  if (PACKAGES.includes(t.packageType)) return t.packageType;
  if (['Solferie', 'Citytrip'].includes(t.tripType) && t.flightIncluded === true) return 'Fly + hotel';
  return 'Arrangeret rejse';
}
