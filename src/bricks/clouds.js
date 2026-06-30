// clouds.js (brick) — a few low-poly clouds drifting overhead, casting soft
// moving shadows on the island (the quiet Ghibli touch).
import * as THREE from 'three';
import { mulberry32 } from '../gen/noise.js';

export function buildClouds(seed, worldHalf) {
  const group = new THREE.Group();
  group.name = 'clouds';
  const rand = mulberry32((seed ^ 0xc10d5eed) >>> 0);

  const mat = new THREE.MeshStandardMaterial({
    color: 0xf3eee4, flatShading: true, roughness: 1,
    transparent: true, opacity: 0.96,
  });
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);

  const clouds = [];
  const N = 7;
  const range = worldHalf * 1.7;
  for (let c = 0; c < N; c++) {
    const cloud = new THREE.Group();
    const puffs = 3 + ((rand() * 4) | 0);
    for (let p = 0; p < puffs; p++) {
      const m = new THREE.Mesh(blobGeo, mat);
      m.position.set((rand() - 0.5) * 22, (rand() - 0.5) * 4, (rand() - 0.5) * 12);
      const s = 5 + rand() * 7;
      m.scale.set(s, s * 0.6, s);
      m.castShadow = true;
      cloud.add(m);
    }
    cloud.position.set((rand() - 0.5) * 2 * range, 104 + rand() * 40, (rand() - 0.5) * 2 * range);
    const speed = 1.4 + rand() * 1.6;
    group.add(cloud);
    clouds.push({ cloud, speed });
  }

  return {
    group,
    update(t, dt) {
      for (const c of clouds) {
        c.cloud.position.x += c.speed * dt;
        if (c.cloud.position.x > range) c.cloud.position.x = -range;
      }
    },
  };
}
