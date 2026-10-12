// weather.js (brick) — the AIR over the land: the wind that sways what grows, and the
// shadows of clouds drifting across the country. Both are a few lines patched into a
// standard material (lighting, fog and real shadows stay three's own), so they cost
// nothing to speak of — and the land is never quite still.
//
// The cloud shadows are a small tiling noise texture, read twice at two scales by the
// WORLD position of each fragment and slid along the wind: big soft patches of shade
// crossing plains, woods and mountainsides alike. Everything that should darken under
// a cloud takes the same patch (terrain, trees, rocks…), so a shadow stays in one piece.
import * as THREE from 'three';
import { mulberry32 } from '../gen/noise.js';

// smooth noise that tiles: a few octaves of a periodic random lattice
function cloudTexture(size = 256) {
  const rand = mulberry32(0xc10d);
  const data = new Uint8Array(size * size), sum = new Float32Array(size * size);
  let amp = 1, norm = 0;
  for (const cells of [4, 8, 16, 32]) {
    const lattice = new Float32Array(cells * cells);
    for (let k = 0; k < lattice.length; k++) lattice[k] = rand();
    const at = (i, j) => lattice[(j % cells) * cells + (i % cells)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / size * cells, fy = y / size * cells, i = Math.floor(fx), j = Math.floor(fy);
      let tx = fx - i, ty = fy - j;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = at(i, j) + (at(i + 1, j) - at(i, j)) * tx, b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
      sum[y * size + x] += amp * (a + (b - a) * ty);
    }
    norm += amp; amp *= 0.5;
  }
  for (let k = 0; k < data.length; k++) data[k] = Math.round(255 * sum[k] / norm);
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export const WIND = new THREE.Vector2(0.82, 0.57);     // the way the weather travels
export const weather = {
  uTime: { value: 0 },
  uCloudMap: { value: null },
  uCloudDrift: { value: new THREE.Vector2() },
  uCloudShade: { value: 0.24 },                         // how dark it is under a cloud
};

export function updateWeather(t) {
  weather.uTime.value = t;
  weather.uCloudDrift.value.copy(WIND).multiplyScalar(t * 0.0052);
}

// Patch a standard material so it lives under this weather.
//   sway: how far its top bends in the wind, per unit of height (0 = rigid)
//   shade: false to leave it out of the clouds' shadows
export function underWeather(mat, { sway = 0, shade = true } = {}) {
  if (!weather.uCloudMap.value) weather.uCloudMap.value = cloudTexture();
  const uSway = { value: sway };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, weather, { uSway });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uSway;
        varying vec2 vLandXZ;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          if (uSway > 0.0) {
            float phase = instanceMatrix[3].x * 0.15 + instanceMatrix[3].z * 0.13;
            float h = max(position.y, 0.0);
            transformed.x += sin(uTime * 1.3 + phase) * uSway * h;
            transformed.z += cos(uTime * 1.1 + phase) * uSway * 0.6 * h;
          }
        #endif`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 landPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          landPos = instanceMatrix * landPos;
        #endif
        vLandXZ = (modelMatrix * landPos).xz;`);
    if (!shade) return;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uCloudMap; uniform vec2 uCloudDrift; uniform float uCloudShade;
        varying vec2 vLandXZ;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cloud = texture2D(uCloudMap, vLandXZ * 0.00046 + uCloudDrift).r * 0.66
          + texture2D(uCloudMap, vLandXZ * 0.0013 - uCloudDrift * 1.9).r * 0.34;
        diffuseColor.rgb *= 1.0 - uCloudShade * smoothstep(0.5, 0.66, cloud);`);
  };
  // one program per variant, whichever material compiled it first
  mat.customProgramCacheKey = () => `weather:${shade ? 1 : 0}`;
  return mat;
}
