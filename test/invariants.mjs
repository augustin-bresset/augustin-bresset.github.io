// invariants.mjs — fast structural checks on the procedural world generator.
// These are the bugs we hunted *visually* (an island, a right-triangle continent,
// a biome eating the map, a relief that never rises) turned into 10ms
// assertions. No renderer needed — gen/ is pure data.
//
//   node --experimental-loader ./test/three-loader.mjs test/invariants.mjs
//
import { makeSites } from '../src/gen/voronoi.js';
import { growBiomes } from '../src/gen/biomeGrowth.js';
import { makeField, WATER_Y } from '../src/gen/heightmap.js';
import { erode, settle } from '../src/gen/erosion.js';
import { zonate, reliefOf, RELIEF_KEYS } from '../src/gen/relief.js';
import { carveRivers } from '../src/gen/hydrology.js';
import { BIOME, BIOMES, BY_KEY } from '../src/gen/biomes.js';

const SEEDS = [1, 3, 5, 7, 11, 21, 42, 100, 777, 2024, 31337, 90210];
const SIZE = 2000, SPACING = 54, N = 240;   // island preset (default mode); N lower for speed
const MODE = 'island';
const LAND_Y = WATER_Y + 1.0;               // clearly-above-water counts as land

const BIOME_NAME = Object.fromEntries(Object.entries(BIOME).map(([k, v]) => [v, k]));

// thresholds (calibrated so every healthy world passes; a regression trips them)
const LIMITS = {
  landFracMin: 0.10,   // not a tiny island
  landFracMax: 1.0,    // big-terrain design: nearly all land, sea only in the single
                       //  bay far out (ocean presence enforced via oceanSites below)
  dominantMin: 0.55,   // one connected continent, not an archipelago
  biomeShareMax: 0.72, // no biome eats the map
};

function analyze(seed, relief) {
  const graph = makeSites(seed, { size: SIZE, spacing: SPACING });
  growBiomes(graph, seed, { mode: MODE });
  const field = makeField(seed, { size: SIZE, N, mode: MODE, relief }, graph);
  erode(field);
  settle(field, reliefOf(graph.massif).settle);
  zonate(field, graph);
  carveRivers(field, seed);

  // ---- land connectivity (flood-fill the height grid) ----
  const { idx, heights } = field;
  const W = N + 1;
  const land = new Uint8Array(W * W);
  let landCount = 0;
  for (let i = 0; i < W; i++) for (let j = 0; j < W; j++) {
    if (heights[idx(i, j)] > LAND_Y) { land[i * W + j] = 1; landCount++; }
  }
  // largest 4-connected component
  const seen = new Uint8Array(W * W);
  const stack = [];
  let largest = 0;
  for (let start = 0; start < W * W; start++) {
    if (!land[start] || seen[start]) continue;
    let size = 0; stack.length = 0; stack.push(start); seen[start] = 1;
    while (stack.length) {
      const c = stack.pop(); size++;
      const i = (c / W) | 0, j = c % W;
      if (i > 0 && land[c - W] && !seen[c - W]) { seen[c - W] = 1; stack.push(c - W); }
      if (i < W - 1 && land[c + W] && !seen[c + W]) { seen[c + W] = 1; stack.push(c + W); }
      if (j > 0 && land[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack.push(c - 1); }
      if (j < W - 1 && land[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack.push(c + 1); }
    }
    if (size > largest) largest = size;
  }

  // ---- biome distribution + ocean presence (from sites) ----
  const counts = {};
  let landSites = 0, oceanSites = 0;
  for (const s of graph.sites) {
    if (s.biome === BIOME.OCEAN) { oceanSites++; continue; }
    if (s.biome < 0) continue;
    counts[s.biome] = (counts[s.biome] || 0) + 1; landSites++;
  }
  let topBiome = -1, topCount = 0;
  for (const b in counts) if (counts[b] > topCount) { topCount = counts[b]; topBiome = +b; }

  // ---- the great relief: it must stand well above the country, whatever its shape ----
  let roof = 0;
  for (let k = 0; k < heights.length; k++) if (heights[k] > roof) roof = heights[k];

  return {
    landFrac: landCount / (W * W),
    dominant: landCount ? largest / landCount : 0,
    oceanSites, landSites,
    topBiome, biomeShare: landSites ? topCount / landSites : 0,
    roof, relief: graph.massif.style,
    trend: graph.trend,
  };
}

let failed = 0;

// ---- static checks on the biome table itself (catch typos in new biome defs) ----
for (const b of BIOMES) {
  for (const k in b.adj) {
    if (!BY_KEY[k]) { console.log(`  FAIL biome '${b.key}' adj references unknown biome '${k}'`); failed++; }
  }
  if (!(b.moist >= 0 && b.moist <= 1)) { console.log(`  FAIL biome '${b.key}' has no valid moist`); failed++; }
  if (BIOMES[b.id] !== b) { console.log(`  FAIL biome '${b.key}' id ${b.id} does not match its index`); failed++; }
}
console.log(`gen invariants · ${SEEDS.length} seeds · N=${N}\n`);
// every seed with a different relief forced on it, so each shape is exercised
SEEDS.forEach((seed, n) => {
  const a = analyze(seed, RELIEF_KEYS[n % RELIEF_KEYS.length]);
  const checks = [
    ['land present & not an island', a.landFrac >= LIMITS.landFracMin && a.landFrac <= LIMITS.landFracMax],
    ['sea still surrounds it', a.oceanSites > 0],
    ['one connected continent', a.dominant >= LIMITS.dominantMin],
    ['no biome eats the map', a.biomeShare <= LIMITS.biomeShareMax],
    ['a relief to look up at', a.roof > 110 && a.roof < 620],
  ];
  const bad = checks.filter(([, ok]) => !ok);
  const tag = bad.length ? 'FAIL' : 'ok  ';
  console.log(`  ${tag} seed ${String(seed).padStart(4)}  ` +
    `trend ${String(a.trend).padEnd(9)} · ` +
    `land ${(a.landFrac * 100).toFixed(0)}% · continent ${(a.dominant * 100).toFixed(0)}% · ` +
    `top ${BIOME_NAME[a.topBiome] || '—'} ${(a.biomeShare * 100).toFixed(0)}% · ` +
    `${a.relief} ${a.roof.toFixed(0)}`);
  for (const [name] of bad) { console.log(`         ✗ ${name}`); failed++; }
});

console.log(failed ? `\n${failed} invariant failure(s)` : '\nall invariants hold');
process.exit(failed ? 1 : 0);
