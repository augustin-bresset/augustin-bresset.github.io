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
import { buildFlying } from './bricks/flying.js';
import { buildBridges } from './bricks/bridges.js';
import { smoothstep, mulberry32 } from './gen/noise.js';
import { buildIslandField } from './gen/islands.js';
import { ACTIVE } from './themes.js';
import { CITIES } from './cities/registry.js';
import { placeCities } from './cities/placement.js';

// WORLD is the PLAYABLE / camera reference scale (immersed view, city roam disc).
// Generation PRESETS (?mode=) share that camera scale:
//   island (default) — a big island whose coast follows the Voronoi cells (sea is
//     forced as you get far from centre); a modest grid, so it loads fast anywhere.
//   floating (?mode=floating) — the same island generation, but adrift in a blue
//     sky: a jagged rock underside hangs beneath it and a cloud sea replaces the
//     ocean (the flying island is a way to GENERATE the world, not a theme).
//   land  (?mode=land) — the much larger endless continent; heavier to load.
export const WORLD = { size: 1000, half: 500 };
const PRESETS = {
  island: { size: 1600, half: 800, N: 320 },
  floating: { size: 1600, half: 800, N: 320, flying: true },
  land: { size: 2800, half: 1400, N: 512 },
};

export function buildWorld(stage, seed, { mode = 'island' } = {}) {
  const cfg = PRESETS[mode] || PRESETS.island;
  const group = new THREE.Group();
  const updaters = [];
  const cities = [];

  // 1. Voronoi biome cells + constrained sequential growth
  const graph = makeSites(seed, { size: cfg.size, spacing: 54 });
  growBiomes(graph, seed, { mode });

  // 2. grid heightfield (per-biome fBM, blended)
  const field = makeField(seed, { size: cfg.size, N: cfg.N, mode }, graph);

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

    // rivers must not run through the volcano (the flat pad would otherwise pull
    // flow straight across the crater). Truncate any river/ravine at its first
    // entry into the cone's footprint — it reads as "swallowed" by the lava field
    // rather than pouring out of the summit.
    const vr2 = (padR + 14) * (padR + 14);
    const clipAtVolcano = (line) => {
      let cut = line.length;
      for (let i = 0; i < line.length; i++) {
        const dx = line[i].x - site.x, dz = line[i].z - site.z;
        if (dx * dx + dz * dz < vr2) { cut = i; break; }
      }
      return line.slice(0, cut);
    };
    hydro.rivers = hydro.rivers.map(clipAtVolcano).filter((l) => l.length >= 4);
    if (hydro.ravine) {
      const rav = clipAtVolcano(hydro.ravine);
      hydro.ravine = rav.length >= 6 ? rav : null;
    }
  }

  // 4c. FLYING ARCHIPELAGO (?mode=floating): carve the continent into SEPARATE
  // floating islands — one blob of land per settlement (+ the volcano). The field
  // masks the terrain (sky between islands), culls scatter that would float in the
  // void, clips rivers to the land, and hands each island a coastline rim so the
  // flying rig can hang a matching rocky underside. Null in the grounded modes.
  let islandField = null;
  if (cfg.flying) {
    const anchors = cityPads.map((p) => ({ x: p.x, z: p.z }));
    if (volcanoPad) anchors.push({ x: volcanoPad.x, z: volcanoPad.z });
    islandField = buildIslandField(field, anchors, seed);
    hydro.rivers = clipLinesToIslands(hydro.rivers, islandField, 4);
    if (hydro.ravine) {
      const rav = clipLinesToIslands([hydro.ravine], islandField, 6)[0] || null;
      hydro.ravine = rav;
    }
  }

  // 5. slope + scatter
  const slope = computeSlope(field);
  const scatter = planScatter(field, slope, hydro, seed, exclusions);
  if (islandField) {
    scatter.trees = scatter.trees.filter((t) => islandField.atWorld(t.x, t.z));
    scatter.rocks = scatter.rocks.filter((r) => islandField.atWorld(r.x, r.z));
  }

  // 6. terrain mesh (its edge is far past the fog + the camera clamp; in the
  // archipelago, masked cells collapse to nothing so only the islands remain)
  const terrain = buildTerrainMesh(field, islandField ? { cellVisible: islandField.cellVisible } : {});
  group.add(terrain.mesh);

  // 6b. scenic orientation: face the home camera toward the tallest distant terrain
  // (a natural mountain mass) so there are real mountains on the horizon ahead — no
  // bolted-on backdrop, just the generated range, sitting where the camera looks.
  const scenicAzimuth = scenicDirection(field, cfg.half, islandField) - Math.PI;

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
      frame: built.frame || null,     // optional hero-framing hint for the dive-in
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
  const clouds = buildClouds(seed, cfg.half);
  group.add(clouds.group);
  updaters.push((t, dt) => clouds.update(t, dt));

  // 12. sea — flat across the island (its lakes), swelling to waves only out in the
  // open sea toward the horizon. (segments capped in water.js)
  const sea = buildSea(cfg.size, { calmR: cfg.half * 0.85, waveR: cfg.half * 1.3 });
  group.add(sea.mesh);
  updaters.push((t) => sea.update(t));

  // 13. FLYING-ISLAND rig (underside rock + cloud sea) — this is a GENERATION mode
  // (?mode=floating), not a theme: when on, the rock underside hangs below the
  // island, a cloud sea replaces the ocean, and the sea plane is hidden. Built only
  // for floating worlds. See bricks/flying.js.
  if (cfg.flying) {
    const flying = buildFlying(field, cfg.half, seed, { islands: islandField });
    group.add(flying.group);
    flying.setVisible(true);
    sea.mesh.visible = false;        // no ocean under a floating island
    updaters.push((t) => flying.update(t));

    // Wooden rope bridges between islands close enough to connect.
    const bridges = buildBridges(field, islandField, seed);
    group.add(bridges);
  }

  // re-apply the active AMBIANCE to this world's baked meshes (vertex colours,
  // water, city materials) without rebuilding geometry. The flying rig is fixed by
  // the mode, so a theme switch never touches it.
  const restyle = () => {
    terrain.restyle(); sea.restyle(); trees.restyle(); pastelizeCities(cities);
  };
  pastelizeCities(cities);            // bake the active ambiance into the cities now

  return { group, updaters, cities, field, graph, hydro, slope, scatter, scenicAzimuth, restyle };
}

// ---- CROQUIS city pastel ---------------------------------------------------
// The project cities are built as neon cyberpunk districts (dark charcoals +
// blazing emissive). On the pale pastel world that reads as heavy ink blots, so
// in the croquis we redraw them as a soft coloured-pencil sketch: every material's
// base colour is lifted toward white and the neon is dimmed to a gentle accent
// (hue kept, blaze gone) — "beaucoup de couleur mais pâle". Originals are
// snapshotted (userData.__croq) so a switch back to the diorama restores the neon.
// The cities' update() loops only touch emissiveIntensity/opacity — never .color or
// .emissive colour — so this one-shot restyle survives the animation loop.
const _croqWhite = new THREE.Color(0xffffff);
function pastelizeCities(cityList) {
  const p = ACTIVE.pastel || 0;
  const lift = Math.min(0.72, p + 0.26);   // building bodies → pale pencil
  const emis = Math.max(0, 1 - p * 1.05);  // neon → soft coloured-pencil accent
  for (const c of cityList) {
    c.group.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (!m.userData.__croq) {
          m.userData.__croq = {
            color: m.color ? m.color.clone() : null,
            emissive: m.emissive ? m.emissive.clone() : null,
          };
        }
        const o0 = m.userData.__croq;
        if (m.color && o0.color) {
          m.color.copy(o0.color);
          if (p) m.color.lerp(_croqWhite, lift);
        }
        if (m.emissive && o0.emissive) {
          m.emissive.copy(o0.emissive);
          if (p) m.emissive.multiplyScalar(emis);
        }
      }
    });
  }
}

// Clip river/ravine polylines to the archipelago: keep each line's LONGEST run of
// points that sit on island land, dropping runs shorter than `minLen` — so no water
// ribbon is left hanging in the sky over a masked gap.
function clipLinesToIslands(lines, islandField, minLen) {
  const out = [];
  for (const line of lines) {
    let best = null, run = [];
    const flush = () => {
      if (run.length >= minLen && (!best || run.length > best.length)) best = run;
      run = [];
    };
    for (const p of line) {
      if (islandField.atWorld(p.x, p.z)) run.push(p);
      else flush();
    }
    flush();
    if (best) out.push(best);
  }
  return out;
}

// Angle (world XZ) of the tallest distant terrain — sampled on a mid-far ring that
// sits inside the visible (pre-fog) range, so the home view always opens onto the
// generated mountains rather than flat plains.
function scenicDirection(field, half, islandField) {
  const STEPS = 60, radii = [0.46 * half, 0.62 * half, 0.80 * half];
  let bestTh = 0, bestH = -Infinity;
  for (let a = 0; a < STEPS; a++) {
    const th = (a / STEPS) * Math.PI * 2;
    let h = 0;
    for (const r of radii) {
      const x = Math.cos(th) * r, z = Math.sin(th) * r;
      // in the archipelago, don't aim the home view at sky the mask carved away —
      // only count directions that still have island land at the sampled ring points.
      if (islandField && !islandField.atWorld(x, z)) continue;
      h += field.heightAt(x, z);
    }
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
