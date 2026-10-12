// worlds.js — the four WORLDS the top selector cycles through. Each is a full,
// distinct generation you fly into (NOT a reskin of the island): picking one
// regenerates everything and sets its own ambiance. This replaces the old split of a
// "theme" toggle (ambiance) + a hidden ?mode= (generation) — both fold into ?world=.
//
//   island   — the default grounded island, on the sea (warm diorama ambiance)
//   floating — the archipelago: separate islands adrift in the sky (diorama)
//   croquis  — an ENDLESS hand-drawn sky you fly through: pencil clouds + airships on
//              paper (its own generator, src/croquis.js; pale sketch ambiance)
//   land     — the big endless continent (diorama), heavier to load
export const WORLDS = [
  { key: 'island',   mode: 'island',   ambiance: 'diorama', name: { fr: 'Île', en: 'Island' } },
  { key: 'floating', mode: 'floating', ambiance: 'diorama', name: { fr: 'Île volante', en: 'Flying island' } },
  { key: 'croquis',  croquis: true,    ambiance: 'sketch',  name: { fr: 'Croquis', en: 'Croquis' } },
  { key: 'land',     mode: 'land',     ambiance: 'diorama', name: { fr: 'Terres', en: 'Lands' } },
];

const BY_KEY = Object.fromEntries(WORLDS.map((w) => [w.key, w]));

// Resolve the active world from the URL (?world=, with a legacy ?mode= fallback).
export function resolveWorld(qp) {
  const w = qp.get('world');
  if (w && BY_KEY[w]) return BY_KEY[w];
  const m = qp.get('mode');                 // legacy deep-links (?mode=floating|land)
  if (m && BY_KEY[m]) return BY_KEY[m];
  return BY_KEY.island;
}

export function nextWorld(key) {
  const i = WORLDS.findIndex((w) => w.key === key);
  return WORLDS[(i + 1) % WORLDS.length];
}

export function worldName(world, lang) {
  return world.name[lang] || world.name.en;
}

// The CLIMATES an island can have — the macro trend its generation rolled (see
// gen/biomeGrowth.js TRENDS): which biomes spread, how tall the massif stands, where
// the snow line runs, what grows. The button beside the world selector names the one
// on show and moves on to the next.
export const CLIMATES = [
  { key: 'balanced', name: { fr: 'Tempéré', en: 'Temperate' } },
  { key: 'alpine', name: { fr: 'Alpin', en: 'Alpine' } },
  { key: 'tropical', name: { fr: 'Tropical', en: 'Tropical' } },
  { key: 'arid', name: { fr: 'Aride', en: 'Arid' } },
  { key: 'autumn', name: { fr: 'Automnal', en: 'Autumn' } },
  { key: 'boreal', name: { fr: 'Boréal', en: 'Boreal' } },
  { key: 'highlands', name: { fr: 'Hautes terres', en: 'Highlands' } },
  { key: 'verdant', name: { fr: 'Verdoyant', en: 'Verdant' } },
  { key: 'prairie', name: { fr: 'Prairie', en: 'Prairie' } },
];
export function climateName(key, lang) {
  const c = CLIMATES.find((k) => k.key === key) || CLIMATES[0];
  return c.name[lang] || c.name.en;
}
export function nextClimate(key) {
  const i = CLIMATES.findIndex((k) => k.key === key);
  return CLIMATES[(i + 1) % CLIMATES.length].key;
}

// The RELIEFS — the shape an island's mountains take (gen/relief.js), in order from the
// roundest to the sharpest, then the three that are something else again.
export const RELIEFS = [
  { key: 'domes', name: { fr: 'Ballons', en: 'Domes' } },
  { key: 'crests', name: { fr: 'Crêtes', en: 'Crests' } },
  { key: 'needles', name: { fr: 'Aiguilles', en: 'Needles' } },
  { key: 'tables', name: { fr: 'Tepuis', en: 'Tablelands' } },
  { key: 'towers', name: { fr: 'Pitons', en: 'Stone towers' } },
  { key: 'volcano', name: { fr: 'Volcan', en: 'Volcano' } },
];
export function reliefName(key, lang) {
  const r = RELIEFS.find((k) => k.key === key) || RELIEFS[1];
  return r.name[lang] || r.name.en;
}
export function nextRelief(key) {
  const i = RELIEFS.findIndex((k) => k.key === key);
  return RELIEFS[(i + 1) % RELIEFS.length].key;
}
