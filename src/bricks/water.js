// water.js (brick) — the animated sea.
// A large flat-shaded plane whose vertices bob with summed sine waves. We patch
// MeshStandardMaterial via onBeforeCompile so we keep three's lighting + fog +
// shadows for free, and flatShading derives the wave facet normals automatically.
import * as THREE from 'three';
import { WATER_Y } from '../gen/heightmap.js';
import { ACTIVE } from '../themes.js';

export function buildSea(worldSize, { calmR = 700, waveR = 1100 } = {}) {
  // reach the horizon/fog, but don't tie the plane to the full (huge) terrain grid
  const span = Math.min(worldSize * 3.2, 4200); // extend past the land into the fog
  const seg = Math.min(360, Math.round(span / 12)); // capped facet count (perf)
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
  };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uCalmR = uniforms.uCalmR;
    shader.uniforms.uWaveR = uniforms.uWaveR;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
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
        transformed.y += seaWave(transformed.xz) * waveAmp;`);
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
      floorMat.color.set(ACTIVE.waterFloor);
    },
  };
}
