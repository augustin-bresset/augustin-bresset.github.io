// placement.js — WHAT GROWS WHERE. Walks the terrain grid and decides, vertex by
// vertex, what stands there: a tree of the species its biome grows, a bush, a boulder.
// Every biome has a RECIPE (below); the world's character (its macro trend, see
// biomeGrowth.js) and a few slow noises bend it — woods thin out into clearings, a
// grove somewhere is in blossom, a whole country has turned with autumn, conifers
// frost over as they near the tree line.
import { mulberry32, Simplex, smoothstep } from './noise.js';
import { BIOME, BIOMES } from './biomes.js';
import { characterOf } from './relief.js';

// per biome `scatter` key — trees: chance per grid vertex · mix: species weights ·
// bush / rock: chances · tone: the colour family of its bushes
const RECIPES = {
  none: {},
  meadow: { trees: 0.034, mix: { broad: 1 }, bush: 0.028, tone: 'bloom', rock: 0.006 },
  forest: { trees: 0.56, mix: { broad: 0.72, conifer: 0.28 }, bush: 0.045, rock: 0.01, wood: true },
  wood: { trees: 0.2, mix: { broad: 0.5, conifer: 0.5 }, bush: 0.05, rock: 0.016, wood: true },
  taiga: { trees: 0.58, mix: { conifer: 1 }, bush: 0.02, rock: 0.014, wood: true },
  jungle: { trees: 0.74, mix: { broad: 0.62, palm: 0.38 }, bush: 0.08, rock: 0.005, wood: true },
  alpine: { trees: 0, bush: 0.012, tone: 'dry', rock: 0.05 },
  snow: { trees: 0, rock: 0.028 },
  desert: { trees: 0.017, mix: { cactus: 0.82, dead: 0.18 }, bush: 0.006, tone: 'dry', rock: 0.012 },
  savanna: { trees: 0.042, mix: { acacia: 0.86, dead: 0.14 }, bush: 0.04, tone: 'dry', rock: 0.008 },
  marsh: { trees: 0.055, mix: { dead: 0.4, broad: 0.6 }, bush: 0.05, rock: 0.004, reeds: 0.16 },
  moor: { trees: 0.012, mix: { broad: 0.55, conifer: 0.45 }, bush: 0.085, tone: 'heather', rock: 0.024 },
  shore: { trees: 0.03, mix: { palm: 1 }, bush: 0.012, tone: 'dry', rock: 0.009 },
  burnt: { trees: 0.014, mix: { dead: 1 }, rock: 0.04 },
};
// worlds where the shore is too cold for palms: something hardier grows there instead
const COLD = new Set(['alpine', 'boreal', 'highlands', 'autumn']);
const MAX_TREES = 9500, MAX_BUSHES = 3200;

// fields: the farmland round the towns (gen/farmland.js), or null
export function planScatter(field, slope, hydro, seed, exclusions = [], trend = 'balanced', fields = null) {
  const { N, idx, gx, gz, heights, biome, massif } = field;
  const rand = mulberry32((seed ^ 0x1234abcd) >>> 0);
  const sim = new Simplex((seed ^ 0x7f4a7c15) >>> 0);
  const { tree: treeLine } = characterOf(trend);
  const cold = COLD.has(trend);

  const trees = [], bushes = [], rocks = [], reeds = [], stacks = [];
  const crop = {};

  const excluded = (wx, wz) => {
    for (const e of exclusions) {
      const dx = wx - e.x, dz = wz - e.z;
      if (dx * dx + dz * dz >= e.r * e.r) continue;
      if (!e.has || e.has(wx, wz)) return true;            // (a lake knows its own shore)
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
  const pick = (mix) => {
    let tot = 0; for (const k in mix) tot += mix[k];
    let r = rand() * tot;
    for (const k in mix) { r -= mix[k]; if (r <= 0) return k; }
    return 'broad';
  };

  // Only scatter within the visible radius — the generated grid runs far past the
  // fog wall, and trees/rocks out there are never seen (but would cost plenty).
  const SCATTER_R = 1300, SCATTER_R2 = SCATTER_R * SCATTER_R;
  // a recipe's chances are per vertex of the reference grid: on a finer or coarser one
  // the same ground must grow the same number of things
  const perVertex = Math.pow((field.size / N) / (2000 / 368), 2);

  for (let j = 1; j < N; j++) {
    for (let i = 1; i < N; i++) {
      const k = idx(i, j);
      const b = biome[k];
      const up = field.lift ? field.lift[k] : 0;       // (a floating island's own level)
      const y = heights[k] - up;
      const cx = gx(i), cz = gz(j);
      if (cx * cx + cz * cz > SCATTER_R2) continue;

      // SEA STACKS: off a rocky shore, pillars the surf has left standing
      if (y < -1.2 && y > -8 && b === BIOME.OCEAN) {
        if (rand() < 0.012 * perVertex && sim.noise2D(cx * 0.006 + 80, cz * 0.006) > 0.42 && !excluded(cx, cz)) {
          stacks.push({ x: cx + (rand() - 0.5) * 3, y, z: cz + (rand() - 0.5) * 3, scale: 2.2 + rand() * 3.4, tall: 1.6 + rand() * 1.8, rot: rand() * 6.28, tint: rand() });
        }
        continue;
      }
      if (b === BIOME.OCEAN) continue;
      const sl = slope[k];
      if (y < 1.6 || sl > 0.62) continue;

      const rec = RECIPES[BIOMES[b].scatter] || RECIPES.none;
      const wx = cx + (rand() - 0.5) * 2.4, wz = cz + (rand() - 0.5) * 2.4;
      if (excluded(wx, wz)) continue;
      // a FIELD grows its crop and nothing else — but trees stand along its hedges
      if (fields && sl < 0.5 && fields.at(wx, wz, y, b, crop)) {
        if (crop.edge && rand() < 0.3 * perVertex && !riverNear(i, j)) {
          trees.push({ x: wx, y: field.heightAt(wx, wz), z: wz, scale: 0.7 + rand() * 0.45, rot: rand() * Math.PI * 2, kind: trend === 'tropical' ? 'palm' : 'broad', tint: rand(), tone: trend === 'autumn' && rand() < 0.8 ? 'autumn' : 'green' });
        }
        continue;
      }

      // a wood is not a lawn of trees: it is dense here, open there, and ends raggedly
      let chance = (rec.trees || 0) * perVertex;
      if (rec.wood) chance *= 0.25 + 1.25 * smoothstep(-0.3, 0.3, sim.fbm(cx * 0.011, cz * 0.011, { octaves: 2 }));
      if (chance > 0 && rand() < chance && sl < 0.5 && !riverNear(i, j)) {
        let kind = pick(rec.mix);
        if (kind === 'palm' && cold) kind = b === BIOME.BEACH ? 'none' : 'conifer';
        if (kind === 'broad' && trend === 'boreal' && rand() < 0.7) kind = 'conifer';
        if (kind !== 'none') {
          const yy = field.heightAt(wx, wz);
          const tree = { x: wx, y: yy, z: wz, scale: 0.85 + rand() * 0.8, rot: rand() * Math.PI * 2, kind, tint: rand(), tone: 'green' };
          if (kind === 'broad') {
            // the colour of a whole stand: autumn everywhere in an autumn country, in
            // the odd grove elsewhere; and here and there an orchard in blossom
            const grove = sim.noise2D(cx * 0.0042 + 20, cz * 0.0042 - 33);
            const bloom = sim.noise2D(cx * 0.005 - 71, cz * 0.005 + 9);
            if (trend === 'autumn' ? rand() < 0.86 : (!cold && trend !== 'tropical' && grove > 0.6 && rand() < 0.85)) tree.tone = 'autumn';
            else if (trend !== 'tropical' && trend !== 'boreal' && bloom > 0.66 && b !== BIOME.MARSH) tree.tone = 'blossom';
            // old giants standing over the canopy
            if (rec.wood && rand() < 0.016) tree.scale = 2.3 + rand() * 1.2;
          } else if (kind === 'conifer') {
            // frosted as they near the tree line, and stunted
            const high = smoothstep(treeLine - 34, treeLine + 4, yy - up);
            tree.frost = high * (0.5 + 0.5 * rand());
            tree.scale *= 1 - 0.3 * high;
            if (massif[k] > 0.1 && rand() < 0.3) tree.tone = 'dark';
          } else if (kind === 'palm') tree.scale = 0.9 + rand() * 0.55;
          trees.push(tree);
          continue;
        }
      }
      if (rec.bush && rand() < rec.bush * perVertex) {
        bushes.push({ x: wx, y: field.heightAt(wx, wz), z: wz, scale: 0.6 + rand() * 0.9, rot: rand() * 6.28, tint: rand(), tone: rec.tone || 'green' });
        continue;
      }
      if (rec.reeds && y < 4 && rand() < rec.reeds * perVertex) {
        reeds.push({ x: wx, y: field.heightAt(wx, wz), z: wz, scale: 0.8 + rand() * 0.7, rot: rand() * 6.28, tint: rand() });
        continue;
      }
      if (rec.rock && rand() < rec.rock * perVertex) {
        const yy = field.heightAt(wx, wz);
        // Terrain gradient so rocks.js can align boulders to the slope (gravity).
        const gs = field.size / field.N;
        const dhx = (field.heightAt(wx + gs, wz) - field.heightAt(wx - gs, wz)) / (2 * gs);
        const dhz = (field.heightAt(wx, wz + gs) - field.heightAt(wx, wz - gs)) / (2 * gs);
        rocks.push({
          x: wx, y: yy, z: wz, scale: rand() < 0.05 ? 2.4 + rand() * 2 : 0.65 + rand() * 1.2,   // the odd erratic block
          rot: rand() * Math.PI * 2, tint: rand(),
          nx: dhx, nz: dhz, snow: b === BIOME.SNOW,
        });
      }
    }
  }

  // reeds along river banks
  for (const poly of hydro.rivers) {
    for (let s = 0; s < poly.length; s += 2) {
      const p = poly[s];
      for (let r = 0; r < 2; r++) {
        const side = rand() < 0.5 ? -1 : 1, off = (p.w || 4) + 0.8 + rand() * 2.2;
        const q = poly[Math.min(poly.length - 1, s + 1)];
        const tx = q.x - p.x, tz = q.z - p.z, tl = Math.hypot(tx, tz) || 1;
        const wx = p.x - (tz / tl) * side * off + (rand() - 0.5) * 2, wz = p.z + (tx / tl) * side * off + (rand() - 0.5) * 2;
        const yy = field.heightAt(wx, wz);
        const above = yy - field.liftAt(wx, wz);
        if (above > 1 && above < 60 && !excluded(wx, wz)) {
          reeds.push({ x: wx, y: yy, z: wz, scale: 0.7 + rand() * 0.6, rot: rand() * Math.PI * 2, tint: rand() });
        }
      }
    }
  }

  // …and round the lakes
  for (const lake of exclusions) {
    if (!lake.radius) continue;
    for (let r = 0; r < 34; r++) {
      const th = rand() * Math.PI * 2, d = lake.radius(th) * (1.13 + rand() * 0.1);
      const wx = lake.x + Math.cos(th) * d, wz = lake.z + Math.sin(th) * d;
      if (rand() < 0.6) reeds.push({ x: wx, y: field.heightAt(wx, wz), z: wz, scale: 0.7 + rand() * 0.7, rot: rand() * Math.PI * 2, tint: rand() });
    }
  }

  // a ceiling on the count, whatever the world: thin evenly rather than cut a region off
  const thin = (list, max) => (list.length <= max ? list : list.filter(() => rand() < max / list.length));
  return { trees: thin(trees, MAX_TREES), bushes: thin(bushes, MAX_BUSHES), rocks, reeds: thin(reeds, 2200), stacks };
}
