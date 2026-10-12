// relief.js — the GREAT RELIEF: what makes a land read as a country rather than a lawn.
//
// The biome noise (heightmap.js) gives every region a texture of its own — rolling
// plains, bumpy hills — but all of it at one modest scale: nothing in it can be a
// mountain you look UP at. This file adds the thing that can:
//
//   the MASSIF — a chain of real summits standing off to one side of the country,
//   several times taller than anything else, and a LESSER range answering it from
//   another side. They are described, not sampled from noise: a bent SPINE of a few
//   named points, each with a summit height and a breadth.
//
//   What rises along that spine depends on the world's RELIEF — the SHAPE its
//   mountains take, from the roundest to the sharpest:
//     domes    old worn mountains: broad round backs, sugarloaf knobs on their flanks
//     crests   a classic range: ridges, couloirs, pointed summits
//     needles  spires and pinnacles on a steep narrow range
//     tables   tepuis: flat tops at several levels, sheer walls between them
//     towers   karst: a forest of separate stone pillars, woods on their heads
//     volcano  one great cone standing alone, a crater at its top
//
// …and, once the heights are final, what the altitude does to the land (ZONATION):
// the forest gives way to dark conifers, the conifers to bare rock at the tree line,
// the rock to snow — whatever biome the lowland at the mountain's foot happens to be.
import { Simplex, mulberry32, clamp, lerp, smoothstep } from './noise.js';
import { BIOME } from './biomes.js';

// per world character: how tall the massif stands, and where its tree and snow lines run
const CHARACTER = {
  balanced: { tall: 1.0, tree: 92, snow: 140 },
  alpine: { tall: 1.22, tree: 88, snow: 128 },
  boreal: { tall: 1.0, tree: 68, snow: 100 },
  highlands: { tall: 0.92, tree: 82, snow: 134 },
  prairie: { tall: 0.82, tree: 96, snow: 146 },
  verdant: { tall: 0.95, tree: 112, snow: 160 },
  autumn: { tall: 0.95, tree: 94, snow: 140 },
  tropical: { tall: 1.05, tree: 150, snow: 232 },
  arid: { tall: 1.0, tree: 110, snow: 200 },
};
export const characterOf = (trend) => CHARACTER[trend] || CHARACTER.balanced;

// per relief: tall / wide — how it stands next to a classic range · rough — how ridged
// the REGIONAL hills are in such a world (heightmap.js) · settle — how much scree its
// slopes shed (erosion.js): a needle keeps its edge, a dome is all worn down, and a
// cliff that is meant to stand sheer is left alone.
export const RELIEF = {
  domes: { tall: 0.84, wide: 1.2, rough: 0.3, settle: { passes: 9, repose: 0.82 } },
  crests: { tall: 1.0, wide: 1.0, rough: 1.0, settle: { passes: 5, repose: 1.15 } },
  needles: { tall: 1.22, wide: 0.82, rough: 1.0, settle: { passes: 2, repose: 2.6 } },
  tables: { tall: 0.74, wide: 1.0, rough: 0.6, settle: { passes: 0, repose: 9 } },
  towers: { tall: 0.8, wide: 1.1, rough: 0.6, settle: { passes: 0, repose: 9 } },
  volcano: { tall: 1.08, wide: 1.0, rough: 0.8, settle: { passes: 4, repose: 1.3 } },
};
export const RELIEF_KEYS = Object.keys(RELIEF);
export const reliefOf = (massif) => RELIEF[massif && massif.style] || RELIEF.crests;

// what each climate tends to raise (relative odds)
const LIKELY = {
  balanced: { crests: 3, needles: 2, domes: 2, tables: 1, towers: 1, volcano: 2 },
  alpine: { needles: 4, crests: 3, domes: 0.5, volcano: 0.6 },
  boreal: { crests: 3, needles: 2, domes: 2, volcano: 1.5, tables: 1 },
  highlands: { domes: 4, tables: 3, crests: 1.5, needles: 0.5 },
  prairie: { domes: 3, tables: 2, crests: 2, volcano: 1 },
  verdant: { domes: 2, crests: 2, towers: 2, needles: 1, tables: 1, volcano: 1 },
  autumn: { domes: 3, crests: 3, needles: 1.5, towers: 1 },
  tropical: { towers: 4, volcano: 4, tables: 3, needles: 1, crests: 1 },
  arid: { tables: 5, needles: 2, domes: 2, volcano: 2, crests: 1 },
};

// a spine: `n` summits strung across a bearing, `away` from the middle of the country
function chain(rand, bearing, away, { length, n, top, wide, style, girth = [128, 88] }) {
  const cx = Math.cos(bearing) * away, cz = Math.sin(bearing) * away;
  // the chain runs ACROSS that bearing — a wall behind the plains — and bows a little
  const along = bearing + Math.PI / 2 + (rand() - 0.5) * 0.8;
  const bow = (rand() - 0.5) * 0.23 * length;
  const ax = Math.cos(along), az = Math.sin(along), ox = Math.cos(bearing), oz = Math.sin(bearing);
  const king = n > 3 ? 1 + ((rand() * (n - 2)) | 0) : n >> 1;      // which of the summits is the highest
  const nodes = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5, end = i === 0 || i === n - 1;
    const out = bow * (1 - 4 * u * u) + (rand() - 0.5) * 46;
    const h = i === king ? top : top * (end ? 0.3 + rand() * 0.16 : 0.5 + rand() * 0.3);
    nodes.push({
      x: cx + ax * length * u + ox * out, z: cz + az * length * u + oz * out,
      h, w: (girth[0] + girth[1] * (h / top)) * wide, lobe: rand() * 6.28,
    });
  }
  return { style, nodes, king, top };
}

// Lay the relief out: its shape, where its spines run, how high each summit stands.
// forced: a RELIEF key to raise that shape whatever the climate would have drawn.
export function planMassif(seed, graph, forced = null) {
  const rand = mulberry32((seed ^ 0x6a55f1) >>> 0);
  const { tall } = characterOf(graph.trend);
  const odds = LIKELY[graph.trend] || LIKELY.balanced;
  let style = 'crests', roll = rand() * Object.values(odds).reduce((a, b) => a + b, 0);
  for (const k in odds) { roll -= odds[k]; if (roll <= 0) { style = k; break; } }
  if (RELIEF[forced]) style = forced;
  const shape = RELIEF[style];
  // off to one side of the country: the settlements keep the plains at its feet
  const bearing = rand() * Math.PI * 2;
  const top = (232 + rand() * 60) * tall * shape.tall;              // the roof of the island
  const chains = [];
  let summit, crater = null;
  if (style === 'volcano') {
    const away = 405 + rand() * 70;
    const cone = {
      style, x: Math.cos(bearing) * away, z: Math.sin(bearing) * away, h: top,
      W: 300 + rand() * 40, rc: 34 + rand() * 12, depth: 42 + rand() * 16,
      breach: bearing + Math.PI + (rand() - 0.5) * 1.6,             // the rim is broken on the side of the plains
      cones: [],
    };
    for (let i = 0, n = 2 + ((rand() * 2) | 0); i < n; i++) {       // cinder cones on its lower flanks
      const a = rand() * 6.28, d = cone.W * (0.52 + rand() * 0.3);
      cone.cones.push({ x: cone.x + Math.cos(a) * d, z: cone.z + Math.sin(a) * d, h: 24 + rand() * 22, r: 36 + rand() * 20 });
    }
    chains.push(cone);
    summit = { x: cone.x, z: cone.z, h: top };
    crater = { x: cone.x, z: cone.z, r: cone.rc, breach: cone.breach };
  } else {
    const main = chain(rand, bearing, 345 + rand() * 105, { length: 540 + rand() * 220, n: 5, top, wide: shape.wide, style });
    chains.push(main);
    summit = main.nodes[main.king];
  }
  // …and a LESSER range on another side, so the skyline is not all in one quarter
  chains.push(chain(rand, bearing + Math.PI * (0.6 + rand() * 0.8), 450 + rand() * 80, {
    length: 300 + rand() * 130, n: 3, top: top * (0.4 + rand() * 0.16), wide: shape.wide,
    style: style === 'volcano' ? 'domes' : style, girth: [84, 56],
  }));
  return { style, chains, top, summit, crater, seed };
}

// ---- how the ground stands with respect to a spine --------------------------------
// → res.rise: the height the profile gives here · res.m: how far in from the foot (0)
// to the spine (1) · res.crest: the height of the crest abreast of here
function span(nodes, qx, qz, profile, dip, res) {
  let rise = 0, m = 0, crest = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1];
    const vx = b.x - a.x, vz = b.z - a.z;
    const u = clamp(((qx - a.x) * vx + (qz - a.z) * vz) / (vx * vx + vz * vz), 0, 1);
    const d = Math.hypot(qx - (a.x + vx * u), qz - (a.z + vz * u));
    const s = u * u * (3 - 2 * u);
    const w = lerp(a.w, b.w, s);
    if (d >= w) continue;
    // between two summits the crest dips to a pass
    const h = lerp(a.h, b.h, s) * (1 - dip * Math.sin(Math.PI * u));
    const f = 1 - d / w, v = h * profile(f);
    if (v > rise) { rise = v; crest = h; }
    if (f > m) m = f;
  }
  res.rise = rise; res.m = m; res.crest = crest;
  return res;
}
// each summit is a true point, whatever the noise says: the sum of their bumps here
function points(nodes, qx, qz, breadth) {
  let sum = 0;
  for (const p of nodes) {
    const d2 = ((qx - p.x) * (qx - p.x) + (qz - p.z) * (qz - p.z)) / (p.w * p.w * breadth);
    if (d2 < 6) sum += p.h * Math.exp(-d2);
  }
  return sum;
}
// the nearest of a scatter of points, one to each square of side `size` (cellular
// noise) → res.d: how far it is · res.gap: how much farther the next one is ·
// res.r1..r3: three numbers of its own
function nearest(x, z, size, salt, res) {
  const cx = Math.floor(x / size), cz = Math.floor(z / size);
  let best = Infinity, next = Infinity;
  for (let j = cz - 1; j <= cz + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) ^ salt;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const px = (i + 0.15 + 0.7 * ((h & 1023) / 1023)) * size, pz = (j + 0.15 + 0.7 * (((h >>> 10) & 1023) / 1023)) * size;
    const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d2 < best) {
      next = best; best = d2;
      let g = Math.imul(h ^ 0x9e3779b9, 0x85ebca6b); g ^= g >>> 15;
      res.px = px; res.pz = pz;
      res.r1 = (g & 1023) / 1023; res.r2 = ((g >>> 10) & 1023) / 1023; res.r3 = ((g >>> 20) & 1023) / 1023;
    } else if (d2 < next) next = d2;
  }
  res.d = Math.sqrt(best); res.gap = Math.sqrt(next) - res.d;
  return res;
}
const flat = (out) => { out.alt = 0; out.m = 0; out.hard = 0; return out; };
// the footprint wanders: no mountain has a ruler-straight foot
const warper = (seed, reach = 52) => {
  const warp = new Simplex((seed ^ 0x3c6ef372) >>> 0);
  return (x, z, q) => {
    q.x = x + reach * warp.fbm(x * 0.0038 + 9, z * 0.0038 - 3, { octaves: 3 });
    q.z = z + reach * warp.fbm(x * 0.0038 - 6, z * 0.0038 + 14, { octaves: 3 });
  };
};
const concave = (f) => f * f * (0.55 + 0.45 * f);             // easy foothills, steep heights

// ---- the SHAPES --------------------------------------------------------------------
// each → sample(x, z, out): out.alt is the height it adds there, out.m how much of a
// mountain the place is (0 on the plain … 1 on the spine), out.hard how well the rock
// there stands up to water and gravity (0 … 1: a cliff that must not be worn away)
const SHAPES = {
  // crests and couloirs: ridged noise — broad, a few octaves only (needles are not
  // mountains; erosion.js adds the fine valleys, where water would really cut them)
  crests(c, seed) {
    const warp = warper(seed), crest = new Simplex((seed ^ 0xa54ff53a) >>> 0), q = {}, res = {};
    return (x, z, out) => {
      warp(x, z, q);
      if (span(c.nodes, q.x, q.z, concave, 0.34, res).m <= 0) return flat(out);
      const r = crest.ridged(q.x * 0.0041, q.z * 0.0041, { octaves: 3, gain: 0.4 });
      out.alt = res.rise * (0.5 + 0.5 * Math.pow(r, 1.2)) + 0.34 * points(c.nodes, q.x, q.z, 0.17) * (0.6 + 0.4 * r);
      out.m = res.m; out.hard = 0;
      return out;
    };
  },

  // NEEDLES: the range is narrow and its flanks hollow, every crest sharpened to a
  // blade, and out of the crests stand separate pinnacles — the aiguilles
  needles(c, seed) {
    const warp = warper(seed, 40), crest = new Simplex((seed ^ 0xa54ff53a) >>> 0), q = {}, res = {}, cell = {};
    const hollow = (f) => Math.pow(f, 2.25) * (0.7 + 0.3 * f);
    return (x, z, out) => {
      warp(x, z, q);
      if (span(c.nodes, q.x, q.z, hollow, 0.42, res).m <= 0) return flat(out);
      const r = crest.ridged(q.x * 0.0056, q.z * 0.0056, { octaves: 4, gain: 0.5 });
      let alt = res.rise * (0.32 + 0.68 * r * r);
      nearest(q.x, q.z, 46, seed & 0xffff, cell);
      if (cell.r1 < 0.62) {
        const R = 11 + 13 * cell.r2;
        if (cell.d < R) alt += Math.pow(1 - cell.d / R, 1.3) * res.crest * (0.14 + 0.24 * cell.r3) * smoothstep(0.22, 0.62, res.m);
      }
      out.alt = alt + 0.44 * points(c.nodes, q.x, q.z, 0.055) * (0.6 + 0.4 * r);
      out.m = res.m; out.hard = 0;
      return out;
    };
  },

  // DOMES: a worn old range. The cross-section is a bell (a round top, a round foot),
  // the surface swells instead of creasing, and sugarloaves stand on its shoulders
  domes(c, seed) {
    const warp = warper(seed, 64), swell = new Simplex((seed ^ 0xa54ff53a) >>> 0), q = {}, res = {}, cell = {};
    const bell = (f) => 0.5 - 0.5 * Math.cos(Math.PI * f);
    return (x, z, out) => {
      warp(x, z, q);
      if (span(c.nodes, q.x, q.z, bell, 0.3, res).m <= 0) return flat(out);
      let alt = res.rise * (0.86 + 0.14 * swell.fbm(q.x * 0.0052, q.z * 0.0052, { octaves: 3 }));
      nearest(q.x, q.z, 118, seed & 0xffff, cell);
      if (cell.r1 < 0.6) {
        const R = 30 + 30 * cell.r2, u = cell.d / R;
        if (u < 1) alt += (1 - u * u) * res.crest * (0.1 + 0.17 * cell.r3) * smoothstep(0.06, 0.34, res.m) * (1 - 0.7 * smoothstep(0.7, 1, res.m));
      }
      out.alt = alt + 0.12 * points(c.nodes, q.x, q.z, 0.5);
      out.m = res.m; out.hard = 0;
      return out;
    };
  },

  // TABLES: every summit of the spine is a tableland of its own height — a talus
  // foot, a first bench, the great wall, a cap — and where two meet they step. The
  // cliff line wanders (capes, bays), and lone buttes stand off in front of it.
  tables(c, seed) {
    const warp = warper(seed, 30), edge = new Simplex((seed ^ 0xa54ff53a) >>> 0), q = {}, cell = {};
    const tier = (t, at) => smoothstep(at - 0.016, at + 0.016, t);
    return (x, z, out) => {
      warp(x, z, q);
      let alt = 0, m = 0, hard = 0;
      const wander = 0.21 * edge.fbm(q.x * 0.0072, q.z * 0.0072, { octaves: 3 });
      for (const p of c.nodes) {
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        if (d >= p.w) continue;
        const f = 1 - d / p.w;
        if (f > m) m = f;
        // (a table is narrower than a range: its wall stands at about a third of the way in)
        const t = f * 1.5 - 0.22 + wander + 0.06 * Math.sin(3 * Math.atan2(dz, dx) + p.lobe);
        const a = p.h * (0.07 * smoothstep(0, 0.3, t) + 0.2 * tier(t, 0.3) + 0.6 * tier(t, 0.47) + 0.13 * tier(t, 0.8));
        if (a > alt) { alt = a; hard = tier(t, 0.27); }
      }
      if (m <= 0) return flat(out);
      nearest(q.x, q.z, 150, seed & 0xffff, cell);
      if (cell.r1 < 0.5 && m > 0.03 && m < 0.36) {                   // an outlier: a butte
        const R = 17 + 20 * cell.r2, d = cell.d + 5 * edge.noise2D(q.x * 0.05, q.z * 0.05);
        const a = c.top * (0.22 + 0.24 * cell.r3) * (1 - smoothstep(R * 0.8, R, d)) * smoothstep(0.03, 0.12, m);
        if (a > alt) { alt = a; hard = 1; }
      }
      // the top is not a billiard table
      out.alt = alt + 3.5 * hard * edge.fbm(q.x * 0.016 + 40, q.z * 0.016, { octaves: 2 });
      out.m = m; out.hard = 0.86 * hard;
      return out;
    };
  },

  // TOWERS: a gentle swell of land, and standing on it a crowd of separate pillars,
  // taller and closer toward the spine — some rounded like haystacks, some sheer
  towers(c, seed) {
    const warp = warper(seed), swell = new Simplex((seed ^ 0xa54ff53a) >>> 0), q = {}, res = {}, cell = {};
    return (x, z, out) => {
      warp(x, z, q);
      if (span(c.nodes, q.x, q.z, concave, 0.2, res).m <= 0) return flat(out);
      let alt = 0.15 * res.rise * (0.7 + 0.3 * swell.fbm(q.x * 0.006, q.z * 0.006, { octaves: 2 })), hard = 0;
      nearest(q.x, q.z, 60, seed & 0xffff, cell);
      if (cell.r1 < 0.26 + 0.62 * smoothstep(0.02, 0.5, res.m)) {
        const R = 12 + 15 * cell.r2;
        const lobed = cell.d * (1 + 0.16 * Math.sin(3 * Math.atan2(q.z - cell.pz, q.x - cell.px) + cell.r3 * 6.28));
        if (lobed < R) {
          const tall = res.crest * (0.3 + 0.7 * cell.r3) * smoothstep(0, 0.5, res.m);
          // (…and never run into the next one: a cleft is left between two that stand close)
          const p = (1 - Math.pow(lobed / R, 2 + 5 * cell.r1 / 0.88)) * smoothstep(0, 7, cell.gap);
          alt += tall * p; hard = p > 0.04 ? 0.9 : 0;
        }
      }
      out.alt = alt; out.m = res.m; out.hard = hard;
      return out;
    };
  },

  // VOLCANO: one cone, hollow-flanked like every stratovolcano (gentle at the foot,
  // steep under the rim), ribbed by the gullies that run down it, a crater at the top
  // whose rim has given way on one side. A few cinder cones on its lower slopes.
  volcano(c, seed) {
    const warp = warper(seed, 16), rib = new Simplex((seed ^ 0xa54ff53a) >>> 0), q = {};
    const K = 1.55, norm = Math.exp(K) - 1;
    return (x, z, out) => {
      warp(x, z, q);
      const dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz);
      let alt = 0, m = 0, hard = 0;
      if (d < c.W) {
        const th = Math.atan2(dz, dx);
        const lip = 1 - 0.17 * Math.pow(Math.max(0, Math.cos(th - c.breach)), 4);
        m = 1 - d / c.W;
        if (d < c.rc) {
          const u = d / c.rc;
          alt = c.h * lerp(0.915, lip, u * u) - c.depth * Math.pow(1 - u * u, 0.75);    // (one floor, whatever the rim does)
          hard = 1;
        } else {
          const f = 1 - (d - c.rc) / (c.W - c.rc);
          const gully = 1 - rib.ridged(Math.cos(th) * 2.7 + 7, Math.sin(th) * 2.7 - 3, { octaves: 2, gain: 0.5 });
          alt = c.h * lip * (Math.exp(K * f) - 1) / norm * (1 - 0.24 * gully * smoothstep(1, 0.72, f));
          hard = smoothstep(c.rc * 1.5, c.rc, d);
        }
      }
      for (const p of c.cones) {
        const u = Math.hypot(q.x - p.x, q.z - p.z) / p.r;
        if (u >= 1) continue;
        alt += p.h * (u < 0.2 ? 0.8 - 0.35 * (1 - u / 0.2) : Math.pow(1 - u, 1.15) / Math.pow(0.8, 1.15) * 0.8);
        m = Math.max(m, 0.2 * (1 - u));
      }
      out.alt = alt; out.m = m; out.hard = hard;
      return out;
    };
  },
};

// → sample(x, z, out) over every chain of the relief: the highest of what each raises
export function massifSampler(massif) {
  const samplers = massif.chains.map((c, i) => (SHAPES[c.style] || SHAPES.crests)(c, (massif.seed + i * 0x9e3779b1) >>> 0));
  const one = { alt: 0, m: 0, hard: 0 };
  return (x, z, out) => {
    out.alt = 0; out.m = 0; out.hard = 0;
    for (const sample of samplers) {
      sample(x, z, one);
      if (one.alt > out.alt) out.alt = one.alt;
      if (one.m > out.m) out.m = one.m;
      if (one.hard > out.hard) out.hard = one.hard;
    }
    return out;
  };
}

// ---- ZONATION ----------------------------------------------------------------------
// Run once the heights are final (after erosion): above the lowlands the biome of a
// place is decided by how HIGH it is. Rewrites field.biome and the colour blend.
const ARID = new Set([BIOME.DESERT, BIOME.SAVANNA, BIOME.MESA, BIOME.VOLCANIC, BIOME.BEACH]);
const FOOT = 46;       // below this the land keeps the biome it was given

export function zonate(field, graph) {
  const { verts, heights, biome, blendIds, blendW, massif, gx, gz } = field;
  const style = graph.massif.style, crater = graph.massif.crater, arid = graph.trend === 'arid';
  let { tree, snow } = characterOf(graph.trend);
  // a table's top and a tower's head are high, but they are woods all the same
  const wooded = style === 'tables' || style === 'towers';
  if (wooded) tree += 400;
  if (style === 'volcano') snow += 36;                            // a warm mountain
  const skirt = graph.trend === 'tropical' ? BIOME.JUNGLE : BIOME.TAIGA;
  // what shows above the trees: ash on a volcano, red rock in a desert country, heath
  // on a worn round summit — and grey rock everywhere else
  const bare = style === 'volcano' ? BIOME.VOLCANIC : arid ? BIOME.MESA : style === 'domes' ? BIOME.MOOR : BIOME.MOUNTAIN;
  const sim = new Simplex((field.seed ^ 0x1f83d9ab) >>> 0);
  const w = [0, 0, 0, 0], ids = [0, 0, 0, 0];
  for (let j = 0; j < verts; j++) {
    for (let i = 0; i < verts; i++) {
      const k = j * verts + i, y = heights[k];
      let b0 = biome[k];
      // sea bed the massif has lifted out of the water is land now
      if (b0 === BIOME.OCEAN && y > 0.8 && massif[k] > 0.02) {
        b0 = y < 3.5 ? BIOME.BEACH : BIOME.HILLS;
        biome[k] = b0;
        blendIds[k * 3] = b0; blendW[k * 3] = 1; blendW[k * 3 + 1] = 0; blendW[k * 3 + 2] = 0;
      }
      // the regional ranges obey the same lines as the massif: what the biome map calls
      // "mountain" or "snow" is high ground, and it is the altitude that says which
      if (b0 === BIOME.MOUNTAIN || b0 === BIOME.SNOW) {
        b0 = BIOME.HILLS;
        biome[k] = b0;
        for (let q = 0; q < 3; q++) if (blendIds[k * 3 + q] === BIOME.MOUNTAIN || blendIds[k * 3 + q] === BIOME.SNOW) blendIds[k * 3 + q] = b0;
      }
      if (y < FOOT) continue;
      // away from the massif only the highlands rise in bands (a mesa keeps its desert top)
      const high = b0 === BIOME.HILLS || b0 === BIOME.TAIGA || b0 === BIOME.FOREST || b0 === BIOME.MOOR;
      const onMassif = massif[k] >= 0.06;
      if (!onMassif && !high) continue;
      // the lines are not ruled: they wander up the sheltered sides and down the others
      const ya = y + 13 * sim.fbm(gx(i) * 0.012, gz(j) * 0.012, { octaves: 2 });
      // (dry country has no belt of conifers — but its mountains are red rock from the foot up)
      const red = arid && onMassif;
      const t1 = ARID.has(b0) && !red && !(wooded && onMassif) ? 0 : smoothstep(FOOT, FOOT + 18, ya);
      const t2 = smoothstep(tree - 9, tree + 9, ya);
      let t3 = smoothstep(snow - 12, snow + 12, ya);
      if (crater) t3 *= smoothstep(crater.r * 1.5, crater.r * 3.2, Math.hypot(gx(i) - crater.x, gz(j) - crater.z));   // no snow round the fire
      ids[0] = b0; w[0] = (1 - t1) * (1 - t2);
      ids[1] = red ? BIOME.MESA : skirt; w[1] = t1 * (1 - t2);
      ids[2] = bare; w[2] = t2 * (1 - t3);
      ids[3] = BIOME.SNOW; w[3] = t3;
      // keep the three that matter most
      let drop = 0;
      for (let q = 1; q < 4; q++) if (w[q] < w[drop]) drop = q;
      let top = -1, sum = 0, o = k * 3;
      for (let q = 0; q < 4; q++) {
        if (q === drop) continue;
        blendIds[o] = ids[q]; blendW[o] = w[q]; sum += w[q]; o++;
        if (top < 0 || w[q] > w[top]) top = q;
      }
      for (let q = 0; q < 3; q++) blendW[k * 3 + q] /= sum || 1;
      biome[k] = ids[top];
    }
  }
  return field;
}

// A coarse CEILING over the relief: the highest ground in each block of cells, blurred.
// What the camera may not sink below — smooth enough that following it never jolts.
export function addCeiling(field, block = 6) {
  const { N, heights, idx, size, half } = field;
  const n = Math.ceil((N + 1) / block), grid = new Float32Array(n * n);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const c = ((j / block) | 0) * n + ((i / block) | 0);
    if (heights[idx(i, j)] > grid[c]) grid[c] = heights[idx(i, j)];
  }
  const at = (i, j) => grid[clamp(j, 0, n - 1) * n + clamp(i, 0, n - 1)];
  const soft = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    // a block also answers for its neighbours' ground: the ceiling never undercuts a slope
    soft[j * n + i] = Math.max(at(i, j), 0.5 * (at(i, j) + Math.max(at(i - 1, j), at(i + 1, j), at(i, j - 1), at(i, j + 1))));
  }
  const step = size / N * block;
  field.ceilingAt = (x, z) => {
    const fx = clamp((x + half) / step - 0.5, 0, n - 1), fz = clamp((z + half) / step - 0.5, 0, n - 1);
    const i0 = Math.floor(fx), j0 = Math.floor(fz), i1 = Math.min(i0 + 1, n - 1), j1 = Math.min(j0 + 1, n - 1);
    const tx = fx - i0, tz = fz - j0;
    return lerp(lerp(soft[j0 * n + i0], soft[j0 * n + i1], tx), lerp(soft[j1 * n + i0], soft[j1 * n + i1], tx), tz);
  };
  return field;
}
