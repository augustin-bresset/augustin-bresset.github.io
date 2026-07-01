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
