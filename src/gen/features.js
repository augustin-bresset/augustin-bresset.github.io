// features.js — the SIGHTS the finished relief holds: things found on the land once
// its heights are final, rather than modelled into it.
//   findPeak   the true high point of the country
//   carveLakes still water lying in the hollows of the lowlands
//   findFalls  where a stream goes over a lip and drops — the great waterfalls
//   traceLava  the way the lava takes down a volcano from the breach in its rim
// Pure data (no renderer): the bricks draw what these return.
import { drainage } from './hydrology.js';
import { mulberry32, smoothstep } from './noise.js';
import { BIOME } from './biomes.js';

export function findPeak(field) {
  const { heights, verts, gx, gz } = field;
  let top = 0;
  for (let k = 1; k < heights.length; k++) if (heights[k] > heights[top]) top = k;
  return { x: gx(top % verts), y: heights[top], z: gz((top / verts) | 0) };
}

// The way down from (x, z): a point every `step`, each the lowest ground within reach
// of the one before, until the land levels out, reaches `floor`, or `max` points.
export function runDown(field, x, z, { step = 5, max = 80, floor = 3 } = {}) {
  const pts = [{ x, z, y: field.heightAt(x, z) }];
  for (let s = 1; s < max; s++) {
    const p = pts[pts.length - 1];
    let best = null, low = p.y - 0.03;
    for (let a = 0; a < 20; a++) {
      const th = (a / 20) * Math.PI * 2, nx = p.x + Math.cos(th) * step, nz = p.z + Math.sin(th) * step;
      const y = field.heightAt(nx, nz);
      if (y < low) { low = y; best = { x: nx, z: nz, y }; }
    }
    if (!best || best.y < floor) break;
    pts.push(best);
  }
  return pts;
}

// ---- LAKES -------------------------------------------------------------------------
// A lake is laid where the ground is already nearly level: its water stands just under
// the LOWEST point of its shore (so it can never spill over ground that is not there),
// and the land inside the shore line is dug into a basin below that. The shore is a
// wobbling outline, not a circle.
// avoid: [{ x, z, r }] ground that is spoken for · inside(x, z): optional land test
// size: [least, spread] of a lake's radius (a floating island has room for a tarn, no more)
const LAKESIDE = new Set([BIOME.PLAINS, BIOME.FOREST, BIOME.HILLS, BIOME.TAIGA, BIOME.MOOR, BIOME.JUNGLE, BIOME.SAVANNA, BIOME.PLATEAU, BIOME.MARSH]);
export function carveLakes(field, graph, seed, { count = 3, avoid = [], inside = null, size: span = [22, 32] } = {}) {
  const { N, heights, idx, gx, gz, size, half } = field;
  const rand = mulberry32((seed ^ 0x1a4e5) >>> 0);
  const sites = graph.sites.filter((s) => LAKESIDE.has(s.biome) && Math.hypot(s.x, s.z) < 660);
  const cell = size / N, lakes = [];
  for (let tries = 0; tries < (inside ? 1600 : 400) && lakes.length < count && sites.length; tries++) {
    const s = sites[(rand() * sites.length) | 0];
    const x = s.x + (rand() - 0.5) * 44, z = s.z + (rand() - 0.5) * 44, R = span[0] + rand() * span[1];
    const lobes = [[2, 0.26 * rand(), rand() * 6.28], [3, 0.17 * rand(), rand() * 6.28], [5, 0.08 * rand(), rand() * 6.28]];
    const radius = (th) => { let r = 1; for (const [k, a, p] of lobes) r += a * Math.sin(k * th + p); return R * r; };
    if (field.massifAt(x, z) > 0.1) continue;
    if (avoid.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + R * 1.5 + 12)) continue;
    if (lakes.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + R * 1.5 + 70)) continue;
    // the lowest point of its shore says how high the water stands
    let lo = Infinity, hi = -Infinity, ok = true;
    for (let a = 0; a < 36 && ok; a++) {
      const th = (a / 36) * Math.PI * 2, r = radius(th) * 1.2;
      const h = field.heightAt(x + Math.cos(th) * r, z + Math.sin(th) * r);
      if (h < lo) lo = h; if (h > hi) hi = h;
      if (inside && !inside(x + Math.cos(th) * r * 1.2, z + Math.sin(th) * r * 1.2)) ok = false;
    }
    // too near the sea, on a slope, or under a knoll that would have to be dug away
    const up = field.liftAt(x, z);              // (a floating island's own level)
    if (!ok || lo - up < 3.4 || lo - up > 70 || hi - lo > 10 || field.heightAt(x, z) > lo + 8) continue;
    const level = lo - 0.7, depth = Math.min(R * 0.22, 3 + rand() * 4);
    const reach = Math.ceil(R * 1.75 / cell);
    const ci = Math.round((x + half) / cell), cj = Math.round((z + half) / cell);
    for (let dj = -reach; dj <= reach; dj++) for (let di = -reach; di <= reach; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i > N || j > N) continue;
      const dx = gx(i) - x, dz = gz(j) - z, u = Math.hypot(dx, dz) / radius(Math.atan2(dz, dx));
      if (u >= 1.22) continue;
      const k = idx(i, j), h = heights[k];
      if (u < 1) heights[k] = Math.min(h, level - 0.4 - depth * (1 - u * u));
      else {
        // the bank: from just under the water at the shore line to just over it — dips
        // are filled to that (the water must have ground to end against), higher ground eases down to it
        const bank = level - 0.4 + ((u - 1) / 0.22) * 1.3;
        heights[k] = h < bank ? bank : bank + (h - bank) * smoothstep(1, 1.22, u);
      }
    }
    lakes.push({ x, z, r: R * 1.4, level, radius, shore: 1.08, has: (px, pz) => Math.hypot(px - x, pz - z) < radius(Math.atan2(pz - z, px - x)) * 1.1 });
  }
  return lakes;
}

// ---- WATERFALLS --------------------------------------------------------------------
// Where the water of some catchment comes to a LIP — nearly level ground above, a long
// drop within a few cells below — it falls. The best of those, kept apart from one
// another. → [{ lip, foot: { x, y, z }, drop, flow }]
export function findFalls(field, { max = 5, minDrop = 22, avoid = [], inside = null } = {}) {
  const { N, verts, heights, idx, gx, gz } = field;
  const { receiver, accum } = drainage(field);
  const at = (k) => ({ x: gx(k % verts), y: heights[k], z: gz((k / verts) | 0) });
  const cands = [];
  for (let j = 2; j < N - 1; j++) for (let i = 2; i < N - 1; i++) {
    const k = idx(i, j), h = heights[k];
    if (h - (field.lift ? field.lift[k] : 0) < 16 || accum[k] < 9) continue;
    let c = k, steps = 0;
    while (steps < 4 && receiver[c] >= 0) { c = receiver[c]; steps++; }
    const drop = h - heights[c];
    if (drop < minDrop) continue;
    // a lip, not a point on a slope: the ground just upstream is nearly level with it
    let above = -Infinity;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) above = Math.max(above, heights[idx(i + di, j + dj)] - h);
    if (above > drop * 0.14) continue;
    cands.push({ k, drop, score: drop * (1 + 0.3 * Math.log(accum[k])) });
  }
  cands.sort((a, b) => b.score - a.score);
  const falls = [];
  for (const cand of cands) {
    if (falls.length >= max) break;
    const lip = at(cand.k);
    if (falls.some((f) => Math.hypot(f.lip.x - lip.x, f.lip.z - lip.z) < 80)) continue;
    if (avoid.some((e) => Math.hypot(lip.x - e.x, lip.z - e.z) < e.r + 30)) continue;
    if (inside && !inside(lip.x, lip.z)) continue;
    // down to where it stops falling
    let c = cand.k, steps = 0;
    while (steps < 12 && receiver[c] >= 0 && (steps < 2 || heights[c] - heights[receiver[c]] > 4.6)) { c = receiver[c]; steps++; }   // (steeper than 40°: falling, not running)
    const foot = at(c);
    if (lip.y - foot.y < minDrop || foot.y - field.liftAt(foot.x, foot.z) < 0.5 || (inside && !inside(foot.x, foot.z))) continue;
    falls.push({ lip, foot, drop: lip.y - foot.y, flow: accum[cand.k] });
  }
  return falls;
}

// ---- LAVA --------------------------------------------------------------------------
// The crater as the land really has it (after erosion), and the ways the lava takes
// out of it: over the lowest point of the rim, and down.
// crater: { x, z, r, breach } (gen/relief.js planMassif)
export function traceLava(field, crater) {
  const { x, z, r } = crater;
  const floor = field.heightAt(x, z);
  // the rim: the highest ground along each ray out of the crater — and its lowest point
  let lip = null, crown = -Infinity;
  for (let a = 0; a < 72; a++) {
    const th = (a / 72) * Math.PI * 2;
    let top = -Infinity, at = r;
    for (let d = r * 0.6; d <= r * 1.5; d += 2) {
      const h = field.heightAt(x + Math.cos(th) * d, z + Math.sin(th) * d);
      if (h > top) { top = h; at = d; }
    }
    if (top > crown) crown = top;
    if (!lip || top < lip.y) lip = { th, d: at, y: top };
  }
  // the lake brims at the breach
  const level = Math.max(floor + 6, lip.y - 1.2);
  // …and reaches, each way, as far as the ground stands above it
  const shore = [];
  let reach = 0;
  for (let a = 0; a < 48; a++) {
    const th = (a / 48) * Math.PI * 2;
    let d = 4;
    while (d < r * 1.5 && field.heightAt(x + Math.cos(th) * d, z + Math.sin(th) * d) < level) d += 1.5;
    shore.push(d + 1.5);
    if (d > reach) reach = d;
  }
  // three streams: the main one out of the breach, two lesser ones either side of it
  const flows = [];
  for (const [swing, len, width] of [[0, 78, 1], [0.55, 40, 0.62], [-0.6, 46, 0.7]]) {
    const th = lip.th + swing, d = lip.d + (swing ? 12 : 3);
    const pts = runDown(field, x + Math.cos(th) * d, z + Math.sin(th) * d, { step: 5, max: len, floor: 4 + field.liftAt(x, z) });
    if (pts.length < 8) continue;
    if (!swing) pts.unshift({ x: x + Math.cos(th) * (lip.d - 6), z: z + Math.sin(th) * (lip.d - 6), y: level });   // it starts in the lake
    flows.push({ pts, width });
  }
  return { x, z, level, reach: reach + 2, shore, crown, flows };
}
