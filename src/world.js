// world.js — assembles the full world: Voronoi biomes → constrained growth →
// big grid heightfield → mesh + bricks + cities.
import * as THREE from 'three';
import { makeField } from './gen/heightmap.js';
import { makeSites } from './gen/voronoi.js';
import { growBiomes } from './gen/biomeGrowth.js';
import { computeSlope, BIOME } from './gen/biomes.js';
import { carveRivers } from './gen/hydrology.js';
import { planScatter } from './gen/placement.js';
import { buildTerrainMesh } from './bricks/terrain.js';
import { buildRivers } from './bricks/rivers.js';
import { buildSea } from './bricks/water.js';
import { buildTrees } from './bricks/trees.js';
import { buildRocks } from './bricks/rocks.js';
import { buildVolcano } from './bricks/volcano.js';
import { buildClouds } from './bricks/clouds.js';
import { smoothstep, mulberry32 } from './gen/noise.js';
import { CITIES } from './cities/registry.js';
import { placeCities } from './cities/placement.js';

// WORLD is the PLAYABLE / camera reference scale (immersed view, city roam disc).
// TERRAIN is the much larger grid the world is actually generated on, so the map's
// finite square edge sits far past the fog wall AND far past anywhere the camera can
// pan — you never see it cut off. Cities + the volcano stay in the central disc.
export const WORLD = { size: 1000, half: 500 };
const TERRAIN = { size: 2800, half: 1400, N: 512 };

export function buildWorld(stage, seed) {
  const group = new THREE.Group();
  const updaters = [];
  const cities = [];

  // 1. Voronoi biome cells + constrained sequential growth (over the big grid)
  const graph = makeSites(seed, { size: TERRAIN.size, spacing: 54 });
  growBiomes(graph, seed);

  // 2. big grid heightfield (per-biome fBM, blended)
  const field = makeField(seed, { size: TERRAIN.size, N: TERRAIN.N }, graph);

  // 3. rivers carve the heightfield before meshing
  const hydro = carveRivers(field, seed);

  // 4. place project cities (link-based; needs biomes placed first)
  const placements = placeCities(field, graph, seed, CITIES);
  const cityPads = placements.map((p) => ({
    city: p.city, x: p.x, z: p.z, y: flattenPlateau(field, p.x, p.z, p.city.radius),
  }));
  const exclusions = cityPads.map((p) => ({ x: p.x, z: p.z, r: p.city.radius + 6 }));

  // 4b. the lone volcano: pick the most CENTRAL volcanic site (most volcanic
  // neighbours, away from any mountain/snow & the map edge), flatten a pad so the
  // cone always rises from FLAT ground, and pick a variable size. The terrain must
  // be flattened here — before it's meshed — so the cone is built later (step 10).
  let volcanoPad = null;
  // only volcanic sites inside the central disc are eligible — a volcano way out in
  // the unreachable backcountry would never be seen (and never reached).
  const volcSites = graph.sites.filter(
    (s) => s.biome === BIOME.VOLCANIC && Math.hypot(s.x, s.z) < 420
  );
  const vrand = mulberry32((seed ^ 0x901ca7) >>> 0);
  // the volcano is a RARE landmark — roughly a third of worlds simply don't get one
  // ("il peut ne pas apparaître"); the dark volcanic scrubland may still be there.
  if (volcSites.length && vrand() > 0.32) {
    const score = (s) => {
      let v = 0, m = 0;
      for (const n of graph.neighbors(s)) {
        if (n.biome === BIOME.VOLCANIC) v++;
        else if (n.biome === BIOME.MOUNTAIN || n.biome === BIOME.SNOW) m++;
      }
      const edge = Math.min(s.c, s.r, graph.cols - 1 - s.c, graph.rows - 1 - s.r);
      return v - 2 * m + Math.min(edge, 3) * 0.4;
    };
    const site = volcSites.slice().sort((a, b) => score(b) - score(a))[0];
    const vscale = 0.7 + vrand() * 0.95;            // variable size, per world
    // a WIDE flat pad so the cone sits in a field of dark scorched scrubland/cailloux
    // (the gravel + boulders are built around it in buildVolcano)
    const padR = 26 * vscale + 30;
    const py = flattenPlateau(field, site.x, site.z, padR);
    exclusions.push({ x: site.x, z: site.z, r: padR + 6 });
    volcanoPad = { x: site.x, y: py, z: site.z, scale: vscale, padR };
  }

  // 5. slope + scatter
  const slope = computeSlope(field);
  const scatter = planScatter(field, slope, hydro, seed, exclusions);

  // 6. terrain mesh (the big grid — its edge is far past the fog + the camera clamp)
  group.add(buildTerrainMesh(field));

  // 6b. scenic orientation: face the home camera toward the tallest distant terrain
  // (a natural mountain mass) so there are real mountains on the horizon ahead — no
  // bolted-on backdrop, just the generated range, sitting where the camera looks.
  const scenicAzimuth = scenicDirection(field) - Math.PI;

  // 7. rivers
  const rivers = buildRivers(hydro, field);
  group.add(rivers.group);
  updaters.push((t) => rivers.update(t));

  // 8. scatter bricks
  const trees = buildTrees(scatter);
  group.add(trees.group);
  updaters.push((t) => trees.update(t));
  group.add(buildRocks(scatter).group);

  // 9. cities
  for (const pad of cityPads) {
    const built = pad.city.build();
    built.group.position.set(pad.x, pad.y, pad.z);
    group.add(built.group);
    if (built.update) updaters.push((t, dt) => built.update(t, dt));
    cities.push({
      id: pad.city.id, radius: pad.city.radius,
      group: built.group, label: built.label,
      pois: built.pois || [],
      worldPos: new THREE.Vector3(pad.x, pad.y, pad.z),
    });
  }

  // 10. the lone volcano on its flattened pad (placed in step 4b, if any)
  if (volcanoPad) {
    const volcano = buildVolcano(volcanoPad, volcanoPad.scale);
    group.add(volcano.group);
    updaters.push((t, dt) => volcano.update(t, dt));
  }

  // 11. clouds — a few drifters overhead + a soft distant band at the fog horizon
  const clouds = buildClouds(seed, TERRAIN.half);
  group.add(clouds.group);
  updaters.push((t, dt) => clouds.update(t, dt));

  // 12. sea (covers the far bay + the horizon; segment count is capped in water.js)
  const sea = buildSea(TERRAIN.size);
  group.add(sea.mesh);
  updaters.push((t) => sea.update(t));

  return { group, updaters, cities, field, graph, hydro, slope, scatter, scenicAzimuth };
}

// Angle (world XZ) of the tallest distant terrain — sampled on a mid-far ring that
// sits inside the visible (pre-fog) range, so the home view always opens onto the
// generated mountains rather than flat plains.
function scenicDirection(field) {
  const STEPS = 60, radii = [620, 820, 1040];
  let bestTh = 0, bestH = -Infinity;
  for (let a = 0; a < STEPS; a++) {
    const th = (a / STEPS) * Math.PI * 2;
    let h = 0;
    for (const r of radii) h += field.heightAt(Math.cos(th) * r, Math.sin(th) * r);
    if (h > bestH) { bestH = h; bestTh = th; }
  }
  return bestTh;
}

// Flatten a smooth circular plateau into the heightfield at (ax,az).
function flattenPlateau(field, ax, az, radius) {
  const { N, idx, gx, gz, heights, size } = field;
  const half = size / 2;
  const toI = (w) => Math.round((w + half) / size * N);
  const ci = toI(ax), cj = toI(az);
  const cellsR = Math.ceil(radius / (size / N)) + 3;

  let sum = 0, cnt = 0;
  for (let dj = -cellsR; dj <= cellsR; dj++)
    for (let di = -cellsR; di <= cellsR; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i > N || j > N) continue;
      sum += heights[idx(i, j)]; cnt++;
    }
  let target = cnt ? sum / cnt : 10;
  target = Math.max(7, Math.min(target, 40));

  const blend = radius + 12;
  for (let dj = -cellsR; dj <= cellsR; dj++)
    for (let di = -cellsR; di <= cellsR; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i > N || j > N) continue;
      const dist = Math.hypot(gx(i) - ax, gz(j) - az);
      if (dist > blend) continue;
      const k = idx(i, j);
      const w = 1 - smoothstep(radius, blend, dist);
      heights[k] = heights[k] * (1 - w) + target * w;
    }
  return target;
}
