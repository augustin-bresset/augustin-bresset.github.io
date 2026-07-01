// terrain.js (brick) — low-poly flat-shaded terrain mesh, coloured by biome.
// Non-indexed geometry: every triangle owns 3 vertices so each facet gets one
// flat colour — the crisp faceted "paper diorama / brouillon" look.
import * as THREE from 'three';
import { clamp } from '../gen/noise.js';
import { faceColor } from '../gen/biomes.js';

// cheap deterministic hash for per-face tint jitter
function hash2(i, j) {
  let h = (i * 374761393 + j * 668265263) ^ 0x9e3779b9;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// opts.cellVisible(i,j) — optional per-cell mask (floating/archipelago mode): a cell
// that fails the test is collapsed to a degenerate (zero-area) triangle so it renders
// nothing, carving the continent into separate floating islands with sky between them.
// (flatShading computes normals in-shader from position derivatives, so degenerate
// faces are safe — the vertex-normal buffer is unused.)
export function buildTerrainMesh(field, opts = {}) {
  const { N, heights, biome, idx, gx, gz } = field;
  const cellVisible = opts.cellVisible || (() => true);
  const triCount = N * N * 2;
  const positions = new Float32Array(triCount * 3 * 3);
  const colors = new Float32Array(triCount * 3 * 3);

  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), nrm = new THREE.Vector3();
  const col = new THREE.Color();

  // (re)write the vertex COLOUR buffer from the current theme palette — positions are
  // computed once, but colours are recomputed on a theme switch (buildTerrainMesh's
  // faceColor reads the active theme), so no geometry rebuild is needed.
  const writeColors = () => {
    let o = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const y00 = heights[idx(i, j)], y10 = heights[idx(i + 1, j)];
        const y01 = heights[idx(i, j + 1)], y11 = heights[idx(i + 1, j + 1)];
        const b00 = biome[idx(i, j)];
        const x0 = gx(i), x1 = gx(i + 1), z0 = gz(j), z1 = gz(j + 1);
        const tris = [
          [x0, y00, z0, x0, y01, z1, x1, y10, z0],
          [x1, y10, z0, x0, y01, z1, x1, y11, z1],
        ];
        for (let ti = 0; ti < 2; ti++) {
          const [ax, ay, az, bx, by, bz, cx, cy, cz] = tris[ti];
          pA.set(ax, ay, az); pB.set(bx, by, bz); pC.set(cx, cy, cz);
          ab.subVectors(pB, pA); ac.subVectors(pC, pA);
          nrm.crossVectors(ab, ac).normalize();
          const slope = 1 - clamp(nrm.y, 0, 1);
          const my = (ay + by + cy) / 3;
          const jit = (hash2(i * 2 + ti, j) - 0.5) * 0.05;
          faceColor(col, b00, my, slope, jit);
          for (let v = 0; v < 3; v++) {
            colors[o + v * 3] = col.r;
            colors[o + v * 3 + 1] = col.g;
            colors[o + v * 3 + 2] = col.b;
          }
          o += 9;
        }
      }
    }
  };

  // positions (once)
  let o = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x0 = gx(i), x1 = gx(i + 1), z0 = gz(j), z1 = gz(j + 1);
      const y00 = heights[idx(i, j)], y10 = heights[idx(i + 1, j)];
      const y01 = heights[idx(i, j + 1)], y11 = heights[idx(i + 1, j + 1)];
      // masked cell → both triangles collapse onto one point (invisible)
      if (!cellVisible(i, j)) {
        for (let v = 0; v < 18; v += 3) {
          positions[o + v] = x0; positions[o + v + 1] = y00; positions[o + v + 2] = z0;
        }
        o += 18;
        continue;
      }
      const tris = [
        [x0, y00, z0, x0, y01, z1, x1, y10, z0],
        [x1, y10, z0, x0, y01, z1, x1, y11, z1],
      ];
      for (let ti = 0; ti < 2; ti++) {
        const [ax, ay, az, bx, by, bz, cx, cy, cz] = tris[ti];
        positions[o] = ax; positions[o + 1] = ay; positions[o + 2] = az;
        positions[o + 3] = bx; positions[o + 4] = by; positions[o + 5] = bz;
        positions[o + 6] = cx; positions[o + 7] = cy; positions[o + 8] = cz;
        o += 9;
      }
    }
  }
  writeColors();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.98, metalness: 0,
  });
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
