// terrain.js (brick) — low-poly flat-shaded terrain mesh, coloured by biome.
// Non-indexed geometry: every triangle owns 3 vertices so each facet gets one
// flat colour — the crisp faceted "paper diorama / brouillon" look.
import * as THREE from 'three';
import { clamp } from '../gen/noise.js';
import { groundColor, rockColor, shadeFace, BIOME } from '../gen/biomes.js';
import { underWeather } from './weather.js';

// cheap deterministic hash for per-face tint jitter
function hash2(i, j) {
  let h = (i * 374761393 + j * 668265263) ^ 0x9e3779b9;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// opts.shape — optional { px, pz, tris, cells } (floating islands, gen/islands.js): only
// those triangles are built, on vertices moved onto the islands' outlines — the country
// broken up into islands, with sky between them.
// opts.zones — optional [{x, z, r, color}]: city-ground fusion rings. Terrain faces
// near a city are tinted toward that city's own ground colour (full inside the pad,
// feathering out to ~1.7r), so the settlement grows out of the landscape instead of
// sitting on a dropped plate.
// opts.fields — optional farmland (gen/farmland.js): gentle faces inside a field take
// its crop's colour, darker along the hedges.
export function buildTerrainMesh(field, opts = {}) {
  const { N, heights, biome, moisture, blendIds, blendW, idx, gx, gz, verts } = field;
  const shape = opts.shape || null, lift = field.lift || null;
  const zones = (opts.zones || []).map((z) => ({ ...z, c: new THREE.Color(z.color) }));
  const fields = opts.fields || null, crop = {}, cropColor = new THREE.Color(), hedge = new THREE.Color('#5f8347');
  // the FACES: three grid vertices each (ka, kb, kc), and the cell it is cut from (ci, cj,
  // and which side of it) — every cell of the grid, or the ones an island is made of
  const triCount = shape ? shape.tris.length / 3 : N * N * 2;
  let ka = 0, kb = 0, kc = 0, ci = 0, cj = 0, side = 0;
  const face = shape
    ? (f) => { ka = shape.tris[f * 3]; kb = shape.tris[f * 3 + 1]; kc = shape.tris[f * 3 + 2]; ci = shape.cells[f * 3]; cj = shape.cells[f * 3 + 1]; side = shape.cells[f * 3 + 2]; }
    : (f) => {
      const c = f >> 1;
      ci = c % N; cj = (c / N) | 0; side = f & 1;
      if (side) { ka = idx(ci + 1, cj); kb = idx(ci, cj + 1); kc = idx(ci + 1, cj + 1); } else { ka = idx(ci, cj); kb = idx(ci, cj + 1); kc = idx(ci + 1, cj); }
    };
  const X = shape ? (k) => shape.px[k] : (k) => gx(k % verts);
  const Z = shape ? (k) => shape.pz[k] : (k) => gz((k / verts) | 0);
  const positions = new Float32Array(triCount * 3 * 3);
  const colors = new Float32Array(triCount * 3 * 3);

  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), nrm = new THREE.Vector3();
  const col = new THREE.Color(), rock = new THREE.Color();

  // HOW HOLLOW each vertex sits: the mean height of a ring two cells out, minus its
  // own — positive in a hollow or valley floor, negative on a ridge or summit. Baked
  // into the colours as ambient light, it makes the relief read even out of the sun.
  const hollow = new Float32Array(verts * verts);
  {
    const cell = field.size / N, R = 3;
    // (on a floating island: its height above the island's own level — the air beyond
    // its edge is no hollow and no ridge)
    const at = (i, j) => { const k = idx(Math.max(0, Math.min(N, i)), Math.max(0, Math.min(N, j))); return heights[k] - (lift ? lift[k] : 0); };
    const raw = new Float32Array(verts * verts);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const ring = at(i - R, j) + at(i + R, j) + at(i, j - R) + at(i, j + R)
        + at(i - 2, j - 2) + at(i + 2, j - 2) + at(i - 2, j + 2) + at(i + 2, j + 2);
      raw[idx(i, j)] = clamp((ring / 8 - at(i, j)) / (cell * 1.8), -1, 1);
    }
    // …smoothed, so it follows valleys and ridges rather than every bump of the ground
    const rawAt = (i, j) => raw[idx(Math.max(0, Math.min(N, i)), Math.max(0, Math.min(N, j)))];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      hollow[idx(i, j)] = (rawAt(i, j) * 4 + (rawAt(i - 1, j) + rawAt(i + 1, j) + rawAt(i, j - 1) + rawAt(i, j + 1)) * 2
        + rawAt(i - 1, j - 1) + rawAt(i + 1, j - 1) + rawAt(i - 1, j + 1) + rawAt(i + 1, j + 1)) / 16;
    }
  }
  const ground = new Float32Array(verts * verts * 3), rocks = new Float32Array(verts * verts * 3);
  const snowy = new Float32Array(verts * verts);      // how much of each vertex is above the snow line

  // (re)write the vertex COLOUR buffer from the current theme palette — positions are
  // computed once, but colours are recomputed on a theme switch (buildTerrainMesh's
  // shadeFace reads the active theme), so no geometry rebuild is needed.
  const writeColors = () => {
    for (let k = 0; k < verts * verts; k++) {
      groundColor(col, blendIds, blendW, k * 3, moisture[k]);
      ground[k * 3] = col.r; ground[k * 3 + 1] = col.g; ground[k * 3 + 2] = col.b;
      rockColor(col, blendIds, blendW, k * 3);
      rocks[k * 3] = col.r; rocks[k * 3 + 1] = col.g; rocks[k * 3 + 2] = col.b;
      let sn = 0;
      for (let q = 0; q < 3; q++) if (blendIds[k * 3 + q] === BIOME.SNOW) sn += blendW[k * 3 + q];
      snowy[k] = sn;
    }
    for (let f = 0, o = 0; f < triCount; f++, o += 9) {
      face(f);
      const b00 = biome[idx(ci, cj)];
      pA.set(X(ka), heights[ka], Z(ka)); pB.set(X(kb), heights[kb], Z(kb)); pC.set(X(kc), heights[kc], Z(kc));
      ab.subVectors(pB, pA); ac.subVectors(pC, pA);
      nrm.crossVectors(ab, ac).normalize();
      const slope = 1 - clamp(nrm.y, 0, 1);
      const mx = (pA.x + pB.x + pC.x) / 3, mz = (pA.z + pB.z + pC.z) / 3;
      // (its height above ITS island's own level: what the shore, the fields, the flowers go by)
      const my = (pA.y + pB.y + pC.y) / 3 - (lift ? (lift[ka] + lift[kb] + lift[kc]) / 3 : 0);
      const jit = (hash2(ci * 2 + side, cj) - 0.5) * 0.05;
      // a face is the mean of its three corners
      col.setRGB((ground[ka * 3] + ground[kb * 3] + ground[kc * 3]) / 3,
        (ground[ka * 3 + 1] + ground[kb * 3 + 1] + ground[kc * 3 + 1]) / 3,
        (ground[ka * 3 + 2] + ground[kb * 3 + 2] + ground[kc * 3 + 2]) / 3);
      rock.setRGB((rocks[ka * 3] + rocks[kb * 3] + rocks[kc * 3]) / 3,
        (rocks[ka * 3 + 1] + rocks[kb * 3 + 1] + rocks[kc * 3 + 1]) / 3,
        (rocks[ka * 3 + 2] + rocks[kb * 3 + 2] + rocks[kc * 3 + 2]) / 3);
      if (fields && slope < 0.14 && fields.at(mx, mz, my, b00, crop)) {
        col.lerp(cropColor.set(crop.color), 0.86);
        if (crop.edge) col.lerp(hedge, 0.72);
      }
      shadeFace(col, rock, b00, my, slope, (hollow[ka] + hollow[kb] + hollow[kc]) / 3, jit, (snowy[ka] + snowy[kb] + snowy[kc]) / 3);
      // city-ground fusion: the terrain IS the city floor now (no platform
      // mesh) — near-uniform city colour inside the pad radius, feathering
      // back to the biome beyond it
      for (const zn of zones) {
        const d = Math.hypot(mx - zn.x, mz - zn.z);
        if (d > zn.r * 1.45) continue;
        const tt = d < zn.r ? 0.94
          : 0.94 * (1 - clamp((d - zn.r) / (zn.r * 0.45), 0, 1));
        col.lerp(zn.c, tt);
      }
      for (let v = 0; v < 3; v++) {
        colors[o + v * 3] = col.r;
        colors[o + v * 3 + 1] = col.g;
        colors[o + v * 3 + 2] = col.b;
      }
    }
  };

  // positions (once)
  for (let f = 0, o = 0; f < triCount; f++, o += 9) {
    face(f);
    positions[o] = X(ka); positions[o + 1] = heights[ka]; positions[o + 2] = Z(ka);
    positions[o + 3] = X(kb); positions[o + 4] = heights[kb]; positions[o + 5] = Z(kb);
    positions[o + 6] = X(kc); positions[o + 7] = heights[kc]; positions[o + 8] = Z(kc);
  }
  writeColors();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = underWeather(new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.98, metalness: 0,
  }));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return {
    mesh,
    // recolour to the current theme without touching geometry
    restyle() { writeColors(); geo.attributes.color.needsUpdate = true; },
  };
}
