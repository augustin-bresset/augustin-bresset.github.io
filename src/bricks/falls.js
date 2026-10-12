// falls.js (brick) — the great WATERFALLS: where gen/features.js findFalls found a
// stream going over a lip, a curtain of white water from the lip to the foot of the
// drop, spray boiling up where it lands, and over the tallest of them a rainbow.
import * as THREE from 'three';
import { billboards } from './clouds.js';

// falls: [{ lip, foot: { x, y, z }, drop, flow }] · field: the terrain
export function buildFalls(falls, field) {
  const group = new THREE.Group();
  group.name = 'falls';
  if (!falls.length) return { group, update() {} };
  const uTime = { value: 0 };

  // ---- the curtains: one mesh for all of them ----
  const pos = [], uvs = [], index = [], spray = [];
  for (const f of falls) {
    let dx = f.foot.x - f.lip.x, dz = f.foot.z - f.lip.z;
    const run = Math.hypot(dx, dz) || 1; dx /= run; dz /= run;
    const w0 = Math.min(6.5, 2.2 + 0.32 * Math.sqrt(f.flow)), SEG = 16, base = pos.length / 3;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG, w = w0 * (0.8 + 0.7 * t);
      for (const side of [-1, 0, 1]) {
        // it leaves the lip level and falls away in an arc — but never inside the rock:
        // where the cliff leans out under it, it runs down the cliff's face
        const out = -2 + (run + 3) * t + (side ? 0 : w * 0.3);
        const x = f.lip.x + dx * out - dz * w * side, z = f.lip.z + dz * out + dx * w * side;
        const y = Math.max(f.lip.y - 0.4 - f.drop * t * t, field.heightAt(x, z) + (side ? 0.5 : 1.1));
        pos.push(x, y, z);
        uvs.push(side * 0.5 + 0.5, t * f.drop / 14);
      }
      if (s < SEG) { const k = base + s * 3; index.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
    }
    // where it lands: spray, thrown up and drifting off
    const n = 3 + Math.min(3, (f.drop / 40) | 0);
    for (let i = 0; i < n; i++) {
      const size = (10 + f.drop * 0.16) * (0.7 + Math.random() * 0.6);
      spray.push({
        x: f.foot.x + (Math.random() - 0.5) * 9, y: f.foot.y + 2 + Math.random() * (5 + f.drop * 0.07), z: f.foot.z + (Math.random() - 0.5) * 9,
        w: size, h: size * 0.7, opacity: 0.34 + Math.random() * 0.2, phase: Math.random() * 6.28,
      });
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // (white water is bright even in the shadow of its cliff: it carries a light of its own)
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfe8ee, emissive: 0x9db4bb, emissiveIntensity: 0.55, roughness: 0.5, transparent: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFall;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vFall = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vFall;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float edge = abs(vFall.x - 0.5) * 2.0;
        // the water comes down in strands, each with its own pulses of white racing
        // down it, faster than the eye follows
        float strand = floor(vFall.x * 9.0), within = fract(vFall.x * 9.0);
        float pulse = fract(vFall.y * 0.3 - uTime * (0.8 + 0.22 * sin(strand * 12.9)) + sin(strand * 78.2) * 3.0);
        float race = smoothstep(0.0, 0.25, pulse) * (1.0 - smoothstep(0.45, 1.0, pulse));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.5 + 0.5 * race * (1.0 - 0.5 * abs(within - 0.5)));
        diffuseColor.a = (1.0 - smoothstep(0.55, 1.0, edge)) * (0.78 + 0.22 * race) * smoothstep(0.0, 0.25, vFall.y);`);
  };
  const curtain = new THREE.Mesh(geo, mat);
  curtain.renderOrder = 2; curtain.raycast = () => {};
  group.add(curtain);

  const mist = billboards(spray, { near: [18, 70] });
  mist.mesh.renderOrder = 3;
  group.add(mist.mesh);

  // ---- the rainbow, in the spray of the tallest ----
  const tall = falls.reduce((a, b) => (b.drop > a.drop ? b : a));
  if (tall.drop > 45) {
    const R = Math.min(70, tall.drop * 0.55);
    const bow = new THREE.Mesh(new THREE.RingGeometry(R * 0.8, R, 40, 1, 0, Math.PI), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uInner: { value: R * 0.8 }, uOuter: { value: R } },
      vertexShader: `
        varying vec3 vAt;
        void main() { vAt = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uInner; uniform float uOuter;
        varying vec3 vAt;
        void main() {
          float t = (length(vAt.xy) - uInner) / (uOuter - uInner);        // 0 inside (violet) … 1 outside (red)
          vec3 c = clamp(abs(mod((1.0 - t) * 4.6 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          float a = sin(3.14159 * t) * smoothstep(0.0, 0.3, vAt.y / uOuter);  // it fades into the spray at its feet
          gl_FragColor = vec4(c, a * 0.3);
        }`,
    }));
    // it stands in the spray, facing the middle of the island (where it is looked at from)
    bow.position.set(tall.foot.x, tall.foot.y + 1, tall.foot.z);
    bow.rotation.y = Math.atan2(-tall.foot.x, -tall.foot.z);
    bow.renderOrder = 4; bow.raycast = () => {};
    group.add(bow);
  }

  return { group, update(t) { uTime.value = t; mist.uniforms.uTime.value = t; } };
}
