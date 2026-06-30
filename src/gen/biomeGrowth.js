// biomeGrowth.js — assign a biome to every Voronoi site by SEQUENTIAL CONSTRAINED
// GROWTH. We seed a few random sites with random biomes, then repeatedly fill the
// frontier: each new cell's biome is sampled from a distribution built by
// multiplying the adjacency weights of its already-assigned neighbours (so two
// neighbours of different biomes intersect their preferences — normalised). This
// yields coherent regions and forbids absurd pairs (snow next to desert).
//
// Special seeding: a patch of OCEAN in one random corner (NOT a full island) and
// one random VOLCANIC hotspot.
import { mulberry32, Simplex } from './noise.js';
import { BIOME, BIOMES, adjWeight } from './biomes.js';

export function growBiomes(graph, seed, { mode = 'island' } = {}) {
  const { sites, neighbors, cols, rows } = graph;
  const rand = mulberry32((seed ^ 0xb107e9a1) >>> 0);

  const LAND = BIOMES.filter((b) => b.id !== BIOME.OCEAN && b.id !== BIOME.VOLCANIC);

  // --- connected-component sizes via union-find, so we can damp a biome whose
  // adjacent region is already large. Without this the growth is self-reinforcing
  // (adjWeight(forest,forest) is high → forest keeps spawning forest) and one
  // biome can devour the whole map (Eden / rich-get-richer growth). Damping by
  // region size gives every biome a soft saturation point → diverse regions.
  const sidx = (s) => s.r * cols + s.c;
  const parent = new Int32Array(sites.length);
  const compSize = new Int32Array(sites.length);
  for (let i = 0; i < sites.length; i++) parent[i] = i;
  function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
  function unite(a, b) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    if (compSize[ra] < compSize[rb]) { parent[ra] = rb; compSize[rb] += compSize[ra]; }
    else { parent[rb] = ra; compSize[ra] += compSize[rb]; }
  }
  // assign a biome AND keep the union-find of same-biome components up to date
  function assign(s, biomeId) {
    s.biome = biomeId;
    const i = sidx(s);
    compSize[i] = 1;
    for (const n of neighbors(s)) if (n.biome === biomeId) unite(i, sidx(n));
  }
  // total size of the DISTINCT same-biome components touching this frontier cell
  function adjRegionSize(nb, cid) {
    let total = 0; const seen = [];
    for (const n of nb) {
      if (n.biome !== cid) continue;
      const root = find(sidx(n));
      if (seen.indexOf(root) !== -1) continue;
      seen.push(root); total += compSize[root];
    }
    return total;
  }
  // soft saturation target (in site-cells): around this size a biome's odds halve
  const TARGET = Math.max(10, sites.length * 0.05);

  // weighted pick of a land biome by base weight
  function randomLand() {
    let tot = 0; for (const b of LAND) tot += b.weight;
    let r = rand() * tot;
    for (const b of LAND) { r -= b.weight; if (r <= 0) return b.id; }
    return BIOME.PLAINS;
  }

  // --- 1. OCEAN ---
  if (mode === 'island') {
    // ISLAND coast: turn sites to OCEAN as they get far from the centre, with a
    // WOBBLY shoreline (low-freq noise → bays & capes) plus a probabilistic fringe
    // for a broken coast. The shore therefore follows the Voronoi cells, never a
    // circle or a square. Ocean stays seed-only (excluded from growth below) so the
    // coastline is exactly this land/sea cell boundary.
    const sim = new Simplex((seed ^ 0x151a4d) >>> 0);
    const cgx = (cols - 1) / 2, cgy = (rows - 1) / 2;
    const maxR = Math.hypot(cgx, cgy);
    for (const s of sites) {
      const d = Math.hypot(s.c - cgx, s.r - cgy) / maxR;          // 0 centre .. 1 corner
      const wob = sim.fbm(s.c * 0.17, s.r * 0.17, { octaves: 3 }); // ~ -1..1
      const coast = 0.56 + 0.17 * wob;                            // organic shoreline
      if (d > coast) assign(s, BIOME.OCEAN);
      else if (d > coast - 0.12 && rand() < (d - (coast - 0.12)) / 0.12 * 0.55) assign(s, BIOME.OCEAN);
    }
    graph.oceanCorner = { x: 0, z: 0 };
  } else {
    // ENDLESS LAND (?mode=land): a single local bay at one rim anchor (corner or edge
    // midpoint); land runs off the other edges — a continental coast, not a ring.
    const mc = (cols - 1) / 2 | 0, mr = (rows - 1) / 2 | 0;
    const anchors = [
      [0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1],  // 4 corners
      [mc, 0], [mc, rows - 1], [0, mr], [cols - 1, mr],            // 4 edge midpoints
    ];
    const [ocx, ocy] = anchors[(rand() * anchors.length) | 0];
    const oceanReach = 2.4 + (rand() * 2.6);   // in site cells
    for (const s of sites) {
      const d = Math.hypot(s.c - ocx, s.r - ocy);
      if (d < oceanReach + rand() * 1.2) assign(s, BIOME.OCEAN);
    }
    graph.oceanCorner = {
      x: (ocx / (cols - 1)) * 2 - 1,
      z: (ocy / (rows - 1)) * 2 - 1,
    };
  }

  // --- 2. VOLCANIC hotspot: one inland site near the CENTRE (so the lone volcano,
  // when it spawns, sits in the reachable heart of the map) grown to a SMALL blob so
  // the dark scorched "cailloux" biome stays a single contained patch around the cone
  // instead of sprawling burnt splotches across the whole continent. ---
  const ccx = (cols - 1) / 2, ccy = (rows - 1) / 2;
  const inland = sites.filter((s) => s.biome === -1 &&
    s.c > 2 && s.r > 2 && s.c < cols - 3 && s.r < rows - 3);
  const nearCentre = inland.filter((s) => {
    const d = Math.hypot(s.c - ccx, s.r - ccy);
    return d >= 3.5 && d <= 9;   // central, but off dead-centre (room for cities)
  });
  const pool = nearCentre.length ? nearCentre : inland;
  if (pool.length) {
    const hs = pool[(rand() * pool.length) | 0];
    for (const s of sites) {
      if (s.biome === -1 && Math.hypot(s.c - hs.c, s.r - hs.r) < 1.7) assign(s, BIOME.VOLCANIC);
    }
  }

  // --- 3. a few random land seeds to start regions ---
  const seedCount = Math.max(4, Math.round(sites.length * 0.02));
  for (let i = 0; i < seedCount; i++) {
    const s = sites[(rand() * sites.length) | 0];
    if (s.biome === -1) assign(s, randomLand());
  }

  // --- 4. grow: repeatedly assign frontier cells from neighbour adjacency ---
  // VOLCANIC is always excluded so it never sprawls past its seeded blob. In ISLAND
  // mode OCEAN is excluded too, so the shoreline stays exactly the seeded Voronoi
  // land/sea boundary (land grows up to it as beach/plains); in land mode the bay
  // may still spread.
  const CANDIDATES = BIOMES.map((b) => b.id).filter((id) =>
    id !== BIOME.VOLCANIC && (mode !== 'island' || id !== BIOME.OCEAN));
  let remaining = sites.filter((s) => s.biome === -1).length;
  let guard = sites.length * 4;

  while (remaining > 0 && guard-- > 0) {
    // collect frontier (unassigned with >=1 assigned neighbour)
    const frontier = [];
    for (const s of sites) {
      if (s.biome !== -1) continue;
      const nb = neighbors(s).filter((n) => n.biome !== -1);
      if (nb.length) frontier.push({ s, nb });
    }
    if (!frontier.length) {
      // disconnected leftover: seed it
      const s = sites.find((x) => x.biome === -1);
      if (s) { assign(s, randomLand()); remaining--; continue; }
      break;
    }
    // assign every current frontier cell this pass
    for (const { s, nb } of frontier) {
      if (s.biome !== -1) continue;
      // build distribution: product of adjacency weights across assigned neighbours
      let bestId = BIOME.PLAINS, total = 0;
      const probs = [];
      for (const cid of CANDIDATES) {
        let w = 1;
        for (const n of nb) w *= (adjWeight(n.biome, cid) + 0.04);
        // light bias toward the biome's base frequency
        w *= 0.5 + BIOMES[cid].weight;
        // soft saturation: damp a biome whose adjacent region is already large so
        // no single biome can run away and swallow the map (see union-find above)
        w *= 1 / (1 + adjRegionSize(nb, cid) / TARGET);
        probs.push(w); total += w;
      }
      let r = rand() * total;
      for (let k = 0; k < CANDIDATES.length; k++) {
        r -= probs[k];
        if (r <= 0) { bestId = CANDIDATES[k]; break; }
      }
      assign(s, bestId);
      remaining--;
    }
  }
  // safety: anything left becomes plains
  for (const s of sites) if (s.biome === -1) assign(s, BIOME.PLAINS);

  return graph;
}
