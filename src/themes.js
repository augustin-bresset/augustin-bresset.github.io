// themes.js — the visual AMBIANCE layer the whole scene reads from. Pure data (no
// Three, so gen/ tests can import biomes.js which reads ACTIVE without pulling in a
// renderer). `ACTIVE` is a single mutable object; `setTheme` copies a preset into it
// in place, so modules that hold a reference to ACTIVE see the change. Geometry isn't
// rebuilt on a theme switch — terrain re-colours its vertex buffer, materials/lights/
// fog/exposure update in place, and the ink outline + hatching + paper overlay toggle.
//
// NOTE: a theme is an AMBIANCE (how the world is drawn), NOT how the terrain is
// generated. The flying island is a *generation mode* (?mode=floating, see world.js),
// not a theme — so any ambiance can be applied to a flying-island world.

export const THEMES = {
  // the default painted low-poly diorama (the warm, sunlit look)
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
    desat: 0, wash: 0, washTone: '#efe9db', hatch: 0,
    bodyClass: '',
  },
  // a full CROQUIS ambiance: the world redrawn as a graphite-and-wash sketchbook
  // page — near-monochrome pencil tones on warm paper, ink silhouettes, and real
  // pencil HATCHING that thickens in the shadows (the post pass does the hatch).
  // Flat, bright paper light so form is carried by line + hatch, not smooth shading.
  sketch: {
    key: 'sketch', name: 'Croquis', label: '✎',
    sky: ['#efece3', '#f4f1e9', '#f8f6f0'],   // flat pale paper
    fog: '#f1eee4', fogNear: 470, fogFar: 1150,
    hemiSky: '#ffffff', hemiGround: '#e2dac9', hemiInt: 1.2,   // flat & bright
    sunColor: '#fffaf0', sunInt: 0.4, sunShadow: true,          // faint → soft shadows
    ambient: '#d3cab6', ambientInt: 0.84,
    exposure: 1.3,                             // washed out, bright paper
    paperLerp: 0.6, paperTone: '#e9e2d3',      // strong pale wash on the terrain
    water: '#c4ccc8', waterFloor: '#adb4b0', waterOpacity: 0.68,
    outline: true, outlineStrength: 1.0, ink: '#372f26',        // graphite, not black
    desat: 0.82, wash: 0.28, washTone: '#efe7d6',             // pale near-monochrome
    hatch: 0.7,                                // pencil cross-hatching in the shadows
    bodyClass: 'theme-sketch',
  },
};

// the live ambiance cycle (the flying island is a generation mode, not here)
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
