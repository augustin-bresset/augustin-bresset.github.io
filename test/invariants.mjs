// invariants.mjs — fast structural checks on the procedural world generator.
// These are the bugs we hunted *visually* (an island, a right-triangle continent,
// a biome eating the map, a volcano buried in a mountain massif) turned into 10ms
// assertions. No renderer needed — gen/ is pure data.
//
//   node --experimental-loader ./test/three-loader.mjs test/invariants.mjs
//
import { makeSites } from '../src/gen/voronoi.js';
import { growBiomes } from '../src/gen/biomeGrowth.js';
import { makeField, WATER_Y } from '../src/gen/heightmap.js';
import { BIOME } from '../src/gen/biomes.js';

const SEEDS = [1, 3, 5, 7, 11, 21, 42, 100, 777, 2024];
const SIZE = 1600, SPACING = 54, N = 192;   // island preset (default mode); N lower for speed
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

function analyze(seed) {
  const graph = makeSites(seed, { size: SIZE, spacing: SPACING });
  growBiomes(graph, seed, { mode: MODE });
  const field = makeField(seed, { size: SIZE, N, mode: MODE }, graph);

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

  // ---- volcano isolation: the rendered cone must not be buried in mountains ----
  // The cone is the best CENTRAL volcanic site (see world.js), scored to dodge
  // mountains. So we only require that — when central volcanic sites exist — at least
  // one isn't ringed by mountain/snow. (Out in the far backcountry the volcanic biome
  // may incidentally touch mountains; that cell is never the cone.)
  const volc = graph.sites.filter((s) => s.biome === BIOME.VOLCANIC);
  const massifFrac = (v) => {
    const nb = graph.neighbors(v);
    let m = 0;
    for (const n of nb) if (n.biome === BIOME.MOUNTAIN || n.biome === BIOME.SNOW) m++;
    return nb.length ? m / nb.length : 0;
  };
  const central = volc.filter((s) => Math.hypot(s.x, s.z) < 420);
  let volcanoInMassif = false;
  if (central.length) {
    let best = 1;
    for (const v of central) best = Math.min(best, massifFrac(v));
    volcanoInMassif = best >= 0.5;  // even the best central site is ringed by mountains
  }

  return {
    landFrac: landCount / (W * W),
    dominant: landCount ? largest / landCount : 0,
    oceanSites, landSites,
    topBiome, biomeShare: landSites ? topCount / landSites : 0,
    volcanoes: volc.length, volcanoInMassif,
  };
}

let failed = 0;
console.log(`gen invariants · ${SEEDS.length} seeds · N=${N}\n`);
for (const seed of SEEDS) {
  const a = analyze(seed);
  const checks = [
    ['land present & not an island', a.landFrac >= LIMITS.landFracMin && a.landFrac <= LIMITS.landFracMax],
    ['sea still surrounds it', a.oceanSites > 0],
    ['one connected continent', a.dominant >= LIMITS.dominantMin],
    ['no biome eats the map', a.biomeShare <= LIMITS.biomeShareMax],
    ['volcano not in a massif', !a.volcanoInMassif],
  ];
  const bad = checks.filter(([, ok]) => !ok);
  const tag = bad.length ? 'FAIL' : 'ok  ';
  console.log(`  ${tag} seed ${String(seed).padStart(4)}  ` +
    `land ${(a.landFrac * 100).toFixed(0)}% · continent ${(a.dominant * 100).toFixed(0)}% · ` +
    `top ${BIOME_NAME[a.topBiome] || '—'} ${(a.biomeShare * 100).toFixed(0)}% · ` +
    `volc ${a.volcanoes}`);
  for (const [name] of bad) { console.log(`         ✗ ${name}`); failed++; }
}

console.log(failed ? `\n${failed} invariant failure(s)` : '\nall invariants hold');
process.exit(failed ? 1 : 0);
