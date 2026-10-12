// clouds.js (brick) — a soft, hazy horizon band sitting far out at the fog line so
// the sky has a gentle cloud line where the land fades away. Overhead drifting clouds
// were removed: at portal-transition altitudes (Y=230-320) they were traversed by the
// camera, causing jarring pop-in. The horizon mist stays — it's always beyond the
// camera's range and never intersects the camera path.
import * as THREE from 'three';
import { mulberry32 } from '../gen/noise.js';

// Many soft puffs as ONE mesh: a quad per puff, turned to face the camera in the vertex
// shader (what a Sprite does, but in a single draw call, not one each).
// puffs: [{ x, y, z, w, h, opacity, phase }] · near: [from, to] — a puff fades out as
// the camera comes within that range of it, so flying through one never pops.
let mistTex = null;
export const mistTexture = () => mistTex || (mistTex = makeMistTexture());
export function billboards(puffs, { near = [0, 1], color = 0xfffdf6 } = {}) {
  const centers = [], sizes = [], looks = [];
  for (const p of puffs) { centers.push(p.x, p.y, p.z); sizes.push(p.w, p.h); looks.push(p.opacity, p.phase); }
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  geo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(new Float32Array(centers), 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(sizes), 2));
  geo.setAttribute('aLook', new THREE.InstancedBufferAttribute(new Float32Array(looks), 2));   // opacity, phase
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uMap: { value: null }, uTime: { value: 0 }, uColor: { value: new THREE.Color(color) },
    uNear: { value: new THREE.Vector2(near[0], near[1]) },
  }]);
  uniforms.uMap.value = mistTexture();
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: true,
    vertexShader: `
      attribute vec3 aCenter; attribute vec2 aSize; attribute vec2 aLook;
      uniform float uTime; uniform vec2 uNear;
      varying vec2 vUv; varying float vOpacity;
      #include <fog_pars_vertex>
      void main() {
        // the haze breathes, almost imperceptibly
        vec3 c = aCenter + vec3(0.0, sin(uTime * 0.2 + aLook.y * 3.0) * 3.0, 0.0);
        vec4 mvPosition = modelViewMatrix * vec4(c, 1.0);
        vOpacity = aLook.x * smoothstep(uNear.x, uNear.y, -mvPosition.z);
        mvPosition.xy += position.xy * aSize;
        gl_Position = projectionMatrix * mvPosition;
        vUv = uv;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform vec3 uColor;
      varying vec2 vUv; varying float vOpacity;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        vec4 texel = texture2D(uMap, vUv);
        gl_FragColor = vec4(uColor * texel.rgb, texel.a * vOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  return { mesh, uniforms };
}

// peak: { x, y, z } — the island's highest summit, which wears a wreath of cloud
export function buildClouds(seed, worldHalf, { peak = null } = {}) {
  const group = new THREE.Group();
  group.name = 'clouds';
  const rand = mulberry32((seed ^ 0xc10d5eed) >>> 0);

  // ===== soft horizon band =====
  // A ring of big, soft puffs far out where the land dissolves into the fog, giving
  // the horizon a hazy cloud line. Kept WELL beyond the island (not tied to its small
  // radius) and softer, so turning the camera to a coast that faces no mountains
  // doesn't wash the whole island white. Fog-aware so they melt into the sky.
  const RINGS = [
    { r: Math.max(1050, worldHalf * 1.25), n: 120, y: 250, sMin: 360, sMax: 520, yj: 120 },
    { r: Math.max(1320, worldHalf * 1.60), n: 90, y: 380, sMin: 420, sMax: 600, yj: 160 },
  ];
  const far = [];
  for (const ring of RINGS) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + (rand() - 0.5) * 0.14;
      const rr = ring.r * (0.92 + rand() * 0.16);
      const opacity = 0.3 + rand() * 0.22;
      const w = ring.sMin + rand() * (ring.sMax - ring.sMin);
      far.push({ x: Math.cos(a) * rr, y: ring.y + (rand() - 0.5) * ring.yj, z: Math.sin(a) * rr, w, h: w * 0.6, opacity, phase: a });
    }
  }
  const bank = billboards(far);
  bank.mesh.renderOrder = -1;          // farthest thing there is: drawn before every other haze and glass
  group.add(bank.mesh);

  // ===== the summit's wreath =====
  // A real mountain makes its own weather: a loose ring of cloud hangs about the roof
  // of the island, below the summit, and turns slowly round it. (Overhead drifters
  // were removed long ago — the camera flew through them and they popped; these fade
  // out as the camera nears, so it can pass among them.)
  let wreath = null;
  if (peak && peak.y > 150) {
    const puffs = [];
    // many, wide, faint: they run into one another and read as a band, not as balls
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + rand() * 0.4, r = 40 + rand() * 95;
      const w = 120 + rand() * 90;
      puffs.push({ x: Math.cos(a) * r, y: peak.y * (0.56 + rand() * 0.17), z: Math.sin(a) * r, w, h: w * 0.36, opacity: 0.2 + rand() * 0.2, phase: a });
    }
    wreath = billboards(puffs, { near: [40, 170] });
    wreath.mesh.position.set(peak.x, 0, peak.z);
    wreath.mesh.renderOrder = 3;       // over the snow and the water behind it
    group.add(wreath.mesh);
  }

  return {
    group,
    update(t) {
      bank.mesh.rotation.y = t * 0.004;     // …and drifts
      bank.uniforms.uTime.value = t;
      if (wreath) { wreath.mesh.rotation.y = -t * 0.012; wreath.uniforms.uTime.value = t; }
    },
  };
}

// soft cumulus puff: bright rounded tops clustered high, softer base — reads as a
// sunlit cloud bank (brighter core, longer alpha hold than the old wispy mist).
function makeMistTexture() {
  const s = 256;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  // cauliflower tops across the upper body + a couple lower fill lobes
  const lobes = [
    [0.50, 0.46, 0.40], [0.30, 0.52, 0.27], [0.70, 0.52, 0.29],
    [0.42, 0.40, 0.22], [0.60, 0.40, 0.20], [0.50, 0.62, 0.34],
  ];
  for (const [cx, cy, r] of lobes) {
    const g = ctx.createRadialGradient(cx * s, cy * s, 2, cx * s, cy * s, r * s);
    g.addColorStop(0, 'rgba(255,255,253,0.96)');
    g.addColorStop(0.55, 'rgba(252,248,238,0.55)');
    g.addColorStop(1, 'rgba(248,242,228,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx * s, cy * s, r * s, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
