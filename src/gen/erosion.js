// erosion.js — FLUVIAL EROSION: the relief is cut by the water that runs over it.
// The fBm heightfield has hills but no drainage: its valleys go nowhere. Here every
// cell is pulled toward the cell it drains into, the harder the more water passes
// through it (the stream-power law, dh/dt = -K · A^m · slope). That equation is solved
// implicitly, receivers first (Braun & Willett 2013): going up each flow line, a cell
// only needs the already-updated height of the cell below it, so the scheme is stable
// at any strength and one pass over the grid does a whole time-step. A few rounds,
// re-routing the flow each time, leave branching valleys that deepen and widen
// downstream, with ridges standing between them.
// Afterwards dry hollows are silted up a little, toward their spill level.
import { drainage } from './hydrology.js';
import { BIOME } from './biomes.js';

const BASE = 1.0;    // nothing is cut below this: the coastline stays where the biomes put it
const GRADE = 0.045; // …and a valley floor always keeps this much fall per cell toward the sea

// strength: how hard a cell is pulled per round, times (drainage area in cells)^m.
// With m near 0.5 the result barely depends on the grid's resolution.
export function erode(field, { rounds = 4, strength = 0.03, m = 0.4, silt = 2.5 } = {}) {
  const { heights, verts, resist } = field;
  const n = verts * verts;
  for (let round = 0; round < rounds; round++) {
    const { filled, order, receiver, accum } = drainage(field);
    for (let o = 0; o < n; o++) {
      const k = order[o], r = receiver[k];
      if (r < 0) continue;
      const h = heights[k];
      if (h <= BASE) continue;                              // sea bed and lake floors keep their shape
      const hr = Math.max(heights[r], BASE);
      if (h <= hr) continue;                                // inside a hollow: nothing to cut toward
      const f = strength * Math.pow(accum[k], m) * (1 - resist[k]);      // (hard rock barely gives)
      heights[k] = Math.max(hr + GRADE, (h + f * hr) / (1 + f));
    }
    for (let k = 0; k < n; k++) {
      if (heights[k] > BASE && filled[k] > heights[k] && resist[k] < 0.5) heights[k] = Math.min(filled[k], heights[k] + silt);
    }
  }
  return field;
}

// SCREE: rock does not stand steeper than it can hold. Where a mountainside is steeper
// than the angle of repose, material slides from each cell to its lowest neighbour
// until it is not (thermal erosion) — needles and knife-edges slump into the broad
// faces and scree fans of a real massif. Only the mountains: a mesa's cliff is meant
// to stand sheer.
// passes / repose are the GREAT relief's (gen/relief.js RELIEF: needles keep their
// edge, domes are worn right down, tables are not touched); the country's ordinary
// ranges always settle the ordinary way.
export function settle(field, { passes = 5, repose = 1.15 } = {}) {
  const { N, heights, biome, massif, resist, idx, size } = field;
  const cell = size / N;
  for (let pass = 0; pass < Math.max(passes, 5); pass++) {
    for (let j = 1; j < N; j++) {
      for (let i = 1; i < N; i++) {
        const k = idx(i, j);
        if (heights[k] < 24 || resist[k] > 0.5) continue;
        const great = massif[k] > 0.03;
        if (great ? pass >= passes : pass >= 5 || (biome[k] !== BIOME.MOUNTAIN && biome[k] !== BIOME.SNOW)) continue;
        const talus = (great ? repose : 1.15) * cell;        // the steepest drop a cell may keep
        let low = k, drop = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const nk = idx(i + di, j + dj), d = (heights[k] - heights[nk]) / (di && dj ? Math.SQRT2 : 1);
          if (d > drop) { drop = d; low = nk; }
        }
        if (drop > talus) {
          const move = (drop - talus) * 0.42;
          heights[k] -= move; heights[low] += move;
        }
      }
    }
  }
  return field;
}
