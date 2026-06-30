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
import { smoothstep } from './gen/noise.js';
import { CITIES } from './cities/registry.js';
import { placeCities } from './cities/placement.js';

export const WORLD = { size: 1000, half: 500 };

export function buildWorld(stage, seed) {
  const group = new THREE.Group();
  const updaters = [];
  const cities = [];

  // 1. Voronoi biome cells + constrained sequential growth
  const graph = makeSites(seed, { size: WORLD.size, spacing: 54 });
  growBiomes(graph, seed);

  // 2. big grid heightfield (per-biome fBM, blended)
  const field = makeField(seed, { size: WORLD.size, N: 256 }, graph);

  // 3. rivers carve the heightfield before meshing
  const hydro = carveRivers(field, seed);

  // 4. place project cities (link-based; needs biomes placed first)
  const placements = placeCities(field, graph, seed, CITIES);
  const cityPads = placements.map((p) => ({
    city: p.city, x: p.x, z: p.z, y: flattenPlateau(field, p.x, p.z, p.city.radius),
  }));
  const exclusions = cityPads.map((p) => ({ x: p.x, z: p.z, r: p.city.radius + 6 }));

  // 5. slope + scatter
  const slope = computeSlope(field);
  const scatter = planScatter(field, slope, hydro, seed, exclusions);

  // 6. terrain mesh
  group.add(buildTerrainMesh(field));

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
      id: pad.city.id, panelKey: pad.city.panelKey,
      labelKey: pad.city.labelKey, subKey: pad.city.subKey,
      radius: pad.city.radius,
      group: built.group, label: built.label,
      worldPos: new THREE.Vector3(pad.x, pad.y, pad.z),
    });
  }

  // 10. volcano on the volcanic hotspot (if any)
  const volcSite = graph.sites.find((s) => s.biome === BIOME.VOLCANIC);
  if (volcSite) {
    // highest vertex near the site
    let pk = { x: volcSite.x, y: field.heightAt(volcSite.x, volcSite.z), z: volcSite.z };
    for (let a = 0; a < 12; a++) {
      const ang = a / 12 * Math.PI * 2;
      for (const rr of [10, 22, 34]) {
        const x = volcSite.x + Math.cos(ang) * rr, z = volcSite.z + Math.sin(ang) * rr;
        const y = field.heightAt(x, z);
        if (y > pk.y) pk = { x, y, z };
      }
    }
    const volcano = buildVolcano(pk);
    group.add(volcano.group);
    updaters.push((t, dt) => volcano.update(t, dt));
  }

  // 11. clouds
  const clouds = buildClouds(seed, WORLD.half);
  group.add(clouds.group);
  updaters.push((t, dt) => clouds.update(t, dt));

  // 12. sea
  const sea = buildSea(WORLD.size);
  group.add(sea.mesh);
  updaters.push((t) => sea.update(t));

  return { group, updaters, cities, field, graph, hydro, slope, scatter };
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
