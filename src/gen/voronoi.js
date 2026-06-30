// voronoi.js — large-scale biome cells via a JITTERED GRID of sites.
// A jittered grid gives Voronoi-like organic cells AND a trivial adjacency graph
// (grid neighbours), which the constrained biome growth needs. Rasterising is
// cheap too: the nearest site to any point is within the surrounding 3x3 block.
import { mulberry32 } from './noise.js';

export function makeSites(seed, { size, spacing = 52 } = {}) {
  const rand = mulberry32((seed ^ 0x51ed517e) >>> 0);
  const half = size / 2;
  const cols = Math.max(4, Math.round(size / spacing));
  const rows = cols;
  const step = size / cols;

  const sites = [];
  const at = (c, r) => r * cols + c;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = (rand() - 0.5) * step * 0.8;
      const jz = (rand() - 0.5) * step * 0.8;
      sites.push({
        c, r,
        x: -half + (c + 0.5) * step + jx,
        z: -half + (r + 0.5) * step + jz,
        biome: -1,
      });
    }
  }

  // 8-neighbour adjacency on the site grid
  function neighbors(site) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const c = site.c + dc, r = site.r + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        out.push(sites[at(c, r)]);
      }
    }
    return out;
  }

  // nearest site to a world point (search the 3x3 block around its cell)
  function nearest(x, z) {
    const cc = clampi(Math.floor((x + half) / step), 0, cols - 1);
    const rr = clampi(Math.floor((z + half) / step), 0, rows - 1);
    let best = null, bd = Infinity;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = cc + dc, r = rr + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const s = sites[at(c, r)];
        const d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
    }
    return best;
  }

  // the k nearest sites + squared distances (for height/biome blending)
  function nearestK(x, z, k = 3) {
    const cc = clampi(Math.floor((x + half) / step), 0, cols - 1);
    const rr = clampi(Math.floor((z + half) / step), 0, rows - 1);
    const found = [];
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const c = cc + dc, r = rr + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const s = sites[at(c, r)];
        found.push({ s, d2: (s.x - x) ** 2 + (s.z - z) ** 2 });
      }
    }
    found.sort((a, b) => a.d2 - b.d2);
    return found.slice(0, k);
  }

  return { sites, cols, rows, step, neighbors, nearest, nearestK };
}

function clampi(v, a, b) { return v < a ? a : v > b ? b : v; }
