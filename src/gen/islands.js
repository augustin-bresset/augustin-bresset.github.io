// islands.js — the floating ARCHIPELAGO (?world=floating): the generated country,
// broken up into islands adrift in the sky.
//
// The islands follow the LAND, not a disc round each town:
//   · towns that stand close share one island, with the country between them;
//   · the massif floats whole, a mountain range of its own;
//   · a few wild islets drift in between, with nobody on them.
// Open air is kept between any two of them (GAP), their outlines wander with a slow
// noise, and each island rides at its OWN height: the whole field is lifted under it
// (field.lift), so everything that is later placed on the ground — towns, trees,
// rivers, lakes — comes up with it without knowing.
//
// The outline is not cut along the grid: the vertices nearest to it are moved ONTO it
// (px, pz), and the cells it crosses give one triangle instead of two — so an island's
// edge is a smooth line, not a staircase. The terrain and the rock underneath are both
// built from the same triangles (tris), which is what makes an island watertight.
import { Simplex, mulberry32, clamp } from './noise.js';

const SEA = 1.0;               // below this, and open to the map's edge: the sea, dropped
const GAP = 44;                // the open air kept between two islands
const SKIRT = 0.085;           // how far down its skirt the massif's island reaches
const DI = [1, -1, 0, 0], DJ = [0, 0, 1, -1];      // the four neighbours of a vertex

// pads: [{ x, z, r }] the towns (r: the radius of their ground)
export function buildIslandField(field, pads, seed) {
  const { N, verts, heights, massif, size, half, gx, gz, idx } = field;
  const n = verts * verts, cell = size / N;
  const rand = mulberry32((seed ^ 0x15a4d5) >>> 0);
  const sim = new Simplex((seed ^ 0x51ab1e) >>> 0);

  // ---- 1. the open sea: flooded in from the edge of the map. A hollow inland that
  // lies below the waterline is no sea: with no water to fill it, it is a dry floor.
  const ext = new Uint8Array(n);
  {
    const queue = [];
    const push = (i, j) => {
      if (i < 0 || j < 0 || i > N || j > N) return;
      const k = idx(i, j);
      if (ext[k] || heights[k] >= SEA) return;
      ext[k] = 1; queue.push(i, j);
    };
    for (let i = 0; i <= N; i++) { push(i, 0); push(i, N); push(0, i); push(N, i); }
    for (let h = 0; h < queue.length; h += 2) {
      const i = queue[h], j = queue[h + 1];
      push(i - 1, j); push(i + 1, j); push(i, j - 1); push(i, j + 1);
    }
    for (let k = 0; k < n; k++) if (!ext[k] && heights[k] < SEA + 0.5) heights[k] = SEA + 0.5;
  }

  // ---- 2. which towns share an island: the closest go together first — always when
  // there is no room for air between them, otherwise up to three to an island
  const groups = pads.map((p) => [p]);
  {
    const between = (A, B) => {
      let g = Infinity;
      for (const a of A) for (const b of B) g = Math.min(g, Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r);
      return g;
    };
    const near = 62 + rand() * 62;
    for (;;) {
      let best = null;
      for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) {
        const g = between(groups[a], groups[b]);
        if ((g < GAP + 4 || (g < near && groups[a].length + groups[b].length <= 3)) && (!best || g < best.g)) best = { a, b, g };
      }
      if (!best) break;
      groups[best.a].push(...groups.splice(best.b, 1)[0]);
    }
  }
  // each island's reach: a blob round every town, and the ground between two of them
  const lands = groups.map((towns) => {
    const margin = 58 + rand() * 62;
    const blobs = towns.map((p) => ({ x: p.x, z: p.z, R: p.r + margin * (0.8 + rand() * 0.4) }));
    const links = [];
    for (let a = 0; a < blobs.length; a++) for (let b = a + 1; b < blobs.length; b++) links.push({ a: blobs[a], b: blobs[b], W: Math.min(blobs[a].R, blobs[b].R) * 0.82 });
    return { blobs, links, soft: 1 };
  });
  const reach = (land, x, z) => {
    let g = -Infinity;
    for (const b of land.blobs) { const v = b.R - Math.hypot(x - b.x, z - b.z); if (v > g) g = v; }
    for (const l of land.links) {
      const ex = l.b.x - l.a.x, ez = l.b.z - l.a.z;
      const t = clamp(((x - l.a.x) * ex + (z - l.a.z) * ez) / (ex * ex + ez * ez), 0, 1);
      const v = l.W - Math.hypot(x - l.a.x - ex * t, z - l.a.z - ez * t);
      if (v > g) g = v;
    }
    return g;
  };

  // ---- 3. the wild islets: bits of the country nobody lives on, clear of the rest
  {
    const want = 5 + ((rand() * 4) | 0), wild = [];
    for (let tries = 0; tries < 700 && wild.length < want; tries++) {
      const a = rand() * Math.PI * 2, r = 150 + rand() * 650, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const R = 44 + rand() * 80;
      if (field.heightAt(x, z) < 5 || field.massifAt(x, z) > 0.02) continue;
      if (lands.some((l) => reach(l, x, z) > -(R + 24))) continue;
      let ok = true;
      for (let d = 0; d < 8 && ok; d++) if (field.heightAt(x + Math.cos(d * 0.785) * R * 0.8, z + Math.sin(d * 0.785) * R * 0.8) < 2.5) ok = false;
      if (!ok) continue;
      wild.push({ blobs: [{ x, z, R }], links: [], soft: 0.6 });
      lands.push(wild[wild.length - 1]);
    }
  }
  // (a circle each land lies well inside: beyond it there is nothing to work out)
  for (const land of lands) {
    let x = 0, z = 0;
    for (const b of land.blobs) { x += b.x / land.blobs.length; z += b.z / land.blobs.length; }
    let r = 0;
    for (const b of land.blobs) r = Math.max(r, Math.hypot(b.x - x, b.z - z) + b.R);
    land.x = x; land.z = z; land.far2 = (r + 96) * (r + 96);
  }

  // ---- 4. the outline. F > 0 is island: the land's own reach, less the air owed to
  // the next island along — never less than the ground a town stands on, and never sea
  const F = new Float32Array(n);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = idx(i, j), x = gx(i), z = gz(j);
    // (far from every island — most of the map — there is nothing to work out)
    if (massif[k] <= 0.004) {
      let far = true;
      for (const land of lands) if ((x - land.x) * (x - land.x) + (z - land.z) * (z - land.z) < land.far2) { far = false; break; }
      if (far) { F[k] = -96; continue; }
    }
    // (the same slow noises bend every outline: coves and headlands, not circles)
    const wx = x + 34 * sim.noise2D(x * 0.0031 + 11, z * 0.0031 - 7), wz = z + 34 * sim.noise2D(x * 0.0031 - 23, z * 0.0031 + 5);
    const wob = 20 * sim.noise2D(x * 0.0085 + 3, z * 0.0085 + 40) + 8 * sim.noise2D(x * 0.023 - 9, z * 0.023 + 17);
    let g1 = -Infinity, g2 = -Infinity;
    const take = (g) => { if (g > g1) { g2 = g1; g1 = g; } else if (g > g2) g2 = g; };
    for (const land of lands) if ((x - land.x) * (x - land.x) + (z - land.z) * (z - land.z) < land.far2) take(reach(land, wx, wz) + wob * land.soft);
    if (massif[k] > 0.004) take((massif[k] - SKIRT) * 210 + wob * 0.5);
    let f = Math.min(g1, g1 - g2 - GAP);
    for (const p of pads) f = Math.max(f, p.r + 18 - Math.hypot(x - p.x, z - p.z));
    F[k] = Math.min(f, (heights[k] - SEA) * 8);
  }

  // a scrap too small to be an island is dropped
  {
    const seen = new Int32Array(n).fill(-1);
    for (let k0 = 0; k0 < n; k0++) {
      if (F[k0] <= 0 || seen[k0] >= 0) continue;
      const stack = [k0], cells = [];
      seen[k0] = k0;
      while (stack.length) {
        const k = stack.pop(), i = k % verts, j = (k / verts) | 0;
        cells.push(k);
        for (let d = 0; d < 4; d++) {
          const ni = i + DI[d], nj = j + DJ[d];
          if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
          const nk = idx(ni, nj);
          if (F[nk] > 0 && seen[nk] < 0) { seen[nk] = k0; stack.push(nk); }
        }
      }
      if (cells.length < 46) for (const k of cells) F[k] = -1;
    }
  }

  // ---- 5. the edge, drawn smooth: a vertex beside the outline is moved onto it —
  // along each grid line, to where the outline crosses, when that is the nearer end
  const px = new Float32Array(n), pz = new Float32Array(n);
  const ins = new Uint8Array(n);                 // 1: on the island · 2: brought onto its outline from outside
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const k = idx(i, j); px[k] = gx(i); pz[k] = gz(j); ins[k] = F[k] > 0 ? 1 : 0; }
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = idx(i, j), me = F[k] > 0, limit = me ? 0.5 : 0.500001;
    let moved = false;
    for (let axis = 0; axis < 2; axis++) {
      let best = 2, way = 0;
      for (let s = -1; s <= 1; s += 2) {
        const ni = axis ? i : i + s, nj = axis ? j + s : j;
        if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        const nb = idx(ni, nj);
        if ((F[nb] > 0) === me) continue;
        const t = F[k] / (F[k] - F[nb]);          // how far toward that neighbour the outline lies
        if (t < best) { best = t; way = s; }
      }
      if (best < limit) { if (axis) pz[k] += way * best * cell; else px[k] += way * best * cell; moved = true; }
    }
    if (!me && moved) ins[k] = 2;
  }

  // the triangles: a whole cell gives two, a cell with one corner in the air gives one
  // (never a cell whose corners were ALL brought in: that is the air between two shores)
  const tris = [], cells = [];
  const used = new Uint8Array(n), whole = new Uint8Array(n);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k00 = idx(i, j), k10 = idx(i + 1, j), k01 = idx(i, j + 1), k11 = idx(i + 1, j + 1);
    if (!ins[k00] + !ins[k10] + !ins[k01] + !ins[k11] > 1) continue;       // (most of the map: open air)
    const ring = [k00, k01, k11, k10].filter((k) => ins[k]);
    if (ring.length < 3 || !ring.some((k) => ins[k] === 1)) continue;
    if (ring.length === 4) {
      tris.push(k00, k01, k10, k10, k01, k11); cells.push(i, j, 0, i, j, 1);
      whole[k00]++; whole[k10]++; whole[k01]++; whole[k11]++;
    } else { tris.push(ring[0], ring[1], ring[2]); cells.push(i, j, 0); }
    for (const k of ring) used[k] = 1;
  }
  // (at a sharp corner of the outline two moves can fold a triangle over: there the
  // vertices are let part of the way back, until every triangle lies face up again)
  for (let pass = 0; pass < 8; pass++) {
    let folded = 0;
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], c = tris[t + 2];
      if ((pz[b] - pz[a]) * (px[c] - px[a]) - (px[b] - px[a]) * (pz[c] - pz[a]) > 0.06 * cell * cell) continue;
      folded++;
      for (const k of [a, b, c]) { const x = gx(k % verts), z = gz((k / verts) | 0); px[k] = x + (px[k] - x) * 0.5; pz[k] = z + (pz[k] - z) * 0.5; }
    }
    if (!folded) break;
  }

  // ---- 6. the islands, one by one (vertices joined by a triangle are one island)
  const parent = new Int32Array(n);
  for (let k = 0; k < n; k++) parent[k] = k;
  const find = (k) => { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; };
  for (let t = 0; t < tris.length; t += 3) {
    const a = find(tris[t]), b = find(tris[t + 1]), c = find(tris[t + 2]);
    parent[b] = a; parent[c] = a;
  }
  const comp = new Int16Array(n).fill(-1), comps = [];
  // (its edge: a vertex with a cell missing round it — and which way is out, there)
  const edge = (k) => used[k] && whole[k] < 4;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = idx(i, j);
    if (!used[k]) continue;
    const root = find(k);
    if (comp[root] < 0) { comp[root] = comps.length; comps.push({ id: comps.length, x: 0, z: 0, count: 0, high: 0, towns: [], rim: [] }); }
    const c = comps[comp[k] = comp[root]];
    c.x += px[k]; c.z += pz[k]; c.count++;
    if (massif[k] > 0.2) c.high++;
    if (edge(k)) {
      const dx = F[idx(Math.min(N, i + 1), j)] - F[idx(Math.max(0, i - 1), j)], dz = F[idx(i, Math.min(N, j + 1))] - F[idx(i, Math.max(0, j - 1))];
      const len = Math.hypot(dx, dz) || 1;
      c.rim.push({ k, x: px[k], z: pz[k], nx: -dx / len, nz: -dz / len });
    }
  }
  const nearest = (x, z) => idx(clamp(Math.round((x + half) / cell), 0, N), clamp(Math.round((z + half) / cell), 0, N));
  for (const p of pads) { const c = comps[comp[nearest(p.x, p.z)]]; if (c) c.towns.push(p); }
  for (const c of comps) {
    c.x /= c.count; c.z /= c.count;
    c.kind = c.towns.length ? 'town' : c.high > c.count * 0.4 ? 'massif' : 'wild';
    // …and the height it rides at: neighbours at like heights (a slow noise), the
    // mountain above the towns, the islets wherever they please
    let lift = 34 + 46 * sim.noise2D(c.x * 0.0012 + 31, c.z * 0.0012 - 8) + (rand() - 0.5) * 36;
    if (c.kind === 'massif') lift += 24 + rand() * 40;
    if (c.kind === 'wild') lift += (rand() - 0.4) * 90;
    c.lift = clamp(lift, 0, 150);
  }

  // every vertex takes the lift of the island nearest to it (the air between two islands
  // slopes from the one to the other: nothing stands there, but the camera passes over)
  const lift = new Float32Array(n), owner = new Int16Array(comp);
  {
    const queue = [];
    for (let k = 0; k < n; k++) if (owner[k] >= 0) queue.push(k);
    for (let h = 0; h < queue.length; h++) {
      const k = queue[h], i = k % verts, j = (k / verts) | 0;
      for (let d = 0; d < 4; d++) {
        const ni = i + DI[d], nj = j + DJ[d];
        if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        const nk = idx(ni, nj);
        if (owner[nk] < 0) { owner[nk] = owner[k]; queue.push(nk); }
      }
    }
    for (let k = 0; k < n; k++) lift[k] = owner[k] >= 0 ? comps[owner[k]].lift : 0;
    const next = new Float32Array(lift);
    for (let pass = 0; pass < 16; pass++) {
      for (let j = 1; j < N; j++) for (let i = 1, k = j * verts + 1; i < N; i++, k++) {
        if (!used[k]) next[k] = (lift[k - 1] + lift[k + 1] + lift[k - verts] + lift[k + verts]) / 4;
      }
      lift.set(next);
    }
  }
  for (let k = 0; k < n; k++) heights[k] += lift[k];
  field.lift = lift;
  field.liftAt = (x, z) => lift[nearest(x, z)];
  for (const c of comps) for (const p of c.rim) p.y = heights[p.k];

  // island or air, at any point (margin: how far in from the edge, roughly in metres)
  const atWorld = (x, z, margin = 0) => {
    const fx = clamp((x + half) / cell, 0, N), fz = clamp((z + half) / cell, 0, N);
    const i0 = Math.min(N - 1, Math.floor(fx)), j0 = Math.min(N - 1, Math.floor(fz)), tx = fx - i0, tz = fz - j0;
    const a = F[idx(i0, j0)], b = F[idx(i0 + 1, j0)], c = F[idx(i0, j0 + 1)], d = F[idx(i0 + 1, j0 + 1)];
    return a + (b - a) * tx + (c + (d - c) * tx - a - (b - a) * tx) * tz > margin;
  };

  return {
    atWorld, px, pz, tris, cells, used, edge, comp, comps,
    islandAt: (x, z) => { const c = comp[nearest(x, z)]; return c >= 0 ? comps[c] : null; },
  };
}
