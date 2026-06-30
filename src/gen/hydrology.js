// hydrology.js — rivers & ravines via flow accumulation (real terrain technique).
// 1. each cell drains to its lowest 8-neighbour
// 2. process cells high→low, pushing accumulated "water" downhill
// 3. cells whose accumulation passes a threshold (and are above sea) are rivers
// 4. trace continuous polylines source→sea, then carve channels into the field
//
// Also carves ONE big ravine/canyon as a special dramatic feature.
import { mulberry32 } from './noise.js';
import { BIOME } from './biomes.js';

const NB = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

// Tiny binary min-heap (parallel typed arrays) for the priority-flood.
class MinHeap {
  constructor(cap) { this.h = new Float64Array(cap); this.k = new Int32Array(cap); this.n = 0; }
  get size() { return this.n; }
  _swap(a, b) {
    const th = this.h[a]; this.h[a] = this.h[b]; this.h[b] = th;
    const tk = this.k[a]; this.k[a] = this.k[b]; this.k[b] = tk;
  }
  push(hv, kv) {
    let i = this.n++;
    this.h[i] = hv; this.k[i] = kv;
    while (i > 0) { const p = (i - 1) >> 1; if (this.h[p] <= this.h[i]) break; this._swap(p, i); i = p; }
  }
  pop() {
    const rk = this.k[0];
    this.n--;
    if (this.n > 0) {
      this.h[0] = this.h[this.n]; this.k[0] = this.k[this.n];
      let i = 0;
      for (;;) {
        let l = 2 * i + 1, r = 2 * i + 2, m = i;
        if (l < this.n && this.h[l] < this.h[m]) m = l;
        if (r < this.n && this.h[r] < this.h[m]) m = r;
        if (m === i) break;
        this._swap(m, i); i = m;
      }
    }
    return rk;
  }
}

// Priority-flood depression filling (Barnes/Lehman/Mulla 2014). Returns a copy of
// the heightfield in which every cell has a monotonic descent path to the map
// border — so flow routed on it never gets trapped in a pit and rivers run
// continuously to the sea. A tiny epsilon tilts filled flats so descent stays
// well-defined. The real terrain is left untouched; this surface only steers flow.
function fillDepressions(field) {
  const { N, heights, idx, verts } = field;
  const n = verts * verts;
  const filled = Float64Array.from(heights);
  const closed = new Uint8Array(n);
  const heap = new MinHeap(n + 1);
  for (let i = 0; i <= N; i++) for (const j of [0, N]) {
    const k = idx(i, j); if (!closed[k]) { closed[k] = 1; heap.push(filled[k], k); }
  }
  for (let j = 0; j <= N; j++) for (const i of [0, N]) {
    const k = idx(i, j); if (!closed[k]) { closed[k] = 1; heap.push(filled[k], k); }
  }
  const EPS = 0.012;
  while (heap.size) {
    const k = heap.pop();
    const i = k % verts, j = (k / verts) | 0;
    for (const [di, dj] of NB) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
      const nk = idx(ni, nj);
      if (closed[nk]) continue;
      closed[nk] = 1;
      if (filled[nk] <= filled[k]) filled[nk] = filled[k] + EPS;
      heap.push(filled[nk], nk);
    }
  }
  return filled;
}

export function carveRivers(field, seed) {
  const { N, verts, heights, biome, idx, gx, gz } = field;
  const n = verts * verts;
  const rand = mulberry32((seed ^ 0x5bd1e995) >>> 0);

  // --- 0. depression-fill so flow can never get trapped inland ---
  const flow = fillDepressions(field);

  // --- 1. steepest-descent receiver on the FILLED surface ---
  // (guaranteed to lead downhill to the border / sea for every land cell)
  const receiver = new Int32Array(n).fill(-1);
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const here = idx(i, j);
      const h = flow[here];
      let lowest = h, low = -1;
      for (const [di, dj] of NB) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        const k = idx(ni, nj);
        if (flow[k] < lowest) { lowest = flow[k]; low = k; }
      }
      receiver[here] = low; // -1 = border outlet
    }
  }

  // --- 2. flow accumulation: process high → low (filled order) ---
  const order = new Int32Array(n);
  for (let k = 0; k < n; k++) order[k] = k;
  order.sort((a, b) => flow[b] - flow[a]);
  const accum = new Float32Array(n).fill(1);
  for (let o = 0; o < n; o++) {
    const k = order[o];
    const r = receiver[k];
    if (r >= 0) accum[r] += accum[k];
  }

  // --- 3. pick river cells: enough drainage AND above the waterline ---
  // (a lower threshold lets channels reach further up the slopes, toward the peaks)
  const RIVER_T = N * 0.42;          // drainage threshold (scales with grid)
  const riverMask = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    if (accum[k] > RIVER_T && heights[k] > 0.5) riverMask[k] = 1;
  }

  // explicit MOUNTAIN SPRINGS: a handful of the highest mountain/snow peaks, kept
  // spread apart. Each births a stream so rivers visibly rise FROM the mountains,
  // then follow the terrain's steepest descent down to the sea / the map edge.
  const peakCells = [];
  for (let k = 0; k < n; k++) {
    if ((biome[k] === BIOME.MOUNTAIN || biome[k] === BIOME.SNOW) && heights[k] > 28) peakCells.push(k);
  }
  peakCells.sort((a, b) => heights[b] - heights[a]);
  const springs = [];
  const MINSEP = N * 0.13;
  for (const k of peakCells) {
    // Walk DOWN the steepest-descent flank so the source sits well below the summit —
    // otherwise a stream appears to spring from the sky-high peak tip. Stop once we've
    // dropped a good way below the crest (or after a few cells).
    let sc = k; const peakH = heights[k];
    const drop = Math.min(26, peakH * 0.35);
    let steps = 0;
    while (receiver[sc] >= 0 && heights[sc] > peakH - drop && steps < 14) {
      sc = receiver[sc]; steps++;
    }
    const si = sc % verts, sj = (sc / verts) | 0;
    let ok = true;
    for (const s of springs) {
      if (Math.hypot(si - (s % verts), sj - ((s / verts) | 0)) < MINSEP) { ok = false; break; }
    }
    if (ok) springs.push(sc);
    if (springs.length >= 7) break;
  }

  // --- 4. trace continuous polylines from river "sources" to the sea ---
  // a source = river cell whose upstream neighbours are not (yet strong) rivers
  const rivers = [];
  const usedAsPath = new Uint8Array(n);
  // sources sorted so biggest rivers trace first
  const sources = [];
  for (let j = 1; j < N; j++) {
    for (let i = 1; i < N; i++) {
      const k = idx(i, j);
      if (!riverMask[k]) continue;
      // is any neighbour a stronger upstream river feeding this one?
      let hasUpstreamRiver = false;
      for (const [di, dj] of NB) {
        const nk = idx(i + di, j + dj);
        if (riverMask[nk] && receiver[nk] === k) { hasUpstreamRiver = true; break; }
      }
      if (!hasUpstreamRiver) sources.push(k);
    }
  }
  sources.sort((a, b) => accum[b] - accum[a]);
  // mountain springs always trace; then the strongest accumulation heads
  const allSources = [...springs, ...sources.filter((k) => springs.indexOf(k) === -1)];

  for (const start of allSources) {
    let k = start;
    const pts = [];
    let guard = 0;
    while (k >= 0 && guard++ < n) {
      const i = k % verts, j = (k / verts) | 0;
      pts.push({ i, j, acc: accum[k] });
      if (heights[k] <= 0.2) break;        // reached the sea
      usedAsPath[k] = 1;
      const r = receiver[k];
      if (r < 0) break;                     // pit / map-edge outlet
      k = r;
    }
    if (pts.length > 6) rivers.push({ pts, spring: springs.indexOf(start) !== -1 });
  }
  // keep every mountain spring + the longest remaining rivers, capped so the map
  // isn't a spiderweb
  const springRivers = rivers.filter((r) => r.spring);
  const others = rivers.filter((r) => !r.spring).sort((a, b) => b.pts.length - a.pts.length);
  const keep = [...springRivers, ...others].slice(0, 8).map((r) => r.pts);

  // --- 5. carve channels along kept rivers (valley + bed) ---
  const before = heights.slice();
  for (const path of keep) {
    for (const p of path) {
      const w = Math.min(4.0, 1.0 + Math.sqrt(p.acc) / 12); // half-width in cells
      const depth = Math.min(6.5, 1.8 + Math.sqrt(p.acc) / 11);
      const ri = Math.ceil(w);
      for (let dj = -ri; dj <= ri; dj++) {
        for (let di = -ri; di <= ri; di++) {
          const ni = p.i + di, nj = p.j + dj;
          if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
          const dist = Math.hypot(di, dj);
          if (dist > w + 0.5) continue;
          const k = idx(ni, nj);
          const fall = depth * Math.max(0, 1 - dist / (w + 0.5));
          const target = before[k] - fall;
          if (target < heights[k]) heights[k] = target;
        }
      }
    }
  }

  // --- 6. build river centre-line world polylines (after carving) ---
  const polylines = keep.map((path) => {
    const points = path.map((p) => ({
      x: gx(p.i), z: gz(p.j), acc: p.acc,
    }));
    return points;
  });

  // --- 7. ONE big ravine / canyon: a deep narrow chasm across the highlands ---
  const ravine = carveRavine(field, before, rand);

  return { rivers: polylines, riverMask, ravine };
}

// A dramatic crevasse: pick a high start, walk a roughly straight, wandering line
// across the island, carving a deep narrow slot with steep walls.
function carveRavine(field, before, rand) {
  const { N, heights, idx, gx, gz, verts } = field;
  // find a high-ish start near one side
  let best = -1, bestH = -1;
  for (let t = 0; t < 200; t++) {
    const i = 20 + ((rand() * (N - 40)) | 0);
    const j = 20 + ((rand() * (N - 40)) | 0);
    const k = idx(i, j);
    if (heights[k] > bestH && heights[k] > 12) { bestH = heights[k]; best = k; }
  }
  if (best < 0) return null;
  let ci = best % verts, cj = (best / verts) | 0;
  // heading across the map
  let ang = rand() * Math.PI * 2;
  const pts = [];
  const steps = (N * 0.7) | 0;
  for (let s = 0; s < steps; s++) {
    if (ci < 3 || cj < 3 || ci > N - 3 || cj > N - 3) break;
    pts.push({ i: ci | 0, j: cj | 0 });
    ang += (rand() - 0.5) * 0.5;           // gentle wander
    ci += Math.cos(ang) * 1.4;
    cj += Math.sin(ang) * 1.4;
  }
  if (pts.length < 12) return null;

  const halfW = 2.2, depth = 16;
  for (const p of pts) {
    const ri = Math.ceil(halfW) + 1;
    for (let dj = -ri; dj <= ri; dj++) {
      for (let di = -ri; di <= ri; di++) {
        const ni = p.i + di, nj = p.j + dj;
        if (ni < 1 || nj < 1 || ni > N - 1 || nj > N - 1) continue;
        const dist = Math.hypot(di, dj);
        if (dist > halfW + 1) continue;
        const k = idx(ni, nj);
        // steep V-slot: deep in the middle, sharp walls
        const fall = depth * Math.pow(Math.max(0, 1 - dist / (halfW + 1)), 1.7);
        const target = before[k] - fall;
        if (target < heights[k]) heights[k] = target;
      }
    }
  }
  return pts.map((p) => ({ x: gx(p.i), z: gz(p.j) }));
}
