// placement.js (cities) — choose project positions from biome affinity + the
// inter-project link distances. Linked projects (Toaster/Splasher) land near each
// other; others spread. As more projects are added they naturally push outward.
import { mulberry32 } from '../gen/noise.js';
import { BIOME, BY_KEY } from '../gen/biomes.js';
import { PLACE_ORDER, desiredDist } from './registry.js';

export function placeCities(field, graph, seed, cities) {
  const rand = mulberry32((seed ^ 0xc17ee5) >>> 0);
  const byId = Object.fromEntries(cities.map((c) => [c.id, c]));
  const half = field.half;

  // candidate sites: on land, NOT on the volcano cone, and inside the central
  // REACHABLE disc (radius 260) so every city can be reached by panning — the
  // camera target is clamped to a 300-radius disc (see camera.js _clampTarget) while
  // the terrain's far edge sits well past the fog wall, out of reach.
  const REACH = 260;
  const cand = graph.sites.filter((s) => {
    if (s.biome === BIOME.OCEAN || s.biome === BIOME.VOLCANIC) return false;
    if (Math.hypot(s.x, s.z) > REACH) return false;
    return field.heightAt(s.x, s.z) > 4;
  });
  if (!cand.length) return cities.map((c, i) => ({ city: c, x: (i - 1.5) * 120, z: 0 }));

  // the lone volcano (if any): Toaster's forge likes to settle next to it
  const volc = graph.sites.find((s) => s.biome === BIOME.VOLCANIC);
  const volcPos = volc ? { x: volc.x, z: volc.z } : null;

  // ocean sites → so coastal projects (Apairo) can be pulled to the shore
  const oceanSites = graph.sites.filter((s) => s.biome === BIOME.OCEAN);
  const distToSea = (x, z) => {
    let m = Infinity;
    for (const o of oceanSites) { const d = Math.hypot(x - o.x, z - o.z); if (d < m) m = d; }
    return m;
  };

  const placed = {}; // id -> {x,z}
  const result = [];

  // affinity may be an array of biome keys (all weight 1) or a weighted map
  // { key: weight }. Non-matching biomes get a small baseline so a city can still
  // be placed if no preferred biome is reachable.
  const affinityScore = (city, site) => {
    const aff = city.affinity || [];
    if (Array.isArray(aff)) {
      return aff.some((k) => BY_KEY[k].id === site.biome) ? 1 : 0.15;
    }
    for (const k in aff) if (BY_KEY[k].id === site.biome) return aff[k];
    return 0.12;
  };

  for (const id of PLACE_ORDER) {
    const city = byId[id];
    if (!city) continue;
    let best = null, bestScore = -Infinity;
    for (const s of cand) {
      // keep cities from overlapping
      let tooClose = false;
      for (const pid in placed) {
        const p = placed[pid];
        if (Math.hypot(s.x - p.x, s.z - p.z) < (city.radius + 40)) { tooClose = true; break; }
      }
      if (tooClose) continue;

      let score = affinityScore(city, s) * 2.4;
      // Toaster's forge gravitates to the lone volcano (heat/fire kinship): reward a
      // band ~80u from the cone so it settles beside it, never on it.
      if (id === 'toaster' && volcPos) {
        const dv = Math.hypot(s.x - volcPos.x, s.z - volcPos.z);
        score += 1.3 * Math.exp(-Math.pow((dv - 80) / 60, 2));
      }
      // Apairo wants the shoreline (apéro on the plage): a strong, long-range pull
      // toward the open sea so it actually settles on the coast.
      if (id === 'apairo') {
        score += 2.8 * Math.exp(-distToSea(s.x, s.z) / 120);
      }
      // match desired link distances to already-placed projects. Linkage is the
      // user's primary signal ("Toaster & Splasher très proche"), so the distance
      // term is weighted to out-pull a merely-better biome that sits too far away.
      // Apairo's links are deliberately loose, so we relax its link term and let the
      // coast win.
      const linkW = id === 'apairo' ? 150 : 70;
      for (const pid in placed) {
        const p = placed[pid];
        const dist = Math.hypot(s.x - p.x, s.z - p.z);
        const want = desiredDist(id, pid);
        score -= Math.abs(dist - want) / linkW;
      }
      // tiny jitter so ties vary per seed
      score += rand() * 0.3;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (!best) best = cand[(rand() * cand.length) | 0];
    placed[id] = { x: best.x, z: best.z };
    result.push({ city, x: best.x, z: best.z });
  }

  // return in registry order
  return cities.map((c) => result.find((r) => r.city.id === c.id)).filter(Boolean);
}
