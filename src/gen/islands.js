// islands.js — carve the single generated continent into a floating ARCHIPELAGO.
// Used ONLY by ?mode=floating. Each project city (and the volcano, if any) is an
// ANCHOR. A soft, noise-wobbled blob of influence spreads from every anchor, and a
// grid cell belongs to an island when it sits inside some anchor's blob AND isn't
// open sea. Everything else — the surrounding ocean and the land BETWEEN anchors —
// is dropped, so the continent breaks apart into separate islands adrift in the sky
// (one per city; cities that sit close merge into a single, larger island).
//
// Nothing here rebuilds geometry: it hands the terrain brick a per-face visibility
// test, filters the scatter, and gives the flying brick a coastline rim per island
// to hang a rocky underside from.
import { smoothstep } from './noise.js';

const SEA = 1.0;               // waterline: below this is sea (matches the coast)
const SEGR = 72;               // rim angular resolution per island

export function buildIslandField(field, anchors, seed) {
  const { N, verts, heights, size, half, gx, gz, idx } = field;

  // per-anchor blob: radius from nearest-neighbour spacing (close anchors overlap →
  // one shared island; lone anchors get a generous island) + a couple of phased sine
  // lobes so the coastline wobbles instead of being a clean circle.
  const A = anchors.map((a, i) => {
    let nn = Infinity;
    for (let j = 0; j < anchors.length; j++) {
      if (j === i) continue;
      const d = Math.hypot(anchors[j].x - a.x, anchors[j].z - a.z);
      if (d < nn) nn = d;
    }
    const R = Math.max(120, Math.min(250, (isFinite(nn) ? nn : 320) * 0.66));
    const s = (seed ^ (0x9e37 * (i + 1))) >>> 0;
    return {
      x: a.x, z: a.z, R,
      k1: 2 + (s % 3), p1: ((s >> 3) % 628) / 100,
      k2: 3 + ((s >> 6) % 3), p2: ((s >> 9) % 628) / 100,
    };
  });

  // blob field at a world point (max influence over the anchors, 1 inside → 0 out)
  const blobAt = (x, z) => {
    let f = 0;
    for (const a of A) {
      const dx = x - a.x, dz = z - a.z;
      const d = Math.hypot(dx, dz);
      const th = Math.atan2(dz, dx);
      const wob = 1 + 0.17 * Math.sin(a.k1 * th + a.p1) + 0.10 * Math.sin(a.k2 * th + a.p2);
      const R = a.R * wob;
      const fi = smoothstep(R, R * 0.6, d);     // note edge0>edge1: 1 inside, 0 out
      if (fi > f) f = fi;
    }
    return f;
  };

  // EXTERIOR ocean: flood-fill from the grid border across below-SEA cells, so open
  // sea is dropped but interior lakes (never border-connected) survive as basins.
  const V = verts;
  const ext = new Uint8Array(V * V);
  const qi = [], qj = [];
  let head = 0;
  const push = (i, j) => {
    if (i < 0 || j < 0 || i >= V || j >= V) return;
    const k = idx(i, j);
    if (ext[k] || heights[k] >= SEA) return;
    ext[k] = 1; qi.push(i); qj.push(j);
  };
  for (let i = 0; i < V; i++) { push(i, 0); push(i, V - 1); }
  for (let j = 0; j < V; j++) { push(0, j); push(V - 1, j); }
  while (head < qi.length) {
    const i = qi[head], j = qj[head]; head++;
    push(i - 1, j); push(i + 1, j); push(i, j - 1); push(i, j + 1);
  }

  // a grid cell is island land iff it's inside a blob and not open sea
  const cellVisible = (i, j) => {
    if (ext[idx(i, j)]) return false;
    return blobAt(gx(i), gz(j)) > 0.5;
  };

  // same test at an arbitrary world point (for scatter culling) — snap to the
  // nearest grid vertex for the ocean check, blob is continuous.
  const atWorld = (x, z) => {
    const i = Math.max(0, Math.min(N, Math.round((x + half) / size * N)));
    const j = Math.max(0, Math.min(N, Math.round((z + half) / size * N)));
    if (ext[idx(i, j)]) return false;
    return blobAt(x, z) > 0.5;
  };

  // coastline RIM per island: from each anchor cast rays outward and record how far
  // the contiguous island land reaches, but only over cells this anchor "owns"
  // (closer to it than to any other) so a merged island is split cleanly between its
  // two anchors — each hangs its own skirt, meeting in the middle.
  const rims = A.map((a, ai) => {
    const rim = new Array(SEGR);
    for (let s = 0; s < SEGR; s++) {
      const th = (s / SEGR) * Math.PI * 2;
      const cx = Math.cos(th), cz = Math.sin(th);
      let r = 44;
      for (let rr = 44; rr <= a.R * 1.4; rr += 6) {
        const x = a.x + cx * rr, z = a.z + cz * rr;
        let owns = true;
        for (let bi = 0; bi < A.length; bi++) {
          if (bi === ai) continue;
          if (Math.hypot(x - A[bi].x, z - A[bi].z) < rr - 1) { owns = false; break; }
        }
        if (!owns || !atWorld(x, z)) break;      // stop at the first void / border
        r = rr + 6;
      }
      rim[s] = r;
    }
    return { x: a.x, z: a.z, rim, R: a.R };
  });

  return { cellVisible, atWorld, rims, SEGR };
}
