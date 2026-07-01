// themes.js — the visual THEME layer the whole scene reads from. Pure data (no
// Three, so gen/ tests can import biomes.js which reads ACTIVE without pulling in a
// renderer). `ACTIVE` is a single mutable object; `setTheme` copies a preset into it
// in place, so modules that hold a reference to ACTIVE see the change. Geometry isn't
// rebuilt on a theme switch — terrain re-colours its vertex buffer, materials/lights/
// fog/exposure update in place, and the ink outline + paper overlay toggle.

export const THEMES = {
  // the default painted low-poly diorama (the look built so far)
  diorama: {
    key: 'diorama', name: 'Diorama', label: '✎',
    sky: ['#d7cab2', '#e6dcc7', '#efe6d4'],
    fog: '#ece3d0', fogNear: 560, fogFar: 1400,
    hemiSky: '#fdf6e6', hemiGround: '#7a6a50', hemiInt: 0.78,
    sunColor: '#fff1d6', sunInt: 1.12, sunShadow: true,
    ambient: '#5a4a36', ambientInt: 0.42,
    exposure: 0.98,
    paperLerp: 0.17, paperTone: '#cabfa6',
    water: '#3f7e96', waterFloor: '#244e5e', waterOpacity: 0.9,
    outline: false, outlineStrength: 0.0, ink: '#2a1808',
    desat: 0, wash: 0, washTone: '#efe9db',
    bodyClass: '',
  },
  // a pale pencil-and-wash CROQUIS: washed-out colours, soft flat light, ink edges,
  // heavy paper grain — a page from a sketchbook.
  sketch: {
    key: 'sketch', name: 'Croquis', label: '❖',
    sky: ['#e9ebe6', '#f1f0ea', '#f6f4ee'],   // pale paper
    fog: '#eeece2', fogNear: 500, fogFar: 1180,
    hemiSky: '#ffffff', hemiGround: '#d8cfbe', hemiInt: 1.12,  // flat & bright
    sunColor: '#fff8ec', sunInt: 0.5, sunShadow: true,          // faint → soft shadows
    ambient: '#cdc4b0', ambientInt: 0.72,
    exposure: 1.22,                            // washed out, brighter paper
    paperLerp: 0.57, paperTone: '#e4ddcd',     // strong pale wash
    water: '#b4c6c9', waterFloor: '#9fb2b4', waterOpacity: 0.82,
    outline: true, outlineStrength: 0.9, ink: '#4a4034',        // pencil, not harsh black
    desat: 0.55, wash: 0.16, washTone: '#efe9db',              // whole-frame croquis wash
    bodyClass: 'theme-sketch',
  },
};

export const THEME_ORDER = ['diorama', 'sketch'];

// the live active theme — mutated in place by setTheme so holders stay in sync
export const ACTIVE = { ...THEMES.diorama };

export function setTheme(key) {
  Object.assign(ACTIVE, THEMES[key] || THEMES.diorama);
  return ACTIVE;
}

export function nextThemeKey(key) {
  const i = THEME_ORDER.indexOf(key);
  return THEME_ORDER[(i + 1) % THEME_ORDER.length];
}
