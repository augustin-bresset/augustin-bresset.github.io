// placement.js — scatter object positions from the biome grid.
// Density per biome comes from biomes.scatterProfile so it's easy to tune.
import { mulberry32 } from './noise.js';
import { BIOME, scatterProfile } from './biomes.js';

export function planScatter(field, slope, hydro, seed, exclusions = []) {
  const { N, idx, gx, gz, heights, moisture, biome } = field;
  const rand = mulberry32((seed ^ 0x1234abcd) >>> 0);

  const trees = [];
  const rocks = [];
  const reeds = [];

  const excluded = (wx, wz) => {
    for (const e of exclusions) {
      const dx = wx - e.x, dz = wz - e.z;
      if (dx * dx + dz * dz < e.r * e.r) return true;
    }
    return false;
  };
  const riverNear = (i, j) => {
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        if (hydro.riverMask[idx(ni, nj)]) return true;
      }
    return false;
  };

  for (let j = 1; j < N; j++) {
    for (let i = 1; i < N; i++) {
      const k = idx(i, j);
      const b = biome[k];
      if (b === BIOME.OCEAN) continue;
      const y = heights[k];
      const sl = slope[k];
      if (y < 1.6 || sl > 0.62) continue;

      const prof = scatterProfile(b);
      const wx = gx(i) + (rand() - 0.5) * 2.4;
      const wz = gz(j) + (rand() - 0.5) * 2.4;
      if (excluded(wx, wz)) continue;

      if (prof.tree > 0 && rand() < prof.tree && !riverNear(i, j)) {
        const yy = field.heightAt(wx, wz);
        const broad = b === BIOME.SAVANNA || b === BIOME.PLAINS || rand() < 0.3;
        trees.push({
          x: wx, y: yy, z: wz, scale: 0.85 + rand() * 0.8,
          rot: rand() * Math.PI * 2, kind: broad ? 'broad' : 'conifer', tint: rand(),
        });
        continue;
      }
      if (prof.rock > 0 && rand() < prof.rock) {
        const yy = field.heightAt(wx, wz);
        rocks.push({
          x: wx, y: yy, z: wz, scale: 0.8 + rand() * 1.8,
          rot: rand() * Math.PI * 2, tint: rand(),
        });
      }
    }
  }

  // reeds along river banks
  for (const poly of hydro.rivers) {
    for (let s = 0; s < poly.length; s += 2) {
      const p = poly[s];
      for (let r = 0; r < 2; r++) {
        const wx = p.x + (rand() - 0.5) * 8;
        const wz = p.z + (rand() - 0.5) * 8;
        const yy = field.heightAt(wx, wz);
        if (yy > 1 && yy < 40 && !excluded(wx, wz)) {
          reeds.push({ x: wx, y: yy, z: wz, scale: 0.7 + rand() * 0.6, rot: rand() * Math.PI * 2 });
        }
      }
    }
  }

  return { trees, rocks, reeds };
}
