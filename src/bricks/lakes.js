// lakes.js (brick) — the still water of the lakes gen/features.js carveLakes laid in
// the hollows: a sheet at each lake's level, pale over the shallows along its shore.
import * as THREE from 'three';
import { ACTIVE } from '../themes.js';

const SHALLOWS = new THREE.Color(0x9fe0da);

export function buildLakes(lakes) {
  const group = new THREE.Group();
  group.name = 'lakes';
  if (!lakes.length) return { group, update() {}, restyle() {} };
  // one mesh for them all: per lake a middle, a ring just inside the shore, the shore
  const pos = [], shore = [], index = [], SEG = 56;
  for (const lake of lakes) {
    const base = pos.length / 3;
    pos.push(lake.x, lake.level, lake.z); shore.push(0);
    for (const [reach, edge] of [[0.74, 0], [lake.shore, 1]]) {
      for (let s = 0; s < SEG; s++) {
        const th = (s / SEG) * Math.PI * 2, r = lake.radius(th) * reach;
        pos.push(lake.x + Math.cos(th) * r, lake.level, lake.z + Math.sin(th) * r); shore.push(edge);
      }
    }
    for (let s = 0; s < SEG; s++) {
      const a = base + 1 + s, b = base + 1 + (s + 1) % SEG, c = a + SEG, d = b + SEG;
      index.push(base, b, a, a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const uniforms = { uTime: { value: 0 }, uShallow: { value: new THREE.Color() } };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0, transparent: true, opacity: 0.93 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aShore;\nvarying float vShore;\nvarying vec2 vLake;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vShore = aShore; vLake = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uShallow;\nvarying float vShore;\nvarying vec2 vLake;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, uShallow, smoothstep(0.0, 0.9, vShore) * 0.75);
        // the faintest of ripples, and a thread of foam where it laps the bank
        diffuseColor.rgb += 0.014 * sin(dot(vLake, vec2(0.21, 0.13)) + uTime * 0.7) * sin(dot(vLake, vec2(-0.09, 0.24)) - uTime * 0.5);
        float lap = smoothstep(0.86 + 0.05 * sin(uTime * 0.9 + vLake.x * 0.2), 1.0, vShore);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 0.94), lap * 0.7);`);
  };
  const paint = () => { mat.color.set(ACTIVE.water); uniforms.uShallow.value.set(ACTIVE.water).lerp(SHALLOWS, 0.55); };
  paint();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.renderOrder = 1; mesh.raycast = () => {};
  group.add(mesh);
  return { group, update(t) { uniforms.uTime.value = t; }, restyle: paint };
}
