// water.js (brick) — the animated sea.
// A large flat-shaded plane whose vertices bob with summed sine waves. We patch
// MeshStandardMaterial via onBeforeCompile so we keep three's lighting + fog +
// shadows for free, and flatShading derives the wave facet normals automatically.
import * as THREE from 'three';
import { WATER_Y } from '../gen/heightmap.js';
import { ACTIVE } from '../themes.js';

// field (optional): the terrain. Its heights become a small texture the water reads to
// know how DEEP it is at each point: pale and clear over the shallows, a line of foam
// breathing along every shore — coast, lake or river mouth alike.
const DEPTH_LO = -12, DEPTH_HI = 4, SHALLOWS = 0x9fe0da;
function depthTexture(field) {
  const { verts, heights } = field;
  const data = new Uint8Array(verts * verts);
  for (let k = 0; k < data.length; k++) {
    data[k] = Math.round(255 * Math.min(1, Math.max(0, (heights[k] - DEPTH_LO) / (DEPTH_HI - DEPTH_LO))));
  }
  const tex = new THREE.DataTexture(data, verts, verts, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function buildSea(worldSize, { calmR = 700, waveR = 1100, field = null } = {}) {
  // reach the horizon/fog, but don't tie the plane to the full (huge) terrain grid
  const span = Math.min(worldSize * 3.2, 4200); // extend past the land into the fog
  const seg = Math.min(200, Math.round(span / 12)); // capped facet count (perf): 80k triangles, not 260k
  const geo = new THREE.PlaneGeometry(span, span, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(ACTIVE.water),
    roughness: 0.42,
    metalness: 0.0,
    flatShading: true,
    transparent: true,
    opacity: ACTIVE.waterOpacity,
  });

  const uniforms = {
    uTime: { value: 0 },
    uCalmR: { value: calmR },   // inside this radius the water is flat (lakes on land)
    uWaveR: { value: waveR },   // beyond this it swells fully (open sea at the horizon)
    uDepthMap: { value: field ? depthTexture(field) : null },
    uHalf: { value: field ? field.half : 1 },
    uShallow: { value: new THREE.Color(ACTIVE.water).lerp(new THREE.Color(SHALLOWS), 0.55) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (field) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D uDepthMap; uniform float uHalf; uniform float uTime; uniform vec3 uShallow;
          varying vec2 vSeaXZ;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 seaUv = vSeaXZ / (2.0 * uHalf) + 0.5;
          if (seaUv.x > 0.0 && seaUv.x < 1.0 && seaUv.y > 0.0 && seaUv.y < 1.0) {
            float ground = texture2D(uDepthMap, seaUv).r * ${(DEPTH_HI - DEPTH_LO).toFixed(1)} + ${DEPTH_LO.toFixed(1)};
            float depth = max(0.0, -ground);
            float shallow = 1.0 - smoothstep(0.0, 6.5, depth);
            diffuseColor.rgb = mix(diffuseColor.rgb, uShallow, shallow * 0.8);
            diffuseColor.a = mix(diffuseColor.a, 0.74, shallow);
            // foam: a band at the waterline that breathes in and out
            float reach = 0.34 + 0.16 * sin(uTime * 0.9 + (vSeaXZ.x + vSeaXZ.y) * 0.08);
            float foam = (1.0 - smoothstep(reach * 0.4, reach, depth)) * step(-0.25, -ground);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.97, 0.94), foam * 0.8);
            diffuseColor.a = max(diffuseColor.a, foam * 0.9);
          }`);
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec2 vSeaXZ;
        uniform float uTime; uniform float uCalmR; uniform float uWaveR;
        float seaWave(vec2 p) {
          float w = 0.0;
          w += sin(p.x * 0.06 + uTime * 0.9) * 1.3;
          w += sin(p.y * 0.05 - uTime * 0.7) * 1.1;
          w += sin((p.x + p.y) * 0.09 + uTime * 1.3) * 0.6;
          w += sin((p.x - p.y) * 0.13 - uTime * 1.7) * 0.35;
          return w;
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // calm across the island (its lakes shouldn't swell), building to real waves
        // only out in the open sea toward the horizon.
        float waveAmp = smoothstep(uCalmR, uWaveR, length(transformed.xz));
        transformed.y += seaWave(transformed.xz) * waveAmp;
        vSeaXZ = transformed.xz;`);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_Y;
  mesh.receiveShadow = false;   // avoid harsh terrain shadows projected on water
  mesh.renderOrder = 1;
  mesh.name = 'sea';

  // A second, deeper, opaque plane underneath hides the void where the sea is
  // transparent over deep water, and reads as the darker depths.
  const floorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(ACTIVE.waterFloor), roughness: 1, metalness: 0,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span, span), floorMat);
  floor.rotateX(-Math.PI / 2);
  floor.position.y = WATER_Y - 6;
  floor.name = 'seafloor-plane';
  mesh.add(floor);

  return {
    mesh,
    update(t) { uniforms.uTime.value = t; },
    restyle() {
      mat.color.set(ACTIVE.water); mat.opacity = ACTIVE.waterOpacity;
      uniforms.uShallow.value.set(ACTIVE.water).lerp(new THREE.Color(SHALLOWS), 0.55);
      floorMat.color.set(ACTIVE.waterFloor);
    },
  };
}
