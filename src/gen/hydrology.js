// hydrology.js — rivers & ravines via flow accumulation (real terrain technique).
// 1. each cell drains to its lowest 8-neighbour
// 2. process cells high→low, pushing accumulated "water" downhill
// 3. cells whose accumulation passes a threshold (and are above sea) are rivers
// 4. trace continuous polylines source→sea, then cut a channel for each: a smooth
//    curve, a flat bed, banks — and a water level that only ever falls downstream
//
// Also carves ONE big ravine/canyon as a special dramatic feature.
// `drainage()` (steps 1–2) is shared with erosion.js, which sculpts the whole relief
// along the same flow lines before the rivers are drawn.
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

// Where the water goes. A priority-flood from the map border (Barnes/Lehman/Mulla
// 2014) yields the FILLED surface — the terrain with every pit topped up to its spill
// level, so each cell has a monotonic way down to the border and flow is never
// trapped — and visits cells lowest first. On that surface each cell drains to its
// lowest neighbour (its RECEIVER; always visited before it), and pushing every cell's
// own unit of water down the receivers, highest first, gives the drainage area.
// A tiny epsilon tilts filled flats so descent stays well-defined. The real terrain
// is left untouched: this only says where water runs.
export function drainage(field) {
  const { N, heights, idx, verts } = field;
  const n = verts * verts;
  const filled = Float64Array.from(heights);
  const closed = new Uint8Array(n);
  const order = new Int32Array(n);
  const heap = new MinHeap(n + 1);
  for (let i = 0; i <= N; i++) for (const j of [0, N]) {
    const k = idx(i, j); if (!closed[k]) { closed[k] = 1; heap.push(filled[k], k); }
  }
  for (let j = 0; j <= N; j++) for (const i of [0, N]) {
    const k = idx(i, j); if (!closed[k]) { closed[k] = 1; heap.push(filled[k], k); }
  }
  const EPS = 0.012;
  let count = 0;
  while (heap.size) {
    const k = heap.pop();
    order[count++] = k;
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

  const receiver = new Int32Array(n).fill(-1);            // -1 = drains off the map
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const here = idx(i, j);
      let lowest = filled[here], low = -1;
      for (const [di, dj] of NB) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        const k = idx(ni, nj);
        if (filled[k] < lowest) { lowest = filled[k]; low = k; }
      }
      receiver[here] = low;
    }
  }

  const accum = new Float32Array(n).fill(1);
  for (let o = n - 1; o >= 0; o--) {
    const k = order[o], r = receiver[k];
    if (r >= 0) accum[r] += accum[k];
  }
  return { filled, order, receiver, accum };
}

// Chaikin corner-cutting: a path that steps from cell to cell becomes a curve. Every
// numeric field of the points is carried along (width, water level, drainage).
export function smoothPath(points, iters = 2) {
  let pts = points;
  for (let it = 0; it < iters; it++) {
    if (pts.length < 3) break;
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], q = {}, r = {};
      for (const key in a) {
        if (typeof a[key] !== 'number') continue;
        q[key] = a[key] * 0.75 + b[key] * 0.25; r[key] = a[key] * 0.25 + b[key] * 0.75;
      }
      out.push(q, r);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

// keepOut: [{ x, z, r }] — ground no river may rise in or cross (a crater: what runs
// out of it is not water). A river that would come out of one starts beyond it.
export function carveRivers(field, seed, { keepOut = [] } = {}) {
  const { N, verts, heights, biome, idx, gx, gz } = field;
  const n = verts * verts;
  const rand = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const barred = (k) => {
    if (!keepOut.length) return false;
    const x = gx(k % verts), z = gz((k / verts) | 0);
    return keepOut.some((e) => (x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < e.r * e.r);
  };

  // --- 0–2. where the water goes (filled surface, receivers, drainage area) ---
  const { filled: flow, receiver, accum } = drainage(field);

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
    // (on a real summit the spring is far below: down where the rock gives way to the woods)
    const drop = peakH > 135 ? peakH - 104 : Math.min(26, peakH * 0.35);
    let steps = 0;
    while (receiver[sc] >= 0 && heights[sc] > peakH - drop && steps < (peakH > 135 ? 200 : 14)) {
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
      if (!hasUpstreamRiver && !barred(k)) sources.push(k);
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
      if (barred(k)) pts.length = 0;       // (whatever came this far is not a river yet)
      else pts.push({ i, j, acc: accum[k], lvl: flow[k] });
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

  // --- 5. cut each river's channel ---
  // The reference is the FILLED level under the path: it only ever falls downstream,
  // so a bed and a water surface hung a fixed depth below it do too — the river cuts
  // through the small rises it meets instead of pooling behind them. The channel
  // follows the SMOOTHED path (not the cell-to-cell steps): a flat bed, then banks
  // easing back up to the untouched ground.
  const before = heights.slice();
  const cell = field.size / N;
  const SHOAL = 0.15;                                       // a river bed stays above the sea plane: inland, the
                                                            // only water in the channel is the river's own
  const bedOf = new Float32Array(n), bedDist = new Float32Array(n).fill(Infinity);
  const bankTo = new Float32Array(n).fill(Infinity);
  const polylines = [];
  for (const path of keep) {
    const pts = path.map((p) => {
      const root = Math.sqrt(p.acc);
      const depth = Math.min(2.4, 0.9 + root * 0.012);      // bed below the ground it cuts
      return {
        x: gx(p.i), z: gz(p.j), acc: p.acc,
        w: Math.min(7, 3.4 + root * 0.03),                   // half-width of the water
        bed: Math.max(SHOAL, p.lvl - depth),
        y: Math.max(SHOAL + 0.25, p.lvl - depth * 0.5),      // the water surface
      };
    });
    // the path steps from cell to cell: average it out first, or the curve keeps a
    // regular little wiggle at the pitch of the grid
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < pts.length - 1; i++) {
        pts[i].x = (pts[i - 1].x + pts[i].x * 2 + pts[i + 1].x) / 4;
        pts[i].z = (pts[i - 1].z + pts[i].z * 2 + pts[i + 1].z) / 4;
      }
    }
    for (const p of smoothPath(pts, 2)) {
      // the bed is at least wide enough that every point of the curve has a grid vertex in it
      const flat = Math.max(p.w + 0.6, cell * 0.78), bank = Math.max(cell * 1.5, flat * 1.3);
      const reach = Math.ceil((flat + bank) / cell);
      const ci = Math.round((p.x + field.half) / cell), cj = Math.round((p.z + field.half) / cell);
      for (let dj = -reach; dj <= reach; dj++) {
        for (let di = -reach; di <= reach; di++) {
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
          const dist = Math.hypot(gx(ni) - p.x, gz(nj) - p.z);
          if (dist > flat + bank) continue;
          const k = idx(ni, nj);
          if (dist <= flat) {
            if (dist < bedDist[k]) { bedDist[k] = dist; bedOf[k] = p.bed; }
          } else {
            const t = (dist - flat) / bank, ease = t * t * (3 - 2 * t);
            const target = p.bed + (before[k] - p.bed) * ease;
            if (target < bankTo[k]) bankTo[k] = target;
          }
        }
      }
    }
    polylines.push(pts.map(({ x, z, acc, w, y }) => ({ x, z, acc, w, y })));
  }
  for (let k = 0; k < n; k++) {
    if (bedDist[k] < Infinity) heights[k] = bedOf[k];        // in the bed (cut, or filled, to it)
    else if (bankTo[k] < heights[k]) heights[k] = bankTo[k]; // on a bank: only ever lowered
  }

  // --- 7. ONE big ravine / canyon: a deep narrow chasm across the highlands ---
  const ravine = carveRavine(field, before, rand);

  return { rivers: polylines, riverMask, ravine };
}

// A dramatic crevasse: pick a high start, walk a roughly straight, wandering line
// across the island, carving a deep narrow slot with steep walls.
function carveRavine(field, before, rand) {
  const { N, heights, massif, idx, gx, gz, verts } = field;
  // find a high-ish start near one side (in the country's ordinary hills: the great
  // relief has its own drama, and a slot sawn through a summit is not one)
  let best = -1, bestH = -1;
  for (let t = 0; t < 200; t++) {
    const i = 20 + ((rand() * (N - 40)) | 0);
    const j = 20 + ((rand() * (N - 40)) | 0);
    const k = idx(i, j);
    if (heights[k] > bestH && heights[k] > 12 && massif[k] < 0.03) { bestH = heights[k]; best = k; }
  }
  if (best < 0) return null;
  let ci = best % verts, cj = (best / verts) | 0;
  // heading across the map
  let ang = rand() * Math.PI * 2;
  const pts = [];
  const steps = (N * 0.7) | 0;
  for (let s = 0; s < steps; s++) {
    if (ci < 3 || cj < 3 || ci > N - 3 || cj > N - 3 || massif[idx(ci | 0, cj | 0)] > 0.1) break;
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
