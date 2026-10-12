// volcano.js (brick) — the FIRE of a volcanic world. The mountain itself is terrain
// (gen/relief.js raises the cone and hollows its crater; gen/features.js traceLava
// finds the crater as erosion left it and the ways down from the breach in its rim).
// This brick lights it:
//   - the lava LAKE brimming in the crater: dark plates of crust adrift on the melt,
//     the seams between them white-hot;
//   - the STREAMS that spill over the breach and run down the gullies, cooling as they
//     go, from yellow to red to black rock;
//   - the PLUME: smoke boiling up out of the crater and leaning away on the wind, lit
//     from underneath; sparks thrown up out of the lake;
//   - a glow, and one light, so the crater walls and the cloud above are lit by it.
import * as THREE from 'three';
import { mistTexture } from './clouds.js';
import { WIND } from './weather.js';

// molten rock, from cold crust (0) to white-hot (1) — brighter than white on purpose:
// the tone mapping turns the excess into glare
const LAVA = `
  vec3 lavaColor(float heat) {
    vec3 c = mix(vec3(0.06, 0.045, 0.045), vec3(0.62, 0.07, 0.015), smoothstep(0.08, 0.36, heat));
    c = mix(c, vec3(1.75, 0.5, 0.05), smoothstep(0.36, 0.68, heat));
    return mix(c, vec3(2.6, 1.9, 0.7), smoothstep(0.7, 1.0, heat));
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // 1 on the seams between the plates of crust, 0 on the plates
  float seams(vec2 p) {
    float n = vnoise(p) * 0.65 + vnoise(p * 2.3 + 7.0) * 0.35;
    return 1.0 - smoothstep(0.0, 0.085, abs(n - 0.5));
  }`;
const molten = (uTime, vertex, fragment, extra = {}) => {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  uniforms.uTime = uTime;                                  // (the one clock, shared — not a copy)
  return new THREE.ShaderMaterial({
    uniforms, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra,
    vertexShader: `#include <fog_pars_vertex>\n${vertex}`,
    fragmentShader: `uniform float uTime;\n#include <common>\n#include <fog_pars_fragment>\n${LAVA}\n${fragment}`,
  });
};
const FINISH = '#include <tonemapping_fragment>\n#include <colorspace_fragment>\n#include <fog_fragment>';

// lava: what gen/features.js traceLava returned · field: the terrain
export function buildVolcano(lava, field) {
  const group = new THREE.Group();
  group.name = 'volcano';
  const uTime = { value: 0 };

  // ---- the lake ----
  {
    // a fan out to the shore the crater gives it, each way (a plain disc would stick
    // out through the breach, where the rim is nearer)
    const fan = [0, 0, 0], tris = [], S = lava.shore.length;
    lava.shore.forEach((d, a) => {
      const th = (a / S) * Math.PI * 2;
      fan.push(Math.cos(th) * d, 0, Math.sin(th) * d);
      tris.push(0, 1 + (a + 1) % S, 1 + a);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(fan, 3));
    geo.setIndex(tris);
    const lake = new THREE.Mesh(geo, molten(uTime, `
      varying vec2 vAt;
      void main() {
        vAt = position.xz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`, `
      varying vec2 vAt;
      void main() {
        // the plates drift round a slow gyre, and the whole lake breathes
        float turn = uTime * 0.035;
        vec2 p = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * vAt;
        float heat = 0.2 + 0.8 * seams(p * 0.085 + vec2(uTime * 0.012, 0.0));
        heat += 0.16 * sin(uTime * 1.7 + length(vAt) * 0.12) * seams(p * 0.05);
        heat = max(heat, 1.0 - smoothstep(0.0, ${(lava.reach * 0.3).toFixed(1)}, length(vAt)));        // the upwelling at the middle
        gl_FragColor = vec4(lavaColor(clamp(heat, 0.0, 1.0)), 1.0);
        ${FINISH}
      }`));
    lake.position.set(lava.x, lava.level, lava.z);
    lake.raycast = () => {};
    group.add(lake);
  }

  // ---- the streams ----
  for (const flow of lava.flows) {
    // corner-cut the path, then lay a three-ribbed strip on the ground along it
    let pts = flow.pts;
    for (let it = 0; it < 2; it++) {
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        out.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
      }
      out.push(pts[pts.length - 1]);
      pts = out;
    }
    const n = pts.length, pos = [], uvs = [], cool = [], index = [];
    let run = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      if (i) run += Math.hypot(p.x - a.x, p.z - a.z);
      let tx = b.x - a.x, tz = b.z - a.z;
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const u = i / (n - 1), w = (1.5 + 3.6 * (1 - 0.55 * u)) * flow.width;
      for (const side of [-1, 0, 1]) {
        const x = p.x - tz * w * side, z = p.z + tx * w * side;
        pos.push(x, Math.max(field.heightAt(x, z), i === 0 ? lava.level : -Infinity) + (side ? 0.35 : 0.8), z);
        uvs.push(side * 0.5 + 0.5, run / 9);
        cool.push(u);
      }
      if (i < n - 1) { const k = i * 3; index.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('aCool', new THREE.Float32BufferAttribute(cool, 1));
    geo.setIndex(index);
    const stream = new THREE.Mesh(geo, molten(uTime, `
      attribute float aCool; varying vec2 vUv; varying float vCool;
      void main() {
        vUv = uv; vCool = aCool;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`, `
      varying vec2 vUv; varying float vCool;
      void main() {
        float edge = abs(vUv.x - 0.5) * 2.0;
        // hot down the middle, crusted along the banks; the crust thickens as it cools,
        // rafts of it riding down on the current
        float core = 1.0 - smoothstep(0.25, 0.92, edge);
        float rafts = vnoise(vec2(vUv.x * 3.2, vUv.y * 1.5 - uTime * 0.42)) * 0.6 + vnoise(vec2(vUv.x * 7.0, vUv.y * 3.4 - uTime * 0.55)) * 0.4;
        float heat = core * (1.0 - 0.72 * pow(vCool, 0.8)) * (1.0 - smoothstep(0.34 - 0.34 * vCool, 0.9 - 0.4 * vCool, rafts) * (0.35 + 0.65 * vCool));
        heat += 0.07 * sin(uTime * 2.3 + vUv.y * 2.0) * core;
        gl_FragColor = vec4(lavaColor(clamp(heat, 0.0, 1.0)), (1.0 - smoothstep(0.9, 1.0, vCool)) * (1.0 - smoothstep(0.86, 1.0, edge) * 0.6));
        ${FINISH}
      }`, { transparent: true, side: THREE.DoubleSide }));
    stream.renderOrder = 2;
    stream.raycast = () => {};
    group.add(stream);
  }

  // ---- the plume: smoke boiling out of the crater, leaning away on the wind ----
  const top = lava.crown + 4;
  {
    const N = 26, seeds = [];
    for (let i = 0; i < N; i++) seeds.push(i / N + Math.random() * 0.02, Math.random());
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 2));
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uMap: { value: null }, uBase: { value: new THREE.Vector3(lava.x, lava.level + 6, lava.z) },
      uWind: { value: new THREE.Vector2(WIND.x, WIND.y) }, uRise: { value: Math.max(170, top * 0.85) },
    }]);
    uniforms.uMap.value = mistTexture();
    uniforms.uTime = uTime;
    const plume = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: true,
      vertexShader: `
        attribute vec2 aSeed;
        uniform float uTime; uniform vec3 uBase; uniform vec2 uWind; uniform float uRise;
        varying vec2 vUv; varying float vAge; varying float vOpacity;
        #include <fog_pars_vertex>
        void main() {
          float age = fract(uTime * 0.03 + aSeed.x);                 // 0 in the crater … 1 gone
          float up = uRise * (1.0 - pow(1.0 - age, 1.7));            // it shoots up, then slows and spreads
          vec2 swirl = vec2(sin(aSeed.y * 40.0 + age * 5.0), cos(aSeed.y * 31.0 + age * 4.0)) * (5.0 + 34.0 * age);
          vec3 c = uBase + vec3(uWind.x * uRise * 1.1 * age * age + swirl.x, up, uWind.y * uRise * 1.1 * age * age + swirl.y);
          vec4 mvPosition = modelViewMatrix * vec4(c, 1.0);
          mvPosition.xy += position.xy * mix(30.0, 165.0, pow(age, 0.7)) * (0.8 + 0.4 * aSeed.y);
          vOpacity = smoothstep(0.0, 0.05, age) * (1.0 - smoothstep(0.5, 1.0, age)) * 0.8 * smoothstep(40.0, 170.0, -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          vUv = uv; vAge = age;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec2 vUv; varying float vAge; varying float vOpacity;
        #include <common>
        #include <fog_pars_fragment>
        void main() {
          vec4 texel = texture2D(uMap, vUv);
          // dark ash low down, lit from below by the lake; paler as it thins out
          vec3 smoke = mix(vec3(0.2, 0.17, 0.16), vec3(0.66, 0.63, 0.6), smoothstep(0.0, 0.75, vAge));
          smoke += vec3(1.0, 0.33, 0.06) * (1.0 - smoothstep(0.0, 0.22, vAge)) * (1.0 - vUv.y) * 0.9;
          gl_FragColor = vec4(smoke * (0.75 + 0.25 * texel.r), texel.a * vOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    }));
    plume.frustumCulled = false; plume.renderOrder = 4; plume.raycast = () => {};
    group.add(plume);
  }

  // ---- sparks thrown out of the lake ----
  {
    const N = 40, seeds = [], dirs = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * 6.28, out = 0.15 + Math.random() * 0.55;
      seeds.push(Math.random(), 0.5 + Math.random());
      dirs.push(Math.cos(a) * out, 0.8 + Math.random() * 0.6, Math.sin(a) * out);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 2));
    geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dirs, 3));
    const sparks = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: { uTime, uBase: { value: new THREE.Vector3(lava.x, lava.level + 1, lava.z) }, uReach: { value: lava.reach * 0.4 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec2 aSeed; attribute vec3 aDir;
        uniform float uTime; uniform vec3 uBase; uniform float uReach;
        varying float vLife;
        void main() {
          float life = fract(uTime * 0.23 * aSeed.y + aSeed.x), s = life * 3.2;
          vec3 p = uBase + vec3(aDir.x, 0.0, aDir.z) * uReach + aDir * 26.0 * s - vec3(0.0, 9.5 * s * s, 0.0);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = clamp(520.0 / -mvPosition.z, 1.0, 9.0) * (1.0 - 0.6 * life);
          vLife = life;
        }`,
      fragmentShader: `
        varying float vLife;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(mix(vec3(1.0, 0.85, 0.4), vec3(0.9, 0.2, 0.03), vLife), (1.0 - vLife) * (1.0 - d * 1.6));
        }`,
    }));
    sparks.frustumCulled = false; sparks.renderOrder = 5; sparks.raycast = () => {};
    group.add(sparks);
  }

  // ---- the glow it throws: a halo over the crater, and one real light ----
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d'), grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,190,110,0.9)'); grad.addColorStop(0.35, 'rgba(255,110,40,0.36)'); grad.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6,
  }));
  halo.position.set(lava.x, top + 6, lava.z);
  halo.scale.set(lava.reach * 7, lava.reach * 5.4, 1);
  halo.renderOrder = 3; halo.raycast = () => {};
  group.add(halo);
  const ember = new THREE.PointLight(0xff6a2a, 3, lava.reach * 9, 1.6);
  ember.position.set(lava.x, lava.level + 16, lava.z);
  group.add(ember);

  return {
    group,
    update(time) {
      uTime.value = time;
      const flicker = Math.sin(time * 2.0) * 0.4 + Math.sin(time * 7.3) * 0.15;
      ember.intensity = 3 + flicker;
      halo.material.opacity = 0.55 + flicker * 0.12;
    },
  };
}
