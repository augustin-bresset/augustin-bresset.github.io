// flying.js (brick) — what makes the archipelago FLOAT (?world=floating, with
// gen/islands.js): the rock hanging under every island, the roots that trail from its
// edge, the boulders and islets adrift around it, the lodestones that glow under its
// keel, and the sea of cloud it all rides above.
import * as THREE from 'three';
import { mulberry32, Simplex, clamp, smoothstep } from '../gen/noise.js';
import { rockColor } from '../gen/biomes.js';
import { billboards } from './clouds.js';

function hash2(i, j) {
  let h = (i * 374761393 + j * 668265263) ^ 0x9e3779b9;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const ROCK = new THREE.Color('#756a5d');
const ROCK_D = new THREE.Color('#463d33');
const DEEP = new THREE.Color('#2e2821');
const DIRT = new THREE.Color('#6a5437');
const MOSS = new THREE.Color('#65763f');
// (worlds where nothing green trails from a cliff: bare roots there)
const DRY = new Set(['arid', 'alpine', 'boreal']);

// THE UNDERSIDE — a second surface on the island's own triangles (so top and bottom
// share every vertex of the edge: watertight, whatever the outline). How far it hangs
// goes by how far IN from the edge a point is: a sheer lip at the rim, then tapering to
// a keel under the middle — deep under a broad island, shallow under an islet — with
// slow swells and hanging spires on the way down.
// → { geo, keels: [{ x, y, z, size }] } (the lowest point of each island)
function buildUnderside(field, isl, seed) {
  const { N, verts, heights, idx, size, blendIds, blendW } = field;
  const { px, pz, tris, used, edge, comp, comps } = isl;
  const n = verts * verts, cell = size / N;
  const sim = new Simplex((seed ^ 0x0de5) >>> 0);

  // distance in from the edge: two sweeps of a chamfer transform (round, where a
  // step-by-step flood would give diamonds)
  const dist = new Float32Array(n).fill(1e6);
  for (let k = 0; k < n; k++) if (!used[k] || edge(k)) dist[k] = 0;
  const relax = (k, i, j, di, dj, w) => {
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni > N || nj > N) return;
    const d = dist[idx(ni, nj)] + w;
    if (d < dist[k]) dist[k] = d;
  };
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = idx(i, j);
    if (!dist[k]) continue;
    relax(k, i, j, -1, 0, 1); relax(k, i, j, 0, -1, 1); relax(k, i, j, -1, -1, 1.414); relax(k, i, j, 1, -1, 1.414);
  }
  for (let j = N; j >= 0; j--) for (let i = N; i >= 0; i--) {
    const k = idx(i, j);
    if (!dist[k]) continue;
    relax(k, i, j, 1, 0, 1); relax(k, i, j, 0, 1, 1); relax(k, i, j, 1, 1, 1.414); relax(k, i, j, -1, 1, 1.414);
  }
  for (const c of comps) c.inMax = 0;
  for (let k = 0; k < n; k++) if (used[k]) { const c = comps[comp[k]]; if (dist[k] * cell > c.inMax) c.inMax = dist[k] * cell; }

  const bottom = new Float32Array(n);
  const keels = comps.map(() => null);
  for (let k = 0; k < n; k++) {
    if (!used[k]) continue;
    const c = comps[comp[k]], x = px[k], z = pz[k], into = dist[k] * cell;
    const depth = clamp(c.inMax * 1.25 + 26, 34, 300);
    const u = clamp(into / (c.inMax || 1), 0, 1), inside = Math.min(1, into / 26);
    const lip = Math.min(depth * 0.3, 24) * smoothstep(0, cell * 2.4, into);
    let dive = lip + (depth - lip) * Math.pow(u, 0.85);
    dive *= 1 + inside * 0.34 * sim.noise2D(x * 0.011 + 4, z * 0.011 - 6);
    // (a few great fangs, and a fringe of small ones)
    const fang = Math.max(0, sim.noise2D(x * 0.021 + 50, z * 0.021 + 9) - 0.42) / 0.58;
    const tooth = Math.max(0, sim.noise2D(x * 0.06 - 17, z * 0.06 + 31) - 0.5) / 0.5;
    dive += inside * depth * (0.55 * fang * Math.sqrt(fang) + 0.14 * tooth);
    dive += (hash2((k % verts) * 7 + (seed & 1023), ((k / verts) | 0) * 13) - 0.5) * 18 * inside;
    bottom[k] = heights[k] - Math.max(0, dive);
    if (!keels[c.id] || bottom[k] < keels[c.id].y) keels[c.id] = { x, y: bottom[k], z, size: c.inMax };
  }

  const count = tris.length / 3;
  const positions = new Float32Array(count * 9), colors = new Float32Array(count * 9);
  const col = new THREE.Color(), stone = new THREE.Color();
  for (let f = 0, o = 0; f < count; f++, o += 9) {
    // (the top's triangle, turned over)
    const ka = tris[f * 3], kb = tris[f * 3 + 2], kc = tris[f * 3 + 1];
    positions[o] = px[ka]; positions[o + 1] = bottom[ka]; positions[o + 2] = pz[ka];
    positions[o + 3] = px[kb]; positions[o + 4] = bottom[kb]; positions[o + 5] = pz[kb];
    positions[o + 6] = px[kc]; positions[o + 7] = bottom[kc]; positions[o + 8] = pz[kc];
    const my = (bottom[ka] + bottom[kb] + bottom[kc]) / 3, below = (heights[ka] + heights[kb] + heights[kc]) / 3 - my;
    // the country's own stone (red under a mesa, black under a volcano), laid in
    // strata; earth and moss just under the turf, darker the deeper it hangs
    rockColor(stone, blendIds, blendW, ka * 3);
    col.copy(ROCK).lerp(stone, 0.5);
    const band = Math.sin(my * 0.17 + 2.4 * sim.noise2D(px[ka] * 0.004, pz[ka] * 0.004));
    col.offsetHSL(0, 0, band > 0.35 ? 0.05 : band < -0.55 ? -0.04 : 0);
    col.lerp(ROCK_D, Math.min(0.62, below / 230));
    if (below > 170) col.lerp(DEEP, Math.min(1, (below - 170) / 150));
    if (below < 9) col.copy(DIRT).lerp(MOSS, hash2(ka, 3) * 0.55);
    col.offsetHSL(0, 0, (hash2(ka * 3, f) - 0.5) * 0.05);
    for (let v = 0; v < 3; v++) { colors[o + v * 3] = col.r; colors[o + v * 3 + 1] = col.g; colors[o + v * 3 + 2] = col.b; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return { geo, keels: keels.filter(Boolean) };
}

// what drifts in the air rides up and down, each thing in its own time (after its place
// in the world is known: `aRide` = phase, reach)
function riding(material, uTime) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aRide;\nuniform float uTime;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        mvPosition.y += sin(uTime * 0.45 + aRide.x) * aRide.y;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  return material;
}

// a lump of rock with a turfed top: the body of an islet (unit size, top at y = 0)
function isletGeometry(rand) {
  const SEG = 7, pos = [], colr = [];
  const grass = new THREE.Color('#7f9a4c'), col = new THREE.Color();
  const ring = (r, y, jag) => Array.from({ length: SEG }, (_, s) => {
    const a = (s / SEG) * Math.PI * 2, rr = r * (1 + (rand() - 0.5) * jag);
    return [Math.cos(a) * rr, y + (rand() - 0.5) * jag * 0.3, Math.sin(a) * rr];
  });
  const top = ring(1, 0, 0.3), mid = ring(0.74, -0.55, 0.5), low = ring(0.34, -1.25, 0.6), tip = [0.06, -1.9, -0.04];
  const tri = (a, b, c, color) => { pos.push(...a, ...b, ...c); for (let v = 0; v < 3; v++) colr.push(color.r, color.g, color.b); };
  for (let s = 0; s < SEG; s++) {
    const t = (s + 1) % SEG;
    tri([0, 0.12, 0], top[t], top[s], col.copy(grass).offsetHSL(0, 0, (rand() - 0.5) * 0.06));
    for (const [up, down, shade] of [[top, mid, 0], [mid, low, 0.4]]) {
      col.copy(ROCK).lerp(ROCK_D, shade + rand() * 0.3);
      tri(up[s], up[t], down[s], col); tri(up[t], down[t], down[s], col);
    }
    tri(low[s], low[t], tip, col.copy(ROCK_D).lerp(DEEP, rand() * 0.6));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  geo.computeVertexNormals();
  return geo;
}

// islands: gen/islands.js buildIslandField · trend: the world's climate
export function buildFlying(field, half, seed, { islands, trend = 'balanced' }) {
  const group = new THREE.Group();
  group.name = 'flying';
  const rand = mulberry32((seed ^ 0xf1a1) >>> 0);
  const uTime = { value: 0 };
  const o3 = new THREE.Object3D(), col = new THREE.Color();

  // ---- 1. the rock under the islands ----
  const under = buildUnderside(field, islands, seed);
  const underside = new THREE.Mesh(under.geo, new THREE.MeshStandardMaterial({
    // (double-sided: from under an island nothing may ever be seen through)
    vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  }));
  underside.name = 'flying-underside';
  underside.receiveShadow = true;
  group.add(underside);

  const rims = islands.comps.flatMap((c) => c.rim);
  const inAir = (x, z, clear = 4) => !islands.atWorld(x, z, -clear);

  // ---- 2. roots and creepers trailing from the edge ----
  {
    const strip = [];
    for (const turn of [0, Math.PI / 2]) {
      const g = new THREE.PlaneGeometry(1, 1, 1, 4).translate(0, -0.5, 0);
      const p = g.attributes.position;
      for (let v = 0; v < p.count; v++) p.setX(v, p.getX(v) * (1 - 0.85 * -p.getY(v)));      // it tapers to its tip
      strip.push(g.rotateY(turn).toNonIndexed());
    }
    const pos = [...strip[0].attributes.position.array, ...strip[1].attributes.position.array];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide, flatShading: true });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime;
      // (it swings from where it is rooted, the tip the most)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float hang = position.y * position.y;
          transformed.x += sin(uTime * 1.1 + instanceMatrix[3][0] * 0.31 + instanceMatrix[3][2] * 0.17) * 0.5 * hang;
          transformed.z += cos(uTime * 0.8 + instanceMatrix[3][2] * 0.29) * 0.35 * hang;`);
    };
    const picks = rims.filter(() => rand() < 0.3);
    const roots = new THREE.InstancedMesh(geo, mat, picks.length);
    const tones = DRY.has(trend) ? ['#6b5136', '#7d6243', '#584330'] : ['#4f6b33', '#5d7a3a', '#3f5a2c', '#6b5136'];
    picks.forEach((p, i) => {
      const w = 0.7 + rand() * 1.5;
      o3.position.set(p.x + p.nx * 0.5, p.y - 0.2, p.z + p.nz * 0.5);
      o3.rotation.set(0, rand() * Math.PI, 0);
      o3.scale.set(w, 4 + rand() * rand() * 26, w);
      o3.updateMatrix();
      roots.setMatrixAt(i, o3.matrix);
      roots.setColorAt(i, col.set(tones[(rand() * tones.length) | 0]).offsetHSL(0, 0, (rand() - 0.5) * 0.08));
    });
    roots.name = 'roots'; roots.raycast = () => {};
    group.add(roots);
  }

  // ---- 3. what has broken off and drifts alongside: boulders, and a few islets with
  // a tree or two still standing on them ----
  {
    const boulder = new THREE.IcosahedronGeometry(1, 0);
    const n = Math.min(170, Math.round(rims.length * 0.05)), rides = new Float32Array(n * 2);
    const rocks = new THREE.InstancedMesh(boulder, riding(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }), uTime), n);
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0, z = 0;
      for (let tries = 0; tries < 12; tries++) {
        const p = rims[(rand() * rims.length) | 0], out = 7 + rand() * rand() * 80, slip = (rand() - 0.5) * 30;
        x = p.x + p.nx * out - p.nz * slip; z = p.z + p.nz * out + p.nx * slip;
        y = p.y - 6 - rand() * 120 + (rand() < 0.2 ? 30 * rand() : 0);
        if (inAir(x, z, 5)) break;
      }
      const s = 1 + rand() * rand() * 6.5;
      o3.position.set(x, y, z);
      o3.rotation.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
      o3.scale.set(s * (0.7 + rand() * 0.6), s * (0.8 + rand() * 0.9), s * (0.7 + rand() * 0.6));
      o3.updateMatrix();
      rocks.setMatrixAt(i, o3.matrix);
      rocks.setColorAt(i, col.copy(ROCK).lerp(ROCK_D, rand() * 0.7));
      rides[i * 2] = rand() * 6.28; rides[i * 2 + 1] = 0.5 + rand() * 1.1;
    }
    boulder.setAttribute('aRide', new THREE.InstancedBufferAttribute(rides, 2));
    rocks.name = 'drift-rocks'; rocks.raycast = () => {}; rocks.frustumCulled = false;
    group.add(rocks);

    const spots = [];
    for (let tries = 0; tries < 900 && spots.length < 14; tries++) {
      const a = rand() * 6.28, r = 120 + rand() * 780, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!inAir(x, z, 32) || inAir(x, z, 170) || spots.some((s) => Math.hypot(s.x - x, s.z - z) < 80)) continue;
      spots.push({ x, z, y: field.liftAt(x, z) + 8 + (rand() - 0.62) * 80, r: 8 + rand() * rand() * 15, turn: rand() * 6.28, ride: [rand() * 6.28, 0.9 + rand() * 1.3] });
    }
    const body = isletGeometry(rand), crown = new THREE.ConeGeometry(1, 2.6, 6).translate(0, 2.1, 0), trunk = new THREE.CylinderGeometry(0.16, 0.22, 1, 5).translate(0, 0.5, 0);
    const lumps = new THREE.InstancedMesh(body, riding(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), uTime), spots.length);
    const stand = [];
    spots.forEach((s, i) => {
      o3.position.set(s.x, s.y, s.z); o3.rotation.set(0, s.turn, 0); o3.scale.set(s.r, s.r * (0.9 + rand() * 0.7), s.r); o3.updateMatrix();
      lumps.setMatrixAt(i, o3.matrix);
      if (DRY.has(trend) && rand() < 0.6) return;
      for (let t = 0, many = 1 + ((rand() * Math.min(4, s.r / 4)) | 0); t < many; t++) {
        const a = rand() * 6.28, d = rand() * s.r * 0.55;
        stand.push({ x: s.x + Math.cos(a) * d, y: s.y + 0.1, z: s.z + Math.sin(a) * d, size: 1.3 + rand() * 1.5, ride: s.ride });
      }
    });
    body.setAttribute('aRide', new THREE.InstancedBufferAttribute(new Float32Array(spots.flatMap((s) => s.ride)), 2));
    lumps.name = 'drift-islets'; lumps.raycast = () => {}; lumps.frustumCulled = false; lumps.receiveShadow = true;
    group.add(lumps);
    if (stand.length) {
      const rides = new Float32Array(stand.flatMap((s) => s.ride));
      const leaves = ['#3f6b3a', '#4d7a3c', '#35603a', '#5a8442'];
      const parts = [[crown, (s) => col.set(leaves[(rand() * leaves.length) | 0])], [trunk, () => col.set('#5c4630')]];
      for (const [geo, tint] of parts) {
        const mesh = new THREE.InstancedMesh(geo, riding(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }), uTime), stand.length);
        stand.forEach((s, i) => {
          o3.position.set(s.x, s.y, s.z); o3.rotation.set(0, i * 2.4, 0); o3.scale.setScalar(s.size); o3.updateMatrix();
          mesh.setMatrixAt(i, o3.matrix); mesh.setColorAt(i, tint(s));
        });
        geo.setAttribute('aRide', new THREE.InstancedBufferAttribute(rides, 2));
        mesh.raycast = () => {}; mesh.frustumCulled = false;
        group.add(mesh);
      }
    }
  }

  // ---- 4. the lodestones: what holds an island up, glowing under its keel ----
  {
    const big = under.keels.filter((k) => k.size > 40);
    const gem = new THREE.OctahedronGeometry(1, 0).scale(0.42, 1.5, 0.42);
    const stones = new THREE.InstancedMesh(gem, new THREE.MeshStandardMaterial({ color: 0x9fe6df, emissive: 0x4fd6c8, emissiveIntensity: 1.7, flatShading: true, roughness: 0.3 }), big.length * 3);
    big.forEach((k, i) => {
      const s = clamp(k.size / 16, 3.4, 9);
      for (let g = 0; g < 3; g++) {
        const a = g * 2.1 + i, off = g ? s * 0.55 : 0, sg = g ? s * 0.55 : s;
        o3.position.set(k.x + Math.cos(a) * off, k.y + sg * 0.3 + (g ? s * 0.5 : 0), k.z + Math.sin(a) * off);
        o3.rotation.set(g ? 0.35 : 0, a, g ? -0.3 : 0); o3.scale.setScalar(sg); o3.updateMatrix();
        stones.setMatrixAt(i * 3 + g, o3.matrix);
      }
    });
    stones.name = 'lodestones'; stones.raycast = () => {};
    group.add(stones);
  }

  // ---- 5. the sea of cloud: a floor of it far below, turning slowly, and wisps
  // caught in the gaps between the islands ----
  const floor = [], wisps = [];
  for (let i = 0; i < 300; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * half * 1.75, w = 240 + rand() * 440;
    floor.push({ x: Math.cos(a) * r, y: -150 - rand() * 150, z: Math.sin(a) * r, w, h: w * 0.56, opacity: 0.42 + rand() * 0.42, phase: rand() * 6.28 });
  }
  for (let tries = 0; tries < 600 && wisps.length < 60; tries++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * half * 0.95, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!inAir(x, z, 14)) continue;
    const w = 130 + rand() * 170;
    wisps.push({ x, y: field.liftAt(x, z) - 16 - rand() * 70, z, w, h: w * 0.42, opacity: 0.2 + rand() * 0.26, phase: rand() * 6.28 });
  }
  const bank = billboards(floor), mist = billboards(wisps, { near: [50, 210] });
  bank.mesh.renderOrder = 0; mist.mesh.renderOrder = 3;
  group.add(bank.mesh, mist.mesh);

  group.visible = false;             // shown only when the flying mode is active
  return {
    group,
    setVisible(v) { group.visible = v; },
    update(t) {
      uTime.value = t;
      bank.mesh.rotation.y = t * 0.006; bank.uniforms.uTime.value = t; mist.uniforms.uTime.value = t;
    },
  };
}
