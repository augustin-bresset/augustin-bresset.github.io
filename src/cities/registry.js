// registry.js — the stable project "cities". EXTENSIBLE: to add a project,
// append one entry + write its builder + give it biome affinity and link
// distances. Positions are chosen at load time (placement.js) from these hints:
// linked projects end up near each other, others spread out.
import { build as buildApairo } from './apairo.js';
import { build as buildToaster } from './toaster.js';
import { build as buildSplasher } from './splasher.js';
import { build as buildAbout } from './about.js';

export const CITIES = [
  {
    // modern data-factory by the sea (apéro on the beach) → coastal lowland.
    // Weighted affinity: strongly prefers the shore (beach) over inland plains so
    // it actually settles by the water (see also the coastal bonus in placement.js).
    id: 'apairo', build: buildApairo, radius: 80,   // the flagship metropolis — by far the biggest pad
    affinity: { beach: 1.0, plains: 0.5, savanna: 0.45 },
  },
  {
    // neon forge → barren scrubland, drawn to the lone volcano (see placement.js)
    id: 'toaster', build: buildToaster, radius: 50,
    affinity: ['plains', 'savanna', 'desert'],
  },
  {
    // BEV / water-sensor lab → wetlands & shoreline
    id: 'splasher', build: buildSplasher, radius: 40,
    affinity: ['marsh', 'beach', 'plains'],
  },
  {
    // Augustin's wind-inventor town (l'Arbre de Transmission) → high, breezy ground
    id: 'about', build: buildAbout, radius: 48,
    affinity: ['hills', 'mountain', 'forest'],
  },
];

// Desired distance (world units) between linked projects. Smaller = closer.
// Toaster & Splasher are tightly linked; Apairo a bit further (shared deps);
// About sits apart (the personal study). Unlisted pairs default to FAR.
// NOTE: keys MUST be alphabetically sorted (desiredDist sorts the pair before
// lookup) — 'splasher|toaster', not 'toaster|splasher'.
const linkKey = (a, b) => [a, b].sort().join('|');
export const LINKS = {
  [linkKey('toaster', 'splasher')]: 165,
  [linkKey('apairo', 'toaster')]: 320,
  [linkKey('apairo', 'splasher')]: 340,
};
export const LINK_FAR = 460;

// placement order: tightly-linked projects first so the rest arrange around them
export const PLACE_ORDER = ['toaster', 'splasher', 'apairo', 'about'];

export function desiredDist(a, b) {
  if (a === b) return 0;
  return LINKS[linkKey(a, b)] ?? LINK_FAR;
}
