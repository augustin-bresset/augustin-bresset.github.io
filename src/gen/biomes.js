// biomes.js — DATA-DRIVEN biome definitions. Everything about a biome lives here
// so the art/feel can be tuned in one place:
//   - colour (muted "brouillon" palette)
//   - height params (fed to the per-biome fBM heightmap)
//   - adjacency weights (used by the constrained growth so neighbours make sense:
//     no snow next to desert, ocean meets beach, etc.)
//   - scatter + city hints
import * as THREE from 'three';
import { clamp } from './noise.js';
import { ACTIVE } from '../themes.js';

export const BIOME = {
  OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, HILLS: 4,
  MOUNTAIN: 5, SNOW: 6, DESERT: 7, SAVANNA: 8, MARSH: 9, VOLCANIC: 10, MESA: 11,
  MOOR: 12, PLATEAU: 13, TAIGA: 14, JUNGLE: 15,
};

// height: { base, amp, ridged(0..1), freq, gain?, plateau?, dunes? } — blended across
//   borders (plateau: cap height; overshoot is crushed → flat top + sheer cliff sides.
//   dunes: height of the wind-blown ridges laid over the relief).
// adj: relative likelihood this biome sits next to another (symmetric in spirit).
// weight: base seeding frequency. scatter: what grows there (see gen/placement.js).
// moist: moisture target 0..1 (drives the soil's green + river-bank life).
// mottle: { color, amt } — patches of a second tone (heather on the moor);
// flecks: { colors, p } — a face in every 1/p takes one of these (a meadow in flower).
// Both are applied per face in shadeFace, from the terrain's per-face hash.
// These are the regional reliefs; the one true mountain chain is gen/relief.js.
export const BIOMES = [
  { id: 0, key: 'ocean',    name: 'Ocean',     color: '#6f828b', height: { base: -20, amp: 5,  ridged: 0,   freq: 0.018 }, weight: 0.6, scatter: 'none', moist: 0.9,
    // (the sea takes any shore: sand here, a wood down to the water there, a cliff further on)
    adj: { ocean: 9, beach: 5, marsh: 2, plains: 2.6, forest: 2.2, hills: 2, moor: 1.8, taiga: 1.6, jungle: 3, desert: 2, savanna: 2.2, plateau: 1.4, mountain: 0.7 } },
  { id: 1, key: 'beach',    name: 'Shore',     color: '#e4d5a3', height: { base: 1.2, amp: 2.2, ridged: 0, freq: 0.03 }, weight: 0.3, scatter: 'shore', moist: 0.5,
    adj: { ocean: 5, beach: 2, plains: 3, desert: 2, savanna: 2, marsh: 2, jungle: 3 } },
  { id: 2, key: 'plains',   name: 'Plains',    color: '#96b464', height: { base: 6,  amp: 6,  ridged: 0,   freq: 0.013, gain: 0.24 }, weight: 1.0, scatter: 'meadow', moist: 0.45,
    flecks: { colors: ['#f4efe0', '#f0d264', '#e79ab8', '#b49be0'], p: 0.06 },
    adj: { plains: 5, forest: 4, hills: 3, savanna: 3, beach: 2, marsh: 2 } },
  { id: 3, key: 'forest',   name: 'Forest',    color: '#5f8c4c', height: { base: 10, amp: 12, ridged: 0,   freq: 0.018 }, weight: 0.9, scatter: 'forest', moist: 0.75,
    adj: { forest: 5, plains: 4, hills: 4, marsh: 2, mountain: 2, jungle: 3 } },
  { id: 4, key: 'hills',    name: 'Hills',     color: '#8fa264', height: { base: 18, amp: 26, ridged: 0.4, freq: 0.014 }, weight: 0.7, scatter: 'wood', moist: 0.4,
    adj: { hills: 5, mountain: 4, forest: 3, plains: 3, snow: 1 } },
  { id: 5, key: 'mountain', name: 'Mountains', color: '#918d85', height: { base: 36, amp: 64, ridged: 0.85, freq: 0.0085 }, weight: 0.5, scatter: 'alpine', moist: 0.3,
    adj: { mountain: 6, hills: 4, snow: 4, forest: 2, taiga: 3 } },
  { id: 6, key: 'snow',     name: 'Snow',      color: '#e8ece9', height: { base: 52, amp: 64, ridged: 0.88, freq: 0.0085 }, weight: 0.3, scatter: 'snow', moist: 0.25,
    adj: { snow: 5, mountain: 5, hills: 1, taiga: 2 } },
  { id: 7, key: 'desert',   name: 'Desert',    color: '#e5c680', height: { base: 4,  amp: 7,  ridged: 0, freq: 0.022, dunes: 4.6 }, weight: 0.45, scatter: 'desert', moist: 0.08,
    adj: { desert: 7, savanna: 4, beach: 2, plains: 1 } },
  { id: 8, key: 'savanna',  name: 'Savanna',   color: '#cfba6a', height: { base: 8,  amp: 8,  ridged: 0, freq: 0.015, gain: 0.32 }, weight: 0.5, scatter: 'savanna', moist: 0.2,
    mottle: { color: '#b89a52', amt: 0.3 },
    adj: { savanna: 5, desert: 4, plains: 3, beach: 2 } },
  { id: 9, key: 'marsh',    name: 'Marsh',     color: '#6d8c68', height: { base: 1.8, amp: 2.8, ridged: 0, freq: 0.03 }, weight: 0.35, scatter: 'marsh', moist: 0.85,
    mottle: { color: '#4f6f6a', amt: 0.4 },
    adj: { marsh: 4, plains: 2, forest: 2, ocean: 2, beach: 2, jungle: 3 } },
  // Volcanic: the ash and basalt of a volcano's upper slopes. Never seeded on the
  // biome map (weight 0, and the growth leaves it out): it is laid by ALTITUDE, where
  // the world's great relief is a volcano (gen/relief.js zonate).
  { id: 10, key: 'volcanic', name: 'Volcanic', color: '#3a342f', height: { base: 5, amp: 5, ridged: 0, freq: 0.02 }, weight: 0.0, scatter: 'burnt', moist: 0.1,
    adj: { volcanic: 2, desert: 3, savanna: 3, plains: 2 } },
  // Mesa: flat-topped sandstone tablelands. High amplitude noise is crushed by the
  // plateau cap in heightmap.js → sheer cliffs top-out at a flat terracotta summit.
  // Sits naturally between desert/savanna lowlands (it's a desert feature) and never
  // touches mountains or snow.
  { id: 11, key: 'mesa', name: 'Mesa', color: '#d07d4d', height: { base: 14, amp: 66, ridged: 0.45, freq: 0.013, plateau: 46 }, weight: 0.07, scatter: 'desert', moist: 0.05,
    adj: { mesa: 3, desert: 5, savanna: 4, plains: 2, hills: 1 } },
  // Moor: Scottish highlands — long, soft, treeless rolls (very low noise frequency →
  // broad swells rather than bumps), grass-and-heather tones with mauve mottled
  // patches, scattered boulders, the odd lone wind-bent tree. Bridges the green
  // lowlands and the true hills/mountains.
  { id: 12, key: 'moor', name: 'Moor', color: '#8a945e', height: { base: 13, amp: 15, ridged: 0.1, freq: 0.010, gain: 0.42 }, weight: 0.45, scatter: 'moor', moist: 0.65,
    mottle: { color: '#9b6c97', amt: 0.44 },
    adj: { moor: 5, hills: 4, plains: 3, plateau: 3, taiga: 2, mountain: 2, forest: 1, beach: 1 } },
  // Grass plateau: the mesa mechanic gone green — high-amplitude noise crushed at a
  // lower cap, so sheer grassy-cliffed tablelands rise out of the rolling lowlands
  // with flat meadow tops.
  { id: 13, key: 'plateau', name: 'Grass Plateau', color: '#86aa62', height: { base: 8, amp: 46, ridged: 0.3, freq: 0.012, plateau: 34 }, weight: 0.14, scatter: 'meadow', moist: 0.5,
    flecks: { colors: ['#f4efe0', '#f0d264'], p: 0.05 },
    adj: { plateau: 3, moor: 3, hills: 3, plains: 2, savanna: 2, forest: 2 } },
  // Taiga: dark conifer forest on cold high ground — the natural skirt of the
  // mountain massifs, between the broadleaf forests below and the bare rock above.
  { id: 14, key: 'taiga', name: 'Taiga', color: '#4d7256', height: { base: 16, amp: 16, ridged: 0.2, freq: 0.016 }, weight: 0.4, scatter: 'taiga', moist: 0.7,
    adj: { taiga: 5, forest: 4, mountain: 3, hills: 3, snow: 2, moor: 2 } },
  // Jungle: the wet, hot lowland — a closed canopy of big trees and palms down to the
  // beach. Rare in a temperate world, most of the land in a tropical one.
  { id: 15, key: 'jungle', name: 'Jungle', color: '#3e8b49', height: { base: 9, amp: 13, ridged: 0.15, freq: 0.02 }, weight: 0.16, scatter: 'jungle', moist: 0.95,
    adj: { jungle: 6, forest: 3, marsh: 3, beach: 3, plains: 2, hills: 2, savanna: 1 } },
];

export const BY_KEY = Object.fromEntries(BIOMES.map((b) => [b.key, b]));

// adjacency weight from biome a (id) to biome b (id); symmetric max of both views
export function adjWeight(aId, bId) {
  const a = BIOMES[aId], b = BIOMES[bId];
  const ka = b.key, kb = a.key;
  const wa = a.adj[ka] ?? 0;
  const wb = b.adj[kb] ?? 0;
  return Math.max(wa, wb);
}

// muted base colours, pre-parsed
const COL = BIOMES.map((b) => new THREE.Color(b.color));
const _paper = new THREE.Color('#cabfa6'); // paper tone for desaturation
const _c = new THREE.Color();
const _white = new THREE.Color('#ffffff'); // pastel lift (keeps hue, raises lightness)

export function biomeBaseColor(id) { return COL[id]; }

// Per-vertex slope (0 flat .. 1 vertical) from neighbour heights.
export function computeSlope(field) {
  const { N, verts, heights, idx, size } = field;
  const cell = size / N;
  const slope = new Float32Array(verts * verts);
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const hL = heights[idx(Math.max(0, i - 1), j)];
      const hR = heights[idx(Math.min(N, i + 1), j)];
      const hD = heights[idx(i, Math.max(0, j - 1))];
      const hU = heights[idx(i, Math.min(N, j + 1))];
      const dx = (hR - hL) / (2 * cell);
      const dz = (hU - hD) / (2 * cell);
      const g = Math.sqrt(dx * dx + dz * dz);
      slope[idx(i, j)] = g / Math.sqrt(1 + g * g);
    }
  }
  return slope;
}

// ---- the colour of the ground -----------------------------------------------------
// Two steps, so a face can take the mean of its three corners in between:
//   groundColor / rockColor — per VERTEX: the biomes around it blended (borders fade),
//     the soil dried out or greened up by how wet the place is;
//   shadeFace — per FACE: bare rock in strata on the steep ones, sand at the shore and
//     seabed below it, snow up high, hollows darker and ridges paler, then the theme.

// what shows where the slope is too steep to hold soil
const ROCKS = { mesa: '#bd6a40', desert: '#c2a06a', savanna: '#ad976a', beach: '#b8ab8c', volcanic: '#2f2a27', plateau: '#8f8a76', moor: '#7e7a70', snow: '#7c8088', mountain: '#857f78', jungle: '#6c7466' };
const ROCK = BIOMES.map((b) => new THREE.Color(ROCKS[b.key] || '#867f72'));
// how much a biome's soil answers to moisture (bare ground doesn't)
const GREENS = { plains: 0.9, forest: 0.8, hills: 0.7, plateau: 0.8, moor: 0.6, taiga: 0.6, marsh: 0.6, savanna: 0.5, mountain: 0.2, desert: 0.1, jungle: 0.7 };
const GREEN = BIOMES.map((b) => GREENS[b.key] || 0);
const _dry = new THREE.Color('#cdb97c'), _lush = new THREE.Color('#4c8741');
const _sand = new THREE.Color('#d8caa4'), _wet = new THREE.Color('#b3a37f'), _deep = new THREE.Color('#44616a');
const _snow = new THREE.Color('#f5f7f4'), _ice = new THREE.Color('#b9dde8');
const FLECKS = BIOMES.map((b) => (b.flecks ? b.flecks.colors.map((c) => new THREE.Color(c)) : null));

// ids / w: the field's blendIds / blendW; o: this vertex's offset in them
export function groundColor(out, ids, w, o, moist) {
  let r = 0, g = 0, b = 0, green = 0;
  for (let k = 0; k < 3; k++) {
    const c = COL[ids[o + k]], wk = w[o + k];
    r += c.r * wk; g += c.g * wk; b += c.b * wk; green += GREEN[ids[o + k]] * wk;
  }
  out.setRGB(r, g, b);
  const wetness = (moist - 0.5) * green;
  return wetness < 0 ? out.lerp(_dry, -wetness * 0.8) : out.lerp(_lush, wetness * 0.7);
}

export function rockColor(out, ids, w, o) {
  let r = 0, g = 0, b = 0;
  for (let k = 0; k < 3; k++) {
    const c = ROCK[ids[o + k]], wk = w[o + k];
    r += c.r * wk; g += c.g * wk; b += c.b * wk;
  }
  return out.setRGB(r, g, b);
}

// out: the face's ground colour (in) → its final colour (out). rock: its rock colour.
// hollow: +1 deep in a hollow … -1 proud on a ridge (baked ambient light).
// snow: how far above the snow line the face is (0 … 1, from the biome blend).
export function shadeFace(out, rock, biomeId, y, slope, hollow = 0, jitter = 0, snow = 0) {
  // bare rock on steep faces, laid in strata (bold on the mesas' walls)
  if (slope > 0.56 && biomeId !== BIOME.OCEAN) {
    const strata = Math.sin(y * 1.3) > 0.25 ? 1 : -1;
    _c.copy(rock).offsetHSL(0, 0, strata * (biomeId === BIOME.MESA ? 0.06 : 0.025));
    out.lerp(_c, clamp((slope - 0.56) * 2.6, 0, 0.82));
  }
  // the shore: sand just above the waterline, darker where it is wet; the seabed below
  if (y < 1.7 && biomeId !== BIOME.VOLCANIC) {
    if (y < 0) out.copy(_wet).lerp(_deep, clamp(-y / 8, 0, 1));
    else if (biomeId !== BIOME.MARSH) out.lerp(y < 0.45 ? _wet : _sand, (1 - clamp((y - 0.2) / 1.5, 0, 1)) * 0.85 * (1 - clamp(slope * 1.6, 0, 1)));
  }
  // SNOW above the snow line (gen/relief.js zonate): near-solid white on the tops,
  // but sheer faces shed it, so the ridges read as snow-streaked rock — and where it
  // gathers in a high hollow it has packed into the blue ice of a glacier.
  // biome mottling: patches of a second tone (heather on the moor), driven by the
  // same deterministic per-face jitter hash so patches are stable across restyles.
  const mot = BIOMES[biomeId].mottle;
  if (mot && jitter && snow < 0.3) {
    const t = Math.min(1, Math.abs(jitter) * 55);   // |jitter| ≤ ~0.025 → 0..1
    out.lerp(_c.set(mot.color), mot.amt * t);
  }
  // a meadow in flower: now and then a face is all blossom (gentle ground only)
  const fl = FLECKS[biomeId];
  if (fl && slope < 0.3 && y > 2.2) {
    const h = jitter / 0.05 + 0.5, p = BIOMES[biomeId].flecks.p;
    if (h < p) out.lerp(fl[Math.min(fl.length - 1, (h / p * fl.length) | 0)], 0.48);
  }
  // subtle facet jitter
  if (jitter) out.offsetHSL(0, 0, jitter);
  // light baked from the relief's shape: hollows sit in shade, ridges catch the sky
  out.multiplyScalar(hollow > 0 ? 1 - hollow * 0.34 : 1 - hollow * 0.14);
  // CROQUIS pastel: lift toward white so the colour stays (its hue) but goes pale
  // and chalky — "beaucoup de couleur mais pâle", like a soft pastel / Petit Prince
  // drawing. Then a hint toward the warm paper tone. (pastel is 0 in the diorama.)
  if (ACTIVE.pastel) out.lerp(_white, ACTIVE.pastel);
  out.lerp(_paper.set(ACTIVE.paperTone), ACTIVE.paperLerp);
  // SNOW above the snow line (gen/relief.js zonate): near-solid white on the tops,
  // but sheer faces shed it, so the ridges read as snow-streaked rock — and where it
  // gathers in a high hollow it has packed into the blue ice of a glacier. Laid on
  // last: snow is the one thing here that is truly white, whatever the paper's tone.
  if (snow > 0.02) {
    const cling = 1 - clamp((slope - 0.7) * 3.2, 0, 0.84);
    _c.copy(_snow).multiplyScalar(hollow > 0 ? 1 - hollow * 0.22 : 1);
    out.lerp(_c, Math.min(0.97, snow * 1.25) * cling);
    if (snow > 0.5 && hollow > 0.2) out.lerp(_ice, Math.min(0.5, (hollow - 0.2) * 1.4) * cling);
  }
  return out;
}
