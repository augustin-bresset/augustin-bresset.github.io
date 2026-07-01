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
};

// height: { base, amp, ridged(0..1), freq }  — blended across biome borders.
// adj: relative likelihood this biome sits next to another (symmetric in spirit).
// weight: base seeding frequency. scatter: 'forest'|'sparse'|'rock'|'none'.
export const BIOMES = [
  { id: 0, key: 'ocean',    name: 'Ocean',     color: '#6f828b', height: { base: -20, amp: 5,  ridged: 0,   freq: 0.018 }, weight: 0.6, scatter: 'none',
    adj: { ocean: 9, beach: 5, marsh: 2 } },
  { id: 1, key: 'beach',    name: 'Shore',     color: '#cdbf9c', height: { base: 1.2, amp: 2.2, ridged: 0, freq: 0.03 }, weight: 0.3, scatter: 'sparse',
    adj: { ocean: 5, beach: 2, plains: 3, desert: 2, savanna: 2, marsh: 2 } },
  { id: 2, key: 'plains',   name: 'Plains',    color: '#9ba07a', height: { base: 6,  amp: 5,  ridged: 0,   freq: 0.02 }, weight: 1.0, scatter: 'sparse',
    adj: { plains: 5, forest: 4, hills: 3, savanna: 3, beach: 2, marsh: 2 } },
  { id: 3, key: 'forest',   name: 'Forest',    color: '#71815a', height: { base: 10, amp: 9,  ridged: 0,   freq: 0.018 }, weight: 0.9, scatter: 'forest',
    adj: { forest: 5, plains: 4, hills: 4, marsh: 2, mountain: 2 } },
  { id: 4, key: 'hills',    name: 'Hills',     color: '#94906c', height: { base: 17, amp: 17, ridged: 0.3, freq: 0.015 }, weight: 0.7, scatter: 'forest',
    adj: { hills: 5, mountain: 4, forest: 3, plains: 3, snow: 1 } },
  { id: 5, key: 'mountain', name: 'Mountains', color: '#8b8478', height: { base: 34, amp: 48, ridged: 0.85, freq: 0.013 }, weight: 0.5, scatter: 'rock',
    adj: { mountain: 6, hills: 4, snow: 4, forest: 2 } },
  { id: 6, key: 'snow',     name: 'Snow',      color: '#ddd9cc', height: { base: 52, amp: 38, ridged: 0.9, freq: 0.013 }, weight: 0.3, scatter: 'rock',
    adj: { snow: 5, mountain: 5, hills: 1 } },
  { id: 7, key: 'desert',   name: 'Desert',    color: '#c8b88c', height: { base: 4,  amp: 7,  ridged: 0, freq: 0.022 }, weight: 0.45, scatter: 'sparse',
    adj: { desert: 7, savanna: 4, beach: 2, plains: 1 } },
  { id: 8, key: 'savanna',  name: 'Savanna',   color: '#b3a878', height: { base: 8,  amp: 8,  ridged: 0, freq: 0.018 }, weight: 0.5, scatter: 'sparse',
    adj: { savanna: 5, desert: 4, plains: 3, beach: 2 } },
  { id: 9, key: 'marsh',    name: 'Marsh',     color: '#7d8467', height: { base: 1.8, amp: 2.8, ridged: 0, freq: 0.03 }, weight: 0.35, scatter: 'sparse',
    adj: { marsh: 4, plains: 2, forest: 2, ocean: 2, beach: 2 } },
  // Volcano sits ALONE in a barren lowland (desert/savanna/plains), NOT inside a
  // mountain massif — a lone cone rising out of flat scrubland. The TERRAIN here is
  // deliberately LOW & flat (the drama is the cone mesh, placed on a flattened pad in
  // world.js — see buildVolcano), so the volcano reads as ground-level, never perched
  // on a peak. Its neighbours are low + barren so it reads isolated; Toaster can
  // settle right beside it.
  { id: 10, key: 'volcanic', name: 'Volcanic', color: '#3a342f', height: { base: 5, amp: 5, ridged: 0, freq: 0.02 }, weight: 0.0, scatter: 'rock',
    adj: { volcanic: 2, desert: 3, savanna: 3, plains: 2 } },
  // Mesa: flat-topped sandstone tablelands. High amplitude noise is crushed by the
  // plateau cap in heightmap.js → sheer cliffs top-out at a flat terracotta summit.
  // Sits naturally between desert/savanna lowlands (it's a desert feature) and never
  // touches mountains or snow.
  { id: 11, key: 'mesa', name: 'Mesa', color: '#c47a52', height: { base: 12, amp: 40, ridged: 0.45, freq: 0.014, plateau: 30 }, weight: 0.28, scatter: 'rock',
    adj: { mesa: 3, desert: 5, savanna: 4, plains: 2, hills: 1 } },
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

// Final terrain colour for a face: biome colour, nudged by height/slope, then
// pulled slightly toward paper so the whole thing reads muted / sketch-like.
const _c = new THREE.Color();
export function faceColor(out, biomeId, y, slope, jitter = 0) {
  out.copy(COL[biomeId]);
  // steep faces → greyer rock regardless of biome
  if (slope > 0.6 && biomeId !== BIOME.OCEAN) {
    out.lerp(_c.set('#867f72'), clamp((slope - 0.6) * 1.8, 0, 0.6));
  }
  // SNOW on high mountains: a snow-line that starts partway up the peaks and
  // deepens toward the summits (near-solid white on the tops). Only true cliffs
  // shed it, so ridges read as snow-streaked alpine rock. Never on the volcano's
  // hot dark scrubland.
  if (y > 38 && biomeId !== BIOME.VOLCANIC) {
    const line = clamp((y - 38) / 22, 0, 1);          // 38 → dusting, 60 → full cap
    const cling = 1 - clamp((slope - 0.74) * 2.4, 0, 0.6); // only sheer cliffs bare
    out.lerp(_c.set('#f3f5f0'), Math.min(0.96, line * (0.55 + 0.45 * line)) * cling);
  }
  // subtle facet jitter
  if (jitter) out.offsetHSL(0, 0, jitter);
  // CROQUIS pastel: lift toward white so the colour stays (its hue) but goes pale
  // and chalky — "beaucoup de couleur mais pâle", like a soft pastel / Petit Prince
  // drawing. Then a hint toward the warm paper tone. (pastel is 0 in the diorama.)
  if (ACTIVE.pastel) out.lerp(_white, ACTIVE.pastel);
  out.lerp(_paper.set(ACTIVE.paperTone), ACTIVE.paperLerp);
  return out;
}

// scatter density hint per biome (0..1) for trees, plus rockiness
export function scatterProfile(biomeId) {
  const s = BIOMES[biomeId].scatter;
  if (s === 'forest') return { tree: 0.5, rock: 0.03 };
  if (s === 'sparse') return { tree: 0.05, rock: 0.03 };
  if (s === 'rock') return { tree: 0.0, rock: 0.12 };
  return { tree: 0, rock: 0 };
}
