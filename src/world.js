// world.js — assembles the full world: Voronoi biomes → constrained growth →
// big grid heightfield → mesh + bricks + cities.
import * as THREE from 'three';
import { makeField } from './gen/heightmap.js';
import { makeSites } from './gen/voronoi.js';
import { growBiomes } from './gen/biomeGrowth.js';
import { computeSlope } from './gen/biomes.js';
import { carveRivers } from './gen/hydrology.js';
import { erode, settle } from './gen/erosion.js';
import { zonate, addCeiling, reliefOf } from './gen/relief.js';
import { planScatter } from './gen/placement.js';
import { findPeak, carveLakes, findFalls, traceLava } from './gen/features.js';
import { planFields } from './gen/farmland.js';
import { buildTerrainMesh } from './bricks/terrain.js';
import { buildRivers } from './bricks/rivers.js';
import { buildSea } from './bricks/water.js';
import { buildTrees } from './bricks/trees.js';
import { buildRocks } from './bricks/rocks.js';
import { buildClouds } from './bricks/clouds.js';
import { buildVolcano } from './bricks/volcano.js';
import { buildFalls } from './bricks/falls.js';
import { buildLakes } from './bricks/lakes.js';
import { buildFlying } from './bricks/flying.js';
import { buildBridges } from './bricks/bridges.js';
import { buildSkyways } from './bricks/skyways.js';
import { updateWeather } from './bricks/weather.js';
import { buildLife } from './bricks/life.js';
import { smoothstep, mulberry32 } from './gen/noise.js';
import { buildIslandField } from './gen/islands.js';
import { ACTIVE } from './themes.js';
import { CITIES } from './cities/registry.js';
import { placeCities } from './cities/placement.js';

// WORLD is the PLAYABLE / camera reference scale (immersed view, city roam disc).
// Generation PRESETS (?mode=) share that camera scale:
//   island (default) — a big island whose coast follows the Voronoi cells (sea is
//     forced as you get far from centre); a modest grid, so it loads fast anywhere.
//   floating (?world=floating) — the same country, broken up into islands adrift in
//     the sky, each riding at its own height: rock hangs beneath them, the rivers
//     pour off their edges, and a sea of cloud replaces the ocean (gen/islands.js).
//   land  (?mode=land) — the much larger endless continent; heavier to load.
export const WORLD = { size: 1000, half: 500 };
// `vista` is the radius scale of the ring the home view scans for mountains (see
// scenicDirection): it follows what the camera can SEE, not how far the land runs,
// so growing an island to seat more cities doesn't push that ring out into the fog.
// how many lakes a climate holds, and how many great falls a relief can show
const LAKES = { verdant: 4, boreal: 4, highlands: 4, arid: 1 };
const FALLS = { tables: 7, towers: 3, domes: 3 };
const PRESETS = {
  island: { size: 2000, half: 1000, N: 368, vista: 800 },
  floating: { size: 2000, half: 1000, N: 368, vista: 800, flying: true },
  land: { size: 3000, half: 1500, N: 512, vista: 1400 },
};

export function buildWorld(stage, seed, { mode = 'island', trend = null, relief = null } = {}) {
  const preset = PRESETS[mode] || PRESETS.island;
  // MOBILE preset: coarse-pointer devices get a lighter heightfield grid — same
  // world (biomes/rivers/cities are resolution-independent), ~2× fewer triangles.
  const coarse = typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches;
  const cfg = coarse ? { ...preset, N: Math.round(preset.N * 0.7) } : preset;
  const group = new THREE.Group();
  const updaters = [];
  const cities = [];

  // 1. Voronoi biome cells + constrained sequential growth
  const graph = makeSites(seed, { size: cfg.size, spacing: 54 });
  growBiomes(graph, seed, { mode, trend });

  // 2. grid heightfield (per-biome fBM, blended)
  const field = makeField(seed, { size: cfg.size, N: cfg.N, mode, relief }, graph);

  // 3. water shapes the land: erosion cuts valleys along the drainage lines, then
  // the rivers themselves get their channels — all before meshing
  // …and once the relief is final, altitude says what grows where (tree line, snow line)
  erode(field);
  settle(field, reliefOf(graph.massif).settle);
  zonate(field, graph);
  const peak = graph.massif.peak = findPeak(field);        // the roof of the country, as erosion left it
  const crater = graph.massif.crater;
  const hydro = carveRivers(field, seed, { keepOut: crater ? [{ x: crater.x, z: crater.z, r: crater.r * 1.8 }] : [] });

  // 4. place project cities (link-based; needs biomes placed first, and hydrology
  // so cities keep clear of rivers instead of straddling them)
  const placements = placeCities(field, graph, seed, CITIES, hydro);
  const cityPads = placements.map((p) => ({
    city: p.city, x: p.x, z: p.z, y: flattenPlateau(field, p.x, p.z, p.city.radius),
  }));
  const exclusions = cityPads.map((p) => ({ x: p.x, z: p.z, r: p.city.radius + 6 }));

  // 4a. any river that still crosses a city pad is SPLIT around it: the ribbon stops
  // at the pad edge and re-emerges on the far side (reads as slipping under the
  // settlement) instead of shooting flat across the raised plateau. The ravine keeps
  // its single longest clear run — a chasm through a city would be worse than a gap.
  const padZones = cityPads.map((p) => ({ x: p.x, z: p.z, r: p.city.radius + 10 }));
  hydro.rivers = splitLinesAroundZones(hydro.rivers, padZones, 4);
  if (hydro.ravine) {
    const runs = splitLinesAroundZones([hydro.ravine], padZones, 6);
    hydro.ravine = runs.length
      ? runs.reduce((a, b) => (b.length > a.length ? b : a))
      : null;
  }

  // 4c. FLYING ARCHIPELAGO (?world=floating): the country is broken up into islands
  // (gen/islands.js) — the towns' own, the massif's, a few wild islets — and each is
  // LIFTED to the height it rides at. What was already placed comes up with its
  // island; the rivers are cut at the edges, and where one runs off an edge it spills
  // into the air. Null in the grounded modes.
  let islandField = null;
  const spills = [];
  if (cfg.flying) {
    islandField = buildIslandField(field, cityPads.map((p) => ({ x: p.x, z: p.z, r: p.city.radius })), seed);
    for (const p of cityPads) p.y += field.liftAt(p.x, p.z);
    for (const line of hydro.rivers) for (const pt of line) pt.y += field.liftAt(pt.x, pt.z);
    // (the roof of the world may be another summit, now that every island has its own level)
    const { heights, verts, gx, gz } = field;
    let top = -1;
    for (let k = 0; k < heights.length; k++) if (islandField.used[k] && (top < 0 || heights[k] > heights[top])) top = k;
    if (top >= 0) Object.assign(peak, { x: gx(top % verts), y: heights[top], z: gz((top / verts) | 0) });
    hydro.rivers = clipLinesToIslands(hydro.rivers, islandField, 4, spills);
    if (hydro.ravine) hydro.ravine = clipLinesToIslands([hydro.ravine], islandField, 6).reduce((a, b) => (a && a.length >= b.length ? a : b), null);
  }

  // 4d. the SIGHTS of the relief (gen/features.js): lakes laid in the lowland hollows,
  // the lava's ways down a volcano, the lips the streams fall from
  const onLand = islandField ? (x, z) => islandField.atWorld(x, z, 6) : null;
  const lakes = carveLakes(field, graph, seed, {
    count: LAKES[graph.trend] ?? 3, inside: onLand, ...(islandField ? { size: [13, 17] } : {}),
    avoid: cityPads.map((p) => ({ x: p.x, z: p.z, r: p.city.radius * (islandField ? 1.5 : 2.1) })),   // (clear of the shelf each town levelled)
  });
  exclusions.push(...lakes);
  const lava = crater && (!onLand || onLand(crater.x, crater.z)) ? traceLava(field, crater) : null;
  if (lava) {
    if (onLand) {                                            // a floating island: the streams end at its edge
      for (const flow of lava.flows) { const cut = flow.pts.findIndex((p) => !onLand(p.x, p.z)); if (cut >= 0) flow.pts.length = cut; }
      lava.flows = lava.flows.filter((flow) => flow.pts.length >= 6);
    }
    exclusions.push({ x: lava.x, z: lava.z, r: lava.reach + 8 });
    for (const flow of lava.flows) for (let i = 0; i < flow.pts.length; i += 2) exclusions.push({ x: flow.pts[i].x, z: flow.pts[i].z, r: 7 });
  }
  // …and round the farming towns, their fields
  const fields = planFields(field, cityPads, seed, graph.trend, { skip: exclusions.slice(cityPads.length) });
  const falls = findFalls(field, { max: Math.ceil((FALLS[graph.massif.style] ?? 5) * (graph.trend === 'arid' ? 0.45 : 1)), avoid: exclusions, inside: onLand });
  // …and off the edge of a floating island, the biggest of its rivers fall free
  spills.sort((a, b) => b.flow - a.flow);
  for (const sp of spills.slice(0, 9)) {
    if (falls.some((f) => f.free && Math.hypot(f.lip.x - sp.x, f.lip.z - sp.z) < 60)) continue;
    falls.push({ lip: { x: sp.x, y: field.heightAt(sp.x, sp.z), z: sp.z }, dir: sp.dir, drop: 150 + ((sp.x * 7 + sp.z * 13) % 90 + 90) % 90, flow: sp.flow, free: true });
  }

  // the ground is final: what the camera must stay above (see camera.js)
  addCeiling(field);

  // 4e. what lives here (herds, birds, sails) and the curiosities a traveller finds —
  // placed before the vegetation, which keeps off the ground they stand on
  const life = buildLife(field, graph, seed, { exclusions, islands: islandField, barns: fields ? fields.barns : [] });
  group.add(life.group);
  updaters.push((t, dt) => life.update(t, dt));
  exclusions.push(...life.claims);

  // 5. slope + scatter
  const slope = computeSlope(field);
  const scatter = planScatter(field, slope, hydro, seed, exclusions, graph.trend, fields);
  if (islandField) {
    for (const key of ['trees', 'bushes', 'rocks', 'reeds']) scatter[key] = scatter[key].filter((t) => islandField.atWorld(t.x, t.z, 2.5));
    scatter.stacks = [];              // no sea under a floating island
  }

  // 6. terrain mesh (its edge is far past the fog + the camera clamp; in the
  // archipelago, only the islands' own triangles are built).
  // CITY-TERRAIN FUSION: the ground around each city is tinted toward that city's
  // own ground colour, so the pad reads as growing out of the landscape instead of
  // a plate dropped onto it.
  const CITY_GROUND = {
    apairo: 0xd8d2c2, toaster: 0x3a3f49, splasher: 0x212a36, about: 0xb6a07e,
    projector: 0x241f2b, rubicon: 0x3a4a2c, hubs: 0x9c9485,
    foliome: 0xd3d9e4,
  };
  const groundZones = cityPads.map((p) => ({
    x: p.x, z: p.z, r: p.city.radius,
    color: CITY_GROUND[p.city.id] ?? 0xb6a07e,
  }));
  const terrain = buildTerrainMesh(field, {
    shape: islandField, zones: groundZones, fields,
  });
  group.add(terrain.mesh);

  // 6b. scenic orientation: face the home camera toward the tallest distant terrain
  // (a natural mountain mass) so there are real mountains on the horizon ahead — no
  // bolted-on backdrop, just the generated range, sitting where the camera looks.
  // (the camera's azimuth is measured from +Z toward +X; it stands OPPOSITE what it looks at)
  const scenic = scenicDirection(field, cfg.vista, islandField);
  const scenicAzimuth = Math.atan2(-Math.cos(scenic), -Math.sin(scenic));

  // 7. rivers, lakes, the great falls — and the fire, where the mountain is a volcano
  const rivers = buildRivers(hydro, field);
  group.add(rivers.group);
  updaters.push((t) => rivers.update(t));
  const still = buildLakes(lakes);
  group.add(still.group);
  updaters.push((t) => still.update(t));
  const cascades = buildFalls(falls, field);
  group.add(cascades.group);
  updaters.push((t) => cascades.update(t));
  if (lava) {
    const volcano = buildVolcano(lava, field);
    group.add(volcano.group);
    updaters.push((t) => volcano.update(t));
  }

  // 8. scatter bricks
  const trees = buildTrees(scatter);
  group.add(trees.group);
  updaters.push((t) => updateWeather(t));       // the wind in the leaves, the clouds' shadows
  group.add(buildRocks(scatter).group);

  // 9. cities
  for (const pad of cityPads) {
    const built = pad.city.build();
    // slightly EMBEDDED: sinking the city half a unit hides its building bases in the
    // ground (nothing floats); the ground a city stands on is at local y = 0.5
    built.group.position.set(pad.x, pad.y - 0.5, pad.z);
    group.add(built.group);
    const casters = sortDetail(built.group, cities.length);
    cities.push({
      id: pad.city.id, radius: pad.city.radius,
      casters, casting: { medium: true, large: true },
      update: built.update ? (t, dt) => built.update(t, dt) : null,   // run by tickCities, below
      group: built.group, label: built.label,
      pois: built.pois || [],
      frame: built.frame || null,     // optional hero-framing hint for the dive-in
      worldPos: new THREE.Vector3(pad.x, pad.y, pad.z),
    });
  }

  // 10b. SKYWAYS — a sparse random subset of elevated tubes linking cities, with
  // travelling data-pulses, plus two quiet aircraft high above (the croquis nod).
  // On floating worlds the tubes glide across the void between islands (pylons
  // only where there is land under them) and the aircraft fly all the same.
  {
    const sky = buildSkyways(field, cityPads, seed, { islands: islandField, obstacles: life.tall });
    group.add(sky.group);
    updaters.push((t, dt) => sky.update(t, dt));
  }

  // 11. clouds — a few drifters overhead + a soft distant band at the fog horizon
  const clouds = buildClouds(seed, cfg.half, { peak: lava ? null : peak });       // (a volcano wears its own plume)
  group.add(clouds.group);
  updaters.push((t, dt) => clouds.update(t, dt));

  // 12. sea — flat across the island (its lakes), swelling to waves only out in the
  // open sea toward the horizon. (segments capped in water.js)
  const sea = buildSea(cfg.size, { calmR: cfg.half * 0.85, waveR: cfg.half * 1.3, field });
  group.add(sea.mesh);
  updaters.push((t) => sea.update(t));

  // 13. FLYING-ISLAND rig (the rock under the islands, what drifts round them, the
  // sea of cloud) — a GENERATION mode, not a theme: the ocean is hidden. Built only
  // for floating worlds. See bricks/flying.js.
  if (cfg.flying) {
    const flying = buildFlying(field, cfg.half, seed, { islands: islandField, trend: graph.trend });
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
    terrain.restyle(); sea.restyle(); still.restyle(); trees.restyle(); pastelizeCities(cities);
  };
  pastelizeCities(cities);            // bake the active ambiance into the cities now

  // Once per frame, with the camera: each city shows only the detail that can be seen
  // from where the camera is, and animates only as often as that is worth.
  const away = (eye, c) => Math.max(0, eye.distanceTo(c.worldPos) - c.radius);
  // the camera layers worth drawing for an eye at `eye` (layer 0 = everything unsorted)
  const detailMask = (eye, viewportH = 800) => {
    const zoom = Math.max(0.8, Math.min(2.2, viewportH / 800));     // bigger screen: detail shows from farther
    let mask = 1;
    cities.forEach((c, i) => {
      const d = away(eye, c);
      for (let b = 0; b < DETAIL.length; b++) {
        const layer = detailLayer(i, b);
        if (layer <= 31 && d <= DETAIL[b].beyond * zoom) mask |= 1 << layer;
      }
    });
    return mask;
  };
  const cast = (c, cls, on) => {
    if (c.casting[cls] === on) return;
    c.casting[cls] = on;
    for (const o of c.casters[cls]) o.castShadow = on;
  };
  let frame = 0;
  const tickCities = (t, dt, camera, viewportH = 800) => {
    frame++;
    camera.layers.mask = detailMask(camera.position, viewportH);
    cities.forEach((c, i) => {
      const d = away(camera.position, c);
      // a shadow is drawn once per caster: only where it is big enough to be seen
      cast(c, 'medium', d < SHADOWS.medium); cast(c, 'large', d < SHADOWS.large);
      // every frame up close, one frame in three from afar, not at all once lost in the fog
      if (c.update && d < 1400 && (d < 380 || (frame + i) % 3 === 0)) c.update(t, d < 380 ? dt : dt * 3);
    });
  };

  const sight = (f) => (f.free
    ? { x: f.lip.x, y: f.lip.y - 40, z: f.lip.z, look: Math.atan2(f.dir.x, f.dir.z), drop: f.drop }
    : { x: f.foot.x, y: (f.foot.y + f.lip.y) / 2, z: f.foot.z, look: Math.atan2(f.foot.x - f.lip.x, f.foot.z - f.lip.z), drop: f.drop });
  const spill = falls.find((f) => f.free);
  const places = {
    ...life.places, summit: peak,
    ...(lakes[0] ? { lake: { x: lakes[0].x, y: lakes[0].level, z: lakes[0].z } } : {}),
    ...(falls[0] ? { falls: sight(falls[0]) } : {}), ...(spill ? { spill: sight(spill) } : {}),
  };
  return { group, updaters, cities, tickCities, detailMask, field, graph, hydro, slope, scatter, scenicAzimuth, restyle, trend: graph.trend, relief: graph.massif.style, places, islands: islandField };
}

// ---- LEVEL OF DETAIL --------------------------------------------------------------
// A city is thousands of small parts, and from the map most of them are a pixel or
// less — yet each still costs a draw call, in every pass. So every part is sorted by
// SIZE into one of three detail classes, each class of each city on a camera LAYER of
// its own; tickCities turns a layer off when the city is too far for that class to be
// worth drawing. (Layers, not `.visible`: the cities' own animations own that flag.)
// `beyond` is where a part of that size shrinks to about two pixels on an 800px view.
const DETAIL = [
  { below: 0.35, beyond: 280 },
  { below: 0.8, beyond: 620 },
  { below: 1.6, beyond: 1200 },
];
const detailLayer = (cityIndex, cls) => 1 + cityIndex * DETAIL.length + cls;

// SHADOWS go the same way. The sun's shadow map covers the whole island, a texel of
// it nearly a metre wide: a small part cannot cast a shadow worth the name (never
// does, then), a middling one only shows from close by, and even a tower's is lost
// from the far side of the island. tickCities switches each city's casters on that.
const SHADOWS = { never: 1.2, mediumBelow: 4, medium: 450, large: 950 };

// → { medium: [...], large: [...] }: the city's shadow casters, by size
function sortDetail(cityGroup, cityIndex) {
  cityGroup.updateMatrixWorld(true);
  const scale = new THREE.Vector3(), casters = { medium: [], large: [] };
  cityGroup.traverse((o) => {
    if (!(o.isMesh || o.isLine || o.isPoints) || o.userData.isLabel || o.userData.isPortalDisc) return;
    let size = o.userData.detail;                 // instanced meshes say how big ONE instance is
    if (size == null) {
      if (o.isInstancedMesh) size = Infinity;
      else {
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        o.getWorldScale(scale);
        size = o.geometry.boundingSphere.radius * Math.max(scale.x, scale.y, scale.z);
      }
    }
    const cls = DETAIL.findIndex((c) => size < c.below);
    if (cls >= 0 && detailLayer(cityIndex, cls) <= 31) o.layers.set(detailLayer(cityIndex, cls));
    if (o.isMesh && o.castShadow) {
      if (size < SHADOWS.never) o.castShadow = false;
      else (size < SHADOWS.mediumBelow ? casters.medium : casters.large).push(o);
    }
  });
  return casters;
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

// Split polylines around circular exclusion zones (city pads): each line becomes
// the list of its contiguous runs OUTSIDE every zone, dropping runs shorter than
// minLen. Unlike clipLinesToIslands this keeps ALL runs, so a river that crosses a
// pad re-emerges downstream instead of vanishing.
function splitLinesAroundZones(lines, zones, minLen) {
  const inside = (p) => {
    for (const z of zones) {
      const dx = p.x - z.x, dz = p.z - z.z;
      if (dx * dx + dz * dz < z.r * z.r) return true;
    }
    return false;
  };
  const out = [];
  for (const line of lines) {
    let run = [];
    for (const p of line) {
      if (inside(p)) {
        if (run.length >= minLen) out.push(run);
        run = [];
      } else run.push(p);
    }
    if (run.length >= minLen) out.push(run);
  }
  return out;
}

// Clip river/ravine polylines to the archipelago: every run of points that lies on an
// island is kept (a river may cross two of them), runs shorter than `minLen` dropped —
// so no water ribbon is left hanging in the sky. Where a run ends because the ground
// does (the water was still flowing), that is a SPILL: { x, z, dir, flow } is pushed
// onto `spills` — the river goes over the edge there.
function clipLinesToIslands(lines, islandField, minLen, spills = null) {
  const out = [];
  for (const line of lines) {
    let run = [];
    const flush = (next) => {
      if (run.length >= minLen) {
        out.push(run);
        const end = run[run.length - 1], prev = run[run.length - 3] || run[0];
        const dx = end.x - prev.x, dz = end.z - prev.z, len = Math.hypot(dx, dz) || 1;
        const ahead = next || { x: end.x + dx / len * 8, z: end.z + dz / len * 8 };
        if (spills && !islandField.atWorld(ahead.x, ahead.z) && !islandField.atWorld(end.x + dx / len * 16, end.z + dz / len * 16)) {
          spills.push({ x: end.x, z: end.z, dir: { x: dx / len, z: dz / len }, flow: end.acc || 12 });
        }
      }
      run = [];
    };
    for (const p of line) {
      if (islandField.atWorld(p.x, p.z, 1.5)) run.push(p);
      else flush(p);
    }
    flush(null);
  }
  return out;
}

// Angle (world XZ) of the tallest distant terrain — sampled on a mid-far ring that
// sits inside the visible (pre-fog) range, so the home view always opens onto the
// generated mountains rather than flat plains.
function scenicDirection(field, vista, islandField) {
  const STEPS = 60, radii = [0.46 * vista, 0.62 * vista, 0.80 * vista];
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

// Settle a city into the heightfield at (ax,az): the core (out to 0.9 × radius) is
// LEVELLED — a city has streets and squares, and thin things laid on the ground need
// ground that is actually flat — while a WIDE gentle halo eases the surrounding
// terrain toward the city level, so the settlement sits in a natural shelf instead
// of on a dropped plate. Returns that level: the city's ground.
function flattenPlateau(field, ax, az, radius) {
  const { N, idx, gx, gz, heights, size } = field;
  const half = size / 2;
  const toI = (w) => Math.round((w + half) / size * N);
  const ci = toI(ax), cj = toI(az);
  const halo = radius * 2.1;
  const cellsR = Math.ceil(halo / (size / N)) + 3;

  let sum = 0, cnt = 0;
  for (let dj = -cellsR; dj <= cellsR; dj++)
    for (let di = -cellsR; di <= cellsR; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i > N || j > N) continue;
      if (Math.hypot(gx(i) - ax, gz(j) - az) > radius) continue;
      sum += heights[idx(i, j)]; cnt++;
    }
  let target = cnt ? sum / cnt : 10;
  target = Math.max(7, Math.min(target, 52));

  for (let dj = -cellsR; dj <= cellsR; dj++)
    for (let di = -cellsR; di <= cellsR; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i > N || j > N) continue;
      const dist = Math.hypot(gx(i) - ax, gz(j) - az);
      if (dist > halo) continue;
      const k = idx(i, j);
      // core: fully level; then a ramp; halo: a light distant pull so the land
      // rises or falls to meet the city
      const wCore = 1 - smoothstep(radius * 0.9, radius * 1.25, dist);
      const wHalo = (1 - smoothstep(radius * 1.05, halo, dist)) * 0.35;
      const w = Math.min(1, wCore + wHalo);
      heights[k] = heights[k] * (1 - w) + target * w;
    }
  return target;
}
