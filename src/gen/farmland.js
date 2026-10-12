// farmland.js — the COUNTRY round the towns that have one: a patchwork of fields.
// Long strips laid side by side, each its own crop, the lot turned to an angle of the
// town's own; they stop where the ground steepens, at the water, at the woods' edge
// of the biome, and thin out with distance. Hedgerow trees stand along their borders
// (gen/placement.js) and a few barns among them (bricks/life.js).
// Pure data: `at(x, z, y, biome, out)` says whether a point is in a field, and which.
import { mulberry32, Simplex, smoothstep } from './noise.js';
import { BIOME } from './biomes.js';

const ARABLE = new Set([BIOME.PLAINS, BIOME.FOREST, BIOME.HILLS, BIOME.SAVANNA, BIOME.MOOR, BIOME.PLATEAU, BIOME.JUNGLE, BIOME.TAIGA, BIOME.MARSH]);
// which towns are farming towns (the others stand in wild country: a forge, a lab…)
const FARMED = new Set(['hubs', 'about', 'apairo']);
// what each climate grows (a field takes one of these)
const CROPS = {
  balanced: ['#dcc660', '#a6cc62', '#6f9c48', '#b08f5e', '#e6d24e', '#cdbb86'],
  prairie: ['#dcc968', '#e2d058', '#c9b98a', '#9fc264', '#b3976a'],
  verdant: ['#9fc264', '#77a04e', '#d8c56c', '#8cb85a', '#b3976a'],
  autumn: ['#d8c56c', '#b3976a', '#c98a4a', '#9fa85a', '#8c7550'],
  highlands: ['#a9b96a', '#c9c07a', '#8fae62', '#9a8c6a'],
  alpine: ['#a9c46a', '#c9c07a', '#8fae62'],
  boreal: ['#c9c07a', '#8fae62', '#a69a72'],
  tropical: ['#8fd06a', '#7fb89a', '#a6d977', '#6faa5c', '#cfd67a'],          // paddies, some of them flooded
};
const STRIP = 19, LENGTH = 36;

function hash(a, b, salt) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// pads: [{ city: { id, radius }, x, z }] · skip: [{ x, z, r, has? }] ground that is not land to farm
export function planFields(field, pads, seed, trend, { skip = [] } = {}) {
  const crops = CROPS[trend];                                  // (a desert country farms nothing)
  if (!crops) return null;
  const rand = mulberry32((seed ^ 0xfa12b) >>> 0), sim = new Simplex((seed ^ 0xfa12b) >>> 0);
  const towns = pads.filter((p) => FARMED.has(p.city.id)).map((p) => {
    const turn = rand() * Math.PI;
    return { x: p.x, z: p.z, r: p.city.radius, reach: p.city.radius * (2.2 + rand() * 0.7), cos: Math.cos(turn), sin: Math.sin(turn), turn, salt: (rand() * 0xffff) | 0 };
  });
  if (!towns.length) return null;
  const barred = (x, z) => skip.some((e) => (x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < e.r * e.r && (!e.has || e.has(x, z)));

  // → out = { color, edge } if (x, z) lies in a field (edge: on the border between two)
  const at = (x, z, y, biome, out) => {
    if (y < 2.6 || !ARABLE.has(biome)) return null;
    for (const t of towns) {
      const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz);
      if (d < t.r * 1.13 || d > t.reach) continue;
      // farmed country comes in patches, with open land between them
      if (sim.noise2D(x * 0.009 + t.salt, z * 0.009) < -0.34) return null;
      const u = (dx * t.cos + dz * t.sin) / STRIP, fu = Math.floor(u);
      const v = (dz * t.cos - dx * t.sin) / LENGTH + hash(fu, 7, t.salt), fv = Math.floor(v);
      const id = hash(fu, fv, t.salt);
      // fewer and fewer toward the fringe
      if (hash(fv, fu, t.salt ^ 0x55) < smoothstep(t.reach * 0.7, t.reach, d) * 0.8) return null;
      if (field.massifAt(x, z) > 0.06 || barred(x, z)) return null;
      out.color = crops[(id * crops.length) | 0];
      out.edge = u - fu < 0.11 || v - fv < 0.07;
      return out;
    }
    return null;
  };

  // a few barns standing in the fields
  const barns = [], probe = {};
  for (const t of towns) {
    for (let tries = 0; tries < 26 && barns.filter((b) => b.town === t).length < 5; tries++) {
      const a = rand() * Math.PI * 2, d = t.r * 1.3 + rand() * (t.reach * 0.86 - t.r * 1.3);
      const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d, y = field.heightAt(x, z);
      const steep = Math.max(Math.abs(field.heightAt(x + 5, z) - y), Math.abs(field.heightAt(x, z + 5) - y), Math.abs(field.heightAt(x - 5, z) - y), Math.abs(field.heightAt(x, z - 5) - y));
      if (steep > 1.3 || !at(x, z, y, field.biomeAt(x, z), probe)) continue;
      if (barns.some((b) => Math.hypot(b.x - x, b.z - z) < 30)) continue;
      barns.push({ x, y, z, rot: -t.turn + (rand() < 0.5 ? 0 : Math.PI / 2), tint: rand(), town: t });
    }
  }
  return { at, barns };
}
