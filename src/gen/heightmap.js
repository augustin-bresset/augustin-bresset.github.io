// heightmap.js — turns the Voronoi biome map into a big grid heightfield.
// Each vertex looks up its nearest biome sites, blends their per-biome fBM height
// parameters (smooth across borders), and evaluates one warped noise sample.
// Mountains use ridged noise + high amplitude; deserts stay low; etc.
// NOT an island: land runs to the map edges; ocean only where the biome says so.
import { Simplex, clamp, lerp, smoothstep } from './noise.js';
import { BIOME, BIOMES } from './biomes.js';

export const WATER_Y = 0;

// per-biome moisture target (drives scatter + river-bank life)
const MOIST = [0.9, 0.5, 0.45, 0.75, 0.4, 0.3, 0.25, 0.08, 0.2, 0.85, 0.1, 0.05];

export function makeField(seed, { size = 1000, N = 256, mode = 'island' } = {}, graph) {
  const half = size / 2;
  const simElev = new Simplex(seed);
  const simWarpX = new Simplex(seed ^ 0x9e3779b1);
  const simWarpZ = new Simplex(seed ^ 0x85ebca77);
  const simRidge = new Simplex(seed ^ 0xc2b2ae35);
  const simMoist = new Simplex(seed ^ 0x27d4eb2f);

  const verts = N + 1;
  const heights = new Float32Array(verts * verts);
  const biome = new Uint8Array(verts * verts);
  const moisture = new Float32Array(verts * verts);

  const idx = (i, j) => j * verts + i;
  const gx = (i) => -half + (i / N) * size;
  const gz = (j) => -half + (j / N) * size;

  let maxY = -Infinity, minY = Infinity;

  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const wx = gx(i), wz = gz(j);

      // nearest biome sites + inverse-distance weights (smooth border blend)
      const near = graph.nearestK(wx, wz, 3);
      let wsum = 0;
      const w = [];
      for (const e of near) {
        const wk = 1 / Math.pow(Math.sqrt(e.d2) + 4, 4);
        w.push(wk); wsum += wk;
      }
      let base = 0, amp = 0, ridged = 0, freq = 0, gain = 0;
      for (let k = 0; k < near.length; k++) {
        const wk = w[k] / wsum;
        const hp = BIOMES[near[k].s.biome].height;
        base   += wk * hp.base;   amp    += wk * hp.amp;
        ridged += wk * hp.ridged; freq   += wk * hp.freq;
        gain   += wk * (hp.gain ?? 0.5);
      }
      const bId = near[0].s.biome;
      biome[idx(i, j)] = bId;

      // warped noise sample
      const qx = wx + 18 * simWarpX.fbm(wx * 0.008 + 11, wz * 0.008 - 4, { octaves: 3 });
      const qz = wz + 18 * simWarpZ.fbm(wx * 0.008 - 7, wz * 0.008 + 3, { octaves: 3 });
      const n = simElev.fbm(qx * freq, qz * freq, { octaves: 5, gain });            // [-1,1]
      const rg = simRidge.ridged(qx * freq * 1.6, qz * freq * 1.6, { octaves: 4 }); // [0,1]
      const smooth = n * amp;
      const ridge = rg * amp;
      let y = base + lerp(smooth, ridge, ridged);

      // plateau: only applied when the nearest biome declares one. Crushes everything
      // above the cap to 6% of its overshoot — flat top, sheer cliff sides — without
      // bleeding into neighbouring biomes (we use bId, not the blended params, so the
      // cliff edge follows the Voronoi boundary rather than a blurred gradient).
      const platH = BIOMES[bId].height.plateau || 0;
      if (platH > 0) {
        const excess = Math.max(0, y - platH);
        y = platH + excess * 0.06;
      }

      if (mode === 'island') {
        // ISLAND: the coastline IS the Voronoi land/sea cell boundary (ocean-biome
        // cells already sink to base -20, and the 3-site blend gives a beach slope),
        // so it follows the cells organically — never a circle or a square. Here we
        // only deepen the OPEN sea further out so it reads as ocean to the horizon,
        // without touching that shoreline.
        const emR = Math.hypot(wx / half, wz / half);   // 0 centre .. ~1.41 corner
        y -= 20 * smoothstep(0.74, 1.15, emR);
      } else {
        // ENDLESS LAND — ONE coast, otherwise land runs off every edge.
        // A single LOCAL bay of open sea is anchored at one rim spot (corner or edge
        // midpoint — chosen in biomeGrowth). EVERYWHERE ELSE the land simply runs off
        // the map edge — no ringed coastline — and the rim is swallowed by fog. A
        // heavy low-freq warp keeps the bay's shore crooked.
        const nx = wx / half, nz = wz / half;            // [-1,1]
        const wob = 0.13 * simWarpX.fbm(wx * 0.0055 + 5, wz * 0.0055 - 2, { octaves: 4 });
        const oc = (graph && graph.oceanCorner) || { x: -1, z: -1 };
        const dAnchor = Math.hypot(nx - oc.x, nz - oc.z) + wob;
        const bay = 1 - smoothstep(0.35, 1.05, dAnchor); // 1 = open sea at the anchor
        const emR = Math.hypot(nx, nz);                  // round: 0 centre .. ~1.41 corner
        const rimRoll = 1 - 0.4 * smoothstep(0.82, 1.3, emR + wob);
        const land = 1 - bay;
        y = (y * rimRoll) * land - bay * 18;
      }

      heights[idx(i, j)] = y;

      // moisture from biome target + a little noise
      let m = MOIST[bId] * 0.8 +
        (0.5 + 0.5 * simMoist.fbm(wx * 0.012 + 30, wz * 0.012 - 17, { octaves: 3 })) * 0.2;
      moisture[idx(i, j)] = clamp(m, 0, 1);

      if (y > maxY) maxY = y;
      if (y < minY) minY = y;
    }
  }

  // clamp very deep sea floor
  for (let k = 0; k < heights.length; k++) {
    if (heights[k] < -26) heights[k] = -26 - (heights[k] + 26) * 0.12;
  }

  function bilinear(arr, wx, wz) {
    const fx = clamp((wx + half) / size, 0, 1) * N;
    const fz = clamp((wz + half) / size, 0, 1) * N;
    const i0 = Math.floor(fx), j0 = Math.floor(fz);
    const i1 = Math.min(i0 + 1, N), j1 = Math.min(j0 + 1, N);
    const tx = fx - i0, tz = fz - j0;
    const a = arr[idx(i0, j0)], b = arr[idx(i1, j0)];
    const c = arr[idx(i0, j1)], d = arr[idx(i1, j1)];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  return {
    seed, size, half, N, verts, heights, biome, moisture, idx, gx, gz, maxY, minY,
    heightAt: (wx, wz) => bilinear(heights, wx, wz),
    moistureAt: (wx, wz) => bilinear(moisture, wx, wz),
    biomeAt: (wx, wz) => biome[idx(
      clamp(Math.round((wx + half) / size * N), 0, N),
      clamp(Math.round((wz + half) / size * N), 0, N))],
  };
}
