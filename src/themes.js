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
    paperLerp: 0.17, paperTone: '#cabfa6', pastel: 0,
    water: '#3f7e96', waterFloor: '#244e5e', waterOpacity: 0.9,
    outline: false, outlineStrength: 0.0, ink: '#2a1808',
    desat: 0, wash: 0, washTone: '#efe9db', hatch: 0,
    bodyClass: '',
  },
  // a PASTEL CROQUIS ambiance: the world redrawn like a soft coloured-pencil / pastel
  // sketch — "beaucoup de couleur mais pâle", à la Petit Prince, a drawing left
  // half-finished. The look comes from the TERRAIN itself (pale pastel vertex colours
  // + flat paper light + the paper-grain overlay), NOT from any full-screen filter:
  // no outline pass, no desaturation, no hatching.
  sketch: {
    key: 'sketch', name: 'Croquis', label: '✎',
    sky: ['#e7eef1', '#f0f1ea', '#f6f4ec'],   // soft watercolour paper (cool→warm)
    fog: '#eef0e8', fogNear: 500, fogFar: 1250,
    hemiSky: '#ffffff', hemiGround: '#e7dfce', hemiInt: 1.14,  // flat & bright
    sunColor: '#fff5e6', sunInt: 0.55, sunShadow: true,        // gentle, soft shadows
    ambient: '#d6cdba', ambientInt: 0.78,
    exposure: 1.24,                            // bright, washed paper
    paperLerp: 0.16, paperTone: '#f0e7d2',     // faint warm-paper tint (keeps colour)
    pastel: 0.44,                              // lift colours toward white → pale pastel
    water: '#a9cdd6', waterFloor: '#9dc0c8', waterOpacity: 0.66,
    outline: false, outlineStrength: 0.0, ink: '#6b5a45',       // (no post-process line)
    desat: 0, wash: 0, washTone: '#efe7d6', hatch: 0,          // NO full-screen filter
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
