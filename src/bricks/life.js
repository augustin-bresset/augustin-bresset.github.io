// life.js (brick) — what MOVES on the land, and the few odd things a traveller finds
// there. None of it is a project: it is the country going about its day.
//   - herds grazing where their kind lives (sheep on the grass and the moor, bison on
//     the savanna, deer under the trees), a camel caravan plodding round the dunes,
//     flamingos standing in the marsh;
//   - birds: flocks wheeling over the woods and the shore, a pair of eagles riding the
//     air off the summit;
//   - sails off the coast, and a lighthouse on the cape that reaches furthest out;
//   - balloons adrift on the wind; whales surfacing off the coast, and in the cold
//     countries icebergs standing out to sea;
//   - curiosities: a ring of standing stones, a tree older than everything, a wreck
//     on a beach, a refuge and its flag at the very top of the island — and what each
//     CLIMATE's people left behind: windmills on the grasslands, a castle on its hill,
//     pyramids in the desert, a temple under the jungle, stone heads watching a shore,
//     an arch of red rock.
// Every moving kind is ONE instanced mesh, its animals placed afresh each frame from
// a few numbers apiece (a couple of hundred matrices in all).
import * as THREE from 'three';
import { mulberry32, smoothstep } from '../gen/noise.js';
import { BIOME } from '../gen/biomes.js';
import { weather, WIND } from './weather.js';

const UP = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// boxes → one geometry, each box with its own shade (a vertex colour: the instance's
// colour multiplies it, so a cream sheep keeps a dark head)
function boxes(list) {
  const pos = [], col = [];
  for (const [w, h, d, x, y, z, shade = 1, rz = 0] of list) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    pos.push(...g.attributes.position.array);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(shade, shade, shade);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
// several parts, each of one colour → one geometry (its vertex colours carry them)
function parts(list) {
  const pos = [], col = [], c = new THREE.Color();
  for (const [geo, color] of list) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const v of g.attributes.position.array) pos.push(v);
    c.set(color);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
const box = (w, h, d, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); return g.translate(x, y, z); };
const drum = (r0, r1, h, x = 0, y = 0, z = 0, seg = 8) => new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y + h / 2, z);
const solid = (o = {}) => new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9, vertexColors: true, ...o });

// a grazing beast, nose toward +X: barrel, neck and lowered head, four legs
const GRAZER = () => boxes([
  [1.7, 0.95, 0.85, 0, 1.15, 0], [0.5, 0.7, 0.4, 0.95, 1.2, 0, 0.5, -0.5], [0.55, 0.42, 0.4, 1.3, 0.85, 0, 0.42],
  [0.17, 0.75, 0.17, 0.6, 0.37, 0.27, 0.45], [0.17, 0.75, 0.17, 0.6, 0.37, -0.27, 0.45],
  [0.17, 0.75, 0.17, -0.6, 0.37, 0.27, 0.45], [0.17, 0.75, 0.17, -0.6, 0.37, -0.27, 0.45],
]);
// a wader: a small body high on two stilts, a long neck
const WADER = () => boxes([
  [0.75, 0.42, 0.4, 0, 1.6, 0], [0.1, 1.0, 0.1, 0.42, 2.15, 0, 1, -0.25], [0.26, 0.16, 0.14, 0.62, 2.62, 0, 0.75],
  [0.05, 1.4, 0.05, 0.05, 0.7, 0.1, 0.8], [0.05, 1.4, 0.05, -0.05, 0.7, -0.1, 0.8],
]);
// a sailing boat, bow toward +Z: hull and mast (the sails are a mesh of their own)
function HULL() {
  const g = boxes([[1.25, 0.75, 3.6, 0, 0.2, 0], [0.11, 4.6, 0.11, 0, 2.8, 0.25, 0.5]]);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {                      // pinch the bow, tuck the stern
    const z = p.getZ(i);
    if (p.getY(i) < 1 && Math.abs(z) > 1.2) p.setX(i, p.getX(i) * (z > 0 ? 0.18 : 0.6));
  }
  return g;
}
function SAILS() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.9, 0.1, 0, 0.9, -1.75, 0, 4.9, 0.2,               // the mainsail, behind the mast
    0, 0.9, 0.42, 0, 4.4, 0.32, 0, 0.75, 1.85,             // the jib, before it
  ], 3));
  g.computeVertexNormals();
  return g;
}
// a bird, flying toward +Z: its wings beat in the vertex shader (see flap below)
function BIRD() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.05, 0.45, -0.1, 0, -0.4, 0.1, 0, -0.4,            // body
    0.06, 0, 0.2, 1.5, 0, -0.05, 0.06, 0, -0.3,            // right wing
    -0.06, 0, 0.2, -0.06, 0, -0.3, -1.5, 0, -0.05,         // left wing
  ], 3));
  g.computeVertexNormals();
  return g;
}

const HERDS = [
  { kind: 'sheep', biomes: [BIOME.PLAINS, BIOME.PLATEAU, BIOME.MOOR, BIOME.HILLS], colors: ['#f2ecde', '#e9e2d2', '#f2ecde', '#4a423b'], size: 0.82, n: [6, 12], herds: 5, roam: 4.5 },
  { kind: 'bison', biomes: [BIOME.SAVANNA], colors: ['#7e5a3a', '#6a4a2f', '#8c6a45'], size: 1.25, n: [5, 9], herds: 3, roam: 6 },
  { kind: 'deer', biomes: [BIOME.FOREST, BIOME.TAIGA, BIOME.JUNGLE], colors: ['#aa774c', '#96683f'], size: 0.92, n: [3, 6], herds: 3, roam: 5 },
];

export function buildLife(field, graph, seed, { exclusions = [], islands = null, barns = [] } = {}) {
  const group = new THREE.Group();
  group.name = 'life';
  const rand = mulberry32((seed ^ 0x11fe0a5) >>> 0);
  const o3 = new THREE.Object3D(), col = new THREE.Color();
  const updaters = [];
  const taken = exclusions.map((e) => ({ ...e }));          // …and each thing placed keeps the next ones off
  const claims = [];                                        // ground a curiosity stands on: nothing grows there
  const places = {};                                        // where each curiosity ended up (name → { x, y, z })
  const tall = [];                                          // what stands high enough to be flown or piped INTO: { x, y, z, r, h }
  const rises = (at, r, h) => tall.push({ x: at.x, y: at.y, z: at.z, r, h });
  const free = (x, z, r = 0) => taken.every((e) => Math.hypot(x - e.x, z - e.z) > e.r + r) && (!islands || islands.atWorld(x, z, 8 + r * 0.5));
  const flat = (x, z, reach = 8) => {
    const h = field.heightAt(x, z);
    return Math.max(Math.abs(field.heightAt(x + reach, z) - h), Math.abs(field.heightAt(x - reach, z) - h),
      Math.abs(field.heightAt(x, z + reach) - h), Math.abs(field.heightAt(x, z - reach) - h));
  };
  // a spot of open ground in one of these biomes, within sight of the middle of the map
  // (of: how many such spots to look at, keeping the HIGHEST — a castle wants its hill)
  const spot = (biomes, { maxR = 760, room = 14, level = 4, minY = 2.2, maxY = Infinity, claim = false, of = 1, where = null } = {}) => {
    const sites = graph.sites.filter((s) => biomes.includes(s.biome) && Math.hypot(s.x, s.z) < maxR);
    let best = null;
    for (let tries = 0, found = 0; tries < 40 * of && found < of && sites.length; tries++) {
      const s = sites[(rand() * sites.length) | 0];
      const x = s.x + (rand() - 0.5) * 44, z = s.z + (rand() - 0.5) * 44, y = field.heightAt(x, z);
      const up = y - field.liftAt(x, z);          // (above its island's own level, if it floats)
      if (!biomes.includes(field.biomeAt(x, z)) || up < minY || up > maxY) continue;
      if (!free(x, z, room) || flat(x, z, room * 0.6) > level || (where && !where(x, z))) continue;
      found++;
      if (!best || y > best.y) best = { x, z, y };
    }
    if (!best) return null;
    taken.push({ x: best.x, z: best.z, r: room });
    if (claim) claims.push({ x: best.x, z: best.z, r: room });
    return best;
  };
  // a builder levels the ground he builds on: a shelf of radius r, easing back into the slope
  const levelGround = (x, z, r) => {
    const { N, size, half, heights, idx, gx, gz } = field;
    const cell = size / N, ci = Math.round((x + half) / cell), cj = Math.round((z + half) / cell), n = Math.ceil(r * 1.7 / cell);
    let sum = 0, cnt = 0;
    const each = (fn) => {
      for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
        const i = ci + di, j = cj + dj;
        if (i >= 0 && j >= 0 && i <= N && j <= N) fn(idx(i, j), Math.hypot(gx(i) - x, gz(j) - z));
      }
    };
    each((k, d) => { if (d < r) { sum += heights[k]; cnt++; } });
    const y = cnt ? sum / cnt : field.heightAt(x, z);
    each((k, d) => { heights[k] += (y - heights[k]) * (1 - smoothstep(r, r * 1.7, d)); });
    return y;
  };
  const trend = graph.trend, among = (...list) => list.includes(trend);
  const place = (mesh, i, x, y, z, heading, s = 1, tall = 1) => {
    o3.position.set(x, y, z); o3.rotation.set(0, heading, 0); o3.scale.set(s, s * tall, s);
    o3.updateMatrix(); mesh.setMatrixAt(i, o3.matrix);
  };
  const instanced = (geo, mat, n, o = {}) => {
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.castShadow = !!o.cast; mesh.receiveShadow = !o.cast && o.receive !== false;
    mesh.frustumCulled = false;                             // they roam: their bounds are the whole map
    mesh.raycast = () => {};
    group.add(mesh);
    return mesh;
  };

  // ===== HERDS: every beast strolls its own slow loop around a spot of pasture =====
  {
    const beasts = [];
    for (const kind of HERDS) {
      for (let h = 0; h < kind.herds; h++) {
        const home = spot(kind.biomes, { room: 16, level: 5 });
        if (!home) continue;
        const n = kind.n[0] + ((rand() * (kind.n[1] - kind.n[0] + 1)) | 0);
        for (let i = 0; i < n; i++) {
          const a = rand() * Math.PI * 2, r = 2 + rand() * 11;
          beasts.push({
            x: home.x + Math.cos(a) * r, z: home.z + Math.sin(a) * r, roam: kind.roam * (0.5 + rand()),
            w1: 0.05 + rand() * 0.06, w2: 0.04 + rand() * 0.07, p1: rand() * 6.28, p2: rand() * 6.28,
            size: kind.size * (0.85 + rand() * 0.3), color: kind.colors[(rand() * kind.colors.length) | 0],
          });
        }
      }
    }
    // the CARAVAN: camels in file, round and round a loop among the dunes
    const camp = spot([BIOME.DESERT], { room: 46, level: 9 });
    const camels = [];
    if (camp) for (let i = 0; i < 7; i++) camels.push({ lag: i * 0.11, size: 1.25 + (i % 3) * 0.08, color: i % 3 ? '#c9a56a' : '#b8935a' });
    const total = beasts.length + camels.length;
    if (total) {
      const mesh = instanced(GRAZER(), solid(), total);
      beasts.forEach((b, i) => mesh.setColorAt(i, col.set(b.color)));
      camels.forEach((c, i) => mesh.setColorAt(beasts.length + i, col.set(c.color)));
      updaters.push((t) => {
        beasts.forEach((b, i) => {
          const x = b.x + Math.sin(t * b.w1 + b.p1) * b.roam, z = b.z + Math.cos(t * b.w2 + b.p2) * b.roam;
          const vx = Math.cos(t * b.w1 + b.p1) * b.w1, vz = -Math.sin(t * b.w2 + b.p2) * b.w2;
          place(mesh, i, x, field.heightAt(x, z), z, Math.atan2(-vz, vx), b.size);
        });
        camels.forEach((c, i) => {
          const a = t * 0.045 - c.lag, x = camp.x + Math.cos(a) * 34, z = camp.z + Math.sin(a) * 22;
          place(mesh, beasts.length + i, x, field.heightAt(x, z), z, Math.atan2(-Math.cos(a) * 22, -Math.sin(a) * 34), c.size, 1.3);
        });
        mesh.instanceMatrix.needsUpdate = true;
      });
    }
  }

  // ===== FLAMINGOS: standing about in the marsh, turning now and then =====
  {
    const birds = [];
    for (let f = 0; f < 3; f++) {
      const home = spot([BIOME.MARSH], { room: 12, level: 2.5, minY: 0.6 });
      if (!home) continue;
      for (let i = 0; i < 9; i++) {
        const a = rand() * 6.28, r = 1 + rand() * 9;
        birds.push({ x: home.x + Math.cos(a) * r, z: home.z + Math.sin(a) * r, turn: rand() * 6.28, w: 0.03 + rand() * 0.05, size: 0.85 + rand() * 0.3 });
      }
    }
    if (birds.length) {
      const mesh = instanced(WADER(), solid(), birds.length);
      birds.forEach((b, i) => mesh.setColorAt(i, col.set(i % 4 ? '#f08fa8' : '#f7b3c2')));
      updaters.push((t) => {
        birds.forEach((b, i) => {
          const x = b.x + Math.sin(t * b.w + b.turn) * 1.6, z = b.z + Math.cos(t * b.w * 0.8 + b.turn) * 1.6;
          place(mesh, i, x, Math.max(0, field.heightAt(x, z)) - 0.15, z, b.turn + Math.sin(t * b.w * 2) * 1.2, b.size);
        });
        mesh.instanceMatrix.needsUpdate = true;
      });
    }
  }

  // ===== BIRDS: flocks wheeling in loose skeins; two eagles off the summit =====
  {
    const birds = [];
    const flock = (cx, cz, alt, n, o = {}) => {
      const R = o.radius ?? 50 + rand() * 60, w = (o.speed ?? 9 + rand() * 4) / R * (rand() < 0.5 ? 1 : -1), p = rand() * 6.28;
      for (let i = 0; i < n; i++) {
        // a skein: each bird a little behind and to one side of the one before
        const rank = Math.ceil(i / 2), wing = i % 2 ? 1 : -1;
        birds.push({ cx, cz, alt, R: R + wing * rank * (o.spread ?? 2.6), w, p: p - Math.sign(w) * rank * (o.spread ?? 2.6) * 1.2 / R, size: o.size ?? 1, color: o.color ?? '#3d3d44', bob: rand() * 6.28 });
      }
    };
    const land = graph.sites.filter((s) => s.biome !== BIOME.OCEAN && Math.hypot(s.x, s.z) < 780);
    const coast = graph.sites.filter((s) => s.biome === BIOME.BEACH && Math.hypot(s.x, s.z) < 900);
    for (let f = 0; f < 5 && land.length; f++) {
      const s = land[(rand() * land.length) | 0];
      flock(s.x, s.z, field.ceilingAt(s.x, s.z) + 26 + rand() * 22, 7 + ((rand() * 6) | 0));
    }
    for (let f = 0; f < 3 && coast.length; f++) {             // gulls
      const s = coast[(rand() * coast.length) | 0];
      flock(s.x, s.z, 16 + rand() * 14, 5 + ((rand() * 5) | 0), { color: '#f4f4f0', radius: 34 + rand() * 30 });
    }
    const peak = graph.massif.peak;
    flock(peak.x, peak.z, peak.y * 0.8, 2, { color: '#5a4630', size: 2.3, radius: 110, speed: 7, spread: 40 });
    if (birds.length) {
      const flap = { value: 0 };
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = flap;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float beat = sin(uTime * 9.0 + instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9);
            transformed.y += beat * abs(position.x) * 0.55;`);
      };
      const mesh = instanced(BIRD(), mat, birds.length, { receive: false });
      birds.forEach((b, i) => mesh.setColorAt(i, col.set(b.color)));
      updaters.push((t) => {
        flap.value = t;
        birds.forEach((b, i) => {
          const a = b.p + t * b.w, x = b.cx + Math.cos(a) * b.R, z = b.cz + Math.sin(a) * b.R;
          // flying along the circle: heading is its tangent (the model looks down +Z)
          const hx = -Math.sin(a) * Math.sign(b.w), hz = Math.cos(a) * Math.sign(b.w);
          place(mesh, i, x, b.alt + Math.sin(t * 0.5 + b.bob) * 1.6, z, Math.atan2(hx, hz), b.size);
        });
        mesh.instanceMatrix.needsUpdate = true;
      });
    }
  }

  // ===== BALLOONS: montgolfières adrift on the wind, crossing the island and coming back =====
  {
    // the envelope's gores, sorted into two meshes so a balloon can wear two colours
    const lathe = new THREE.LatheGeometry([[0.9, 0], [2.6, 2.2], [4.1, 4.8], [4.6, 7.2], [4.2, 9.4], [3.0, 11.0], [1.4, 11.9], [0.01, 12.2]].map(([r, y]) => new THREE.Vector2(r, y)), 12).toNonIndexed();
    const gores = [[], []], lp = lathe.attributes.position;
    for (let i = 0; i < lp.count; i += 3) {
      const a = Math.atan2(lp.getZ(i) + lp.getZ(i + 1) + lp.getZ(i + 2), lp.getX(i) + lp.getX(i + 1) + lp.getX(i + 2));
      const into = gores[Math.floor((a + Math.PI) / (Math.PI / 6) + 12) % 2];
      for (let v = i; v < i + 3; v++) into.push(lp.getX(v), lp.getY(v), lp.getZ(v));
    }
    const gore = (list) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list, 3)); g.computeVertexNormals(); return g; };
    const cloth = () => new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.85 });
    const LIVERY = [['#d9412f', '#f4ecd8'], ['#f0b83a', '#2f6f8f'], ['#3f8f6a', '#f4ecd8'], ['#7a4fa0', '#f0b83a'], ['#2f6f8f', '#e9743a'], ['#e9743a', '#f4ecd8'], ['#c8452f', '#f0b83a']];
    const N = 7, fleet = [];
    for (let i = 0; i < N; i++) {
      const side = (rand() - 0.5) * 1180, reach = Math.sqrt(780 * 780 - side * side);
      fleet.push({ side, reach, at: rand() * 2 * reach, speed: 2.6 + rand() * 2.4, alt: 62 + rand() * 96, size: 1.5 + rand() * 0.9, bob: rand() * 6.28, turn: rand() * 6.28, livery: LIVERY[i % LIVERY.length] });
    }
    const a = instanced(gore(gores[0]), cloth(), N, { cast: true }), b = instanced(gore(gores[1]), cloth(), N, { cast: true });
    // the basket, hung by four ropes under the mouth
    const basket = instanced(boxes([[1.3, 1.1, 1.3, 0, -3.3, 0, 1], [0.07, 3.1, 0.07, 0.55, -1.4, 0.55, 0.5], [0.07, 3.1, 0.07, -0.55, -1.4, 0.55, 0.5], [0.07, 3.1, 0.07, 0.55, -1.4, -0.55, 0.5], [0.07, 3.1, 0.07, -0.55, -1.4, -0.55, 0.5]]), solid(), N);
    fleet.forEach((f, i) => { a.setColorAt(i, col.set(f.livery[0])); b.setColorAt(i, col.set(f.livery[1])); basket.setColorAt(i, col.set('#8a6238')); });
    updaters.push((t) => {
      fleet.forEach((f, i) => {
        const along = (f.at + f.speed * t) % (2 * f.reach) - f.reach;
        const x = WIND.x * along - WIND.y * f.side, z = WIND.y * along + WIND.x * f.side;
        // (it rises over the high ground, and at either end of its crossing it is too far off to see come or go)
        const y = Math.max(f.alt, field.ceilingAt(x, z) + 34) + Math.sin(t * 0.21 + f.bob) * 3.5;
        o3.position.set(x, y, z); o3.rotation.set(0, f.turn + t * 0.02, 0);
        o3.scale.setScalar(f.size * smoothstep(f.reach, f.reach - 90, Math.abs(along)));
        o3.updateMatrix(); a.setMatrixAt(i, o3.matrix); b.setMatrixAt(i, o3.matrix); basket.setMatrixAt(i, o3.matrix);
      });
      a.instanceMatrix.needsUpdate = b.instanceMatrix.needsUpdate = basket.instanceMatrix.needsUpdate = true;
    });
  }

  // ===== THE SEA: sails off the coast, and the lighthouse =====
  if (!islands) {
    // open water all round a loop → a boat can sail it
    const boats = [];
    for (let tries = 0; tries < 60 && boats.length < 8; tries++) {
      const a = rand() * Math.PI * 2;
      let r = 300;
      while (r < 1150 && field.heightAt(Math.cos(a) * r, Math.sin(a) * r) > -4.5) r += 12;
      const cx = Math.cos(a) * (r + 80 + rand() * 90), cz = Math.sin(a) * (r + 80 + rand() * 90);
      const ra = 46 + rand() * 60, rb = 30 + rand() * 34, tilt = rand() * 3.14;
      const at = (u) => [cx + Math.cos(u) * ra * Math.cos(tilt) - Math.sin(u) * rb * Math.sin(tilt), cz + Math.cos(u) * ra * Math.sin(tilt) + Math.sin(u) * rb * Math.cos(tilt)];
      let clear = Math.hypot(cx, cz) < 1250;
      for (let k = 0; k < 16 && clear; k++) { const [x, z] = at(k / 16 * 6.28); if (field.heightAt(x, z) > -3) clear = false; }
      if (clear && boats.every((b) => Math.hypot(b.cx - cx, b.cz - cz) > 150)) {
        boats.push({ cx, cz, at, w: (0.03 + rand() * 0.025) * (rand() < 0.5 ? 1 : -1), p: rand() * 6.28, size: 1.5 + rand() * 0.9,
          hull: ['#f3efe6', '#2f5f8a', '#a8402f', '#f3efe6'][(rand() * 4) | 0], sail: ['#fbf8f0', '#fbf8f0', '#e9d9b0', '#d9583b', '#f0b84a'][(rand() * 5) | 0] });
      }
    }
    if (boats.length) {
      const hulls = instanced(HULL(), solid({ roughness: 0.7 }), boats.length, { cast: true });
      const sails = instanced(SAILS(), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9, side: THREE.DoubleSide }), boats.length, { cast: true });
      boats.forEach((b, i) => { hulls.setColorAt(i, col.set(b.hull)); sails.setColorAt(i, col.set(b.sail)); });
      updaters.push((t) => {
        boats.forEach((b, i) => {
          const u = b.p + t * b.w, [x, z] = b.at(u), [x2, z2] = b.at(u + Math.sign(b.w) * 0.02);
          const heading = Math.atan2(x2 - x, z2 - z);
          o3.position.set(x, 0.1 + Math.sin(t * 0.9 + b.p) * 0.18, z);
          o3.rotation.set(Math.sin(t * 0.7 + b.p) * 0.05, heading, 0.1 + Math.sin(t * 0.8 + b.p * 2) * 0.06, 'YXZ');   // pitching, heeling
          o3.scale.setScalar(b.size);
          o3.updateMatrix(); hulls.setMatrixAt(i, o3.matrix); sails.setMatrixAt(i, o3.matrix);
        });
        hulls.instanceMatrix.needsUpdate = true; sails.instanceMatrix.needsUpdate = true;
      });
    }

    // open water at a bearing: how far out the sea bed first drops below `deep`
    const offshore = (a, deep = -5) => { let r = 260; while (r < 1150 && field.heightAt(Math.cos(a) * r, Math.sin(a) * r) > deep) r += 12; return r; };

    // WHALES: each rounds its own loop off the coast, coming up to breathe — the back
    // arches out of the water, the spout goes up, the flukes lift as it sounds
    {
      const pod = [];
      for (let tries = 0; tries < 40 && pod.length < 3; tries++) {
        const a = rand() * Math.PI * 2, r = offshore(a, -7) + 90 + rand() * 120;
        const cx = Math.cos(a) * r, cz = Math.sin(a) * r, R = 46 + rand() * 40;
        let clear = r < 1150;
        for (let k = 0; k < 12 && clear; k++) if (field.heightAt(cx + Math.cos(k / 12 * 6.28) * R, cz + Math.sin(k / 12 * 6.28) * R) > -5) clear = false;
        if (clear && pod.every((w) => Math.hypot(w.cx - cx, w.cz - cz) > 200)) pod.push({ cx, cz, R, w: (0.018 + rand() * 0.012) * (rand() < 0.5 ? 1 : -1), p: rand() * 6.28, every: 15 + rand() * 9, off: rand(), size: 1.5 + rand() * 0.8 });
      }
      if (pod.length) {
        const body = new THREE.IcosahedronGeometry(1, 1).scale(1.25, 1.05, 4.6);
        const flukes = new THREE.BufferGeometry();
        flukes.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.1, -4.2, 2.3, 0.2, -6.4, 0, 0.1, -5.5, 0, 0.1, -4.2, 0, 0.1, -5.5, -2.3, 0.2, -6.4], 3));
        const whale = instanced(parts([[body, '#52687b'], [flukes, '#45596a']]), solid({ roughness: 0.55, side: THREE.DoubleSide }), pod.length, { receive: false });
        const spout = instanced(new THREE.ConeGeometry(0.55, 1, 6, 1, true).rotateX(Math.PI).translate(0, 0.5, 0),     // (point down: a spray that opens upward)
          new THREE.MeshBasicMaterial({ color: 0xf2f8f8, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), pod.length, { receive: false });
        updaters.push((t) => {
          pod.forEach((w, i) => {
            const a = w.p + t * w.w, x = w.cx + Math.cos(a) * w.R, z = w.cz + Math.sin(a) * w.R;
            const heading = Math.atan2(-Math.sin(a) * Math.sign(w.w), Math.cos(a) * Math.sign(w.w));
            const breath = ((t / w.every + w.off) % 1) / 0.36;                 // 0…1 while it is up, beyond that it is under
            const up = breath < 1 ? Math.sin(Math.PI * breath) : 0;
            o3.position.set(x, -2.4 * w.size + 3.1 * w.size * Math.pow(up, 0.8), z);
            o3.rotation.set(breath < 1 ? -0.5 * Math.cos(Math.PI * breath) : 0.5, heading, 0, 'YXZ');
            o3.scale.setScalar(w.size);
            o3.updateMatrix(); whale.setMatrixAt(i, o3.matrix);
            // the spout: up fast as the head clears the water, then blown away
            const blow = breath > 0.22 && breath < 0.62 ? Math.sin(Math.PI * (breath - 0.22) / 0.4) : 0;
            o3.position.set(x + Math.sin(heading) * 3 * w.size, 0.6, z + Math.cos(heading) * 3 * w.size);
            o3.rotation.set(0, 0, 0); o3.scale.set(w.size * (0.6 + blow), w.size * 5.5 * blow + 0.001, w.size * (0.6 + blow));
            o3.updateMatrix(); spout.setMatrixAt(i, o3.matrix);
          });
          whale.instanceMatrix.needsUpdate = spout.instanceMatrix.needsUpdate = true;
        });
      }
    }

    // ICEBERGS, where the sea is cold: tabular blocks standing out from the coast, nodding in the swell
    if (among('boreal', 'alpine')) {
      const bergs = [];
      for (let tries = 0; tries < 90 && bergs.length < 16; tries++) {
        const a = rand() * Math.PI * 2, r = offshore(a, -7) + 70 + rand() * rand() * 440;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (r > 1250 || field.heightAt(x, z) > -5 || bergs.some((g) => Math.hypot(g.x - x, g.z - z) < 46)) continue;
        bergs.push({ x, z, s: 7 + rand() * rand() * 22, tall: 0.3 + rand() * 0.45, rot: rand() * 6.28, p: rand() * 6.28 });
      }
      if (bergs.length) {
        const ice = instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8fb9c8, emissiveIntensity: 0.3, flatShading: true, roughness: 0.35 }), bergs.length, { cast: true });
        bergs.forEach((g, i) => ice.setColorAt(i, col.set(i % 3 ? '#f4fafb' : '#d3eef4')));
        updaters.push((t) => {
          bergs.forEach((g, i) => {
            o3.position.set(g.x, g.s * g.tall * 0.3 + Math.sin(t * 0.5 + g.p) * 0.25, g.z);
            o3.rotation.set(Math.sin(t * 0.31 + g.p) * 0.03, g.rot, Math.cos(t * 0.27 + g.p) * 0.03);
            o3.scale.set(g.s, g.s * g.tall, g.s * 0.8);
            o3.updateMatrix(); ice.setMatrixAt(i, o3.matrix);
          });
          ice.instanceMatrix.needsUpdate = true;
        });
      }
    }

    // the LIGHTHOUSE: on the cape that reaches furthest out to sea
    let cape = null, reach = 0;
    for (let a = 0; a < 6.28; a += 0.035) {
      let r = 200;
      while (r < 1150 && field.heightAt(Math.cos(a) * (r + 14), Math.sin(a) * (r + 14)) > 2.5) r += 7;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = field.heightAt(x, z);
      if (r > reach && r < 1100 && y > 2.5 && y < 30 && free(x, z, 20) && field.heightAt(Math.cos(a) * (r + 60), Math.sin(a) * (r + 60)) < 0) { reach = r; cape = { x, z, y }; }
    }
    if (cape) {
      taken.push({ x: cape.x, z: cape.z, r: 16 }); claims.push({ x: cape.x, z: cape.z, r: 9 });
      places.lighthouse = cape; rises(cape, 5, 27);
      const house = new THREE.Group(); house.position.set(cape.x, cape.y - 0.6, cape.z);
      const drum = (r0, r1, h, y, color, o = {}) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 10), new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...o }));
        m.position.y = y + h / 2; m.castShadow = true; m.receiveShadow = true; m.raycast = () => {};
        house.add(m);
        return m;
      };
      drum(3.4, 3.2, 1.6, 0, 0x8c8577);                                             // the rock footing
      ['#f4f0e6', '#c8452f', '#f4f0e6', '#c8452f', '#f4f0e6'].forEach((c, i) => drum(2.3 - i * 0.22, 2.08 - i * 0.22, 3.6, 1.6 + i * 3.6, c));
      drum(1.9, 1.9, 0.35, 19.6, 0x3a3d42);                                         // the gallery
      const lamp = drum(1.0, 1.0, 1.7, 19.95, 0xfff2b8, { emissive: 0xffe08a, emissiveIntensity: 1.6 });
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.5, 10), new THREE.MeshStandardMaterial({ color: 0xc8452f, flatShading: true }));
      cap.position.y = 22.4; cap.raycast = () => {}; house.add(cap);
      // the beam: two shafts of light sweeping round
      const beams = new THREE.Group(); beams.position.y = 20.8; house.add(beams);
      for (const side of [1, -1]) {
        const shaft = new THREE.Mesh(new THREE.ConeGeometry(5.5, 58, 10, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true }));
        shaft.rotation.z = side * Math.PI / 2; shaft.position.x = side * 29; shaft.raycast = () => {};
        beams.add(shaft);
      }
      group.add(house);
      updaters.push((t) => { beams.rotation.y = t * 0.5; lamp.material.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.3; });
    }
  }

  // ===== CURIOSITIES =====
  const prop = (geo, color, o = {}) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, ...o }));
    m.castShadow = true; m.receiveShadow = true; m.raycast = () => {};
    return m;
  };
  // a ring of standing stones on open high ground
  {
    const at = spot([BIOME.MOOR, BIOME.PLATEAU, BIOME.PLAINS, BIOME.HILLS], { room: 15, level: 3.5, claim: true });
    if (at) {
      const stones = [];
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * 6.28, h = 3.4 + rand() * 2.2, x = Math.cos(a) * 8.5, z = Math.sin(a) * 8.5;
        if (i === 4) continue;                                                       // one has fallen
        stones.push([1.7, h, 1.05, x, h / 2 - 0.4, z, 0.85 + rand() * 0.25, (rand() - 0.5) * 0.14]);
      }
      stones.push([3.4, 0.9, 1.6, 0, 0.3, 0, 0.8], [1.3, 0.8, 4.2, Math.cos(4 / 11 * 6.28) * 9.5, 0.2, Math.sin(4 / 11 * 6.28) * 9.5, 0.8, 0.3]);
      places.stones = at;
      const ring = prop(boxes(stones), 0xb9b4a6, { vertexColors: true });
      ring.position.set(at.x, at.y, at.z);
      group.add(ring);
    }
  }
  // the ELDER TREE: older than the woods around it, seen from half the island away
  {
    const at = spot([BIOME.FOREST, BIOME.JUNGLE, BIOME.PLAINS, BIOME.HILLS, BIOME.TAIGA], { room: 22, level: 3.2, maxR: 620, claim: true });
    if (at) claims[claims.length - 1].r = 9;                 // the wood comes right up to its roots
    if (at) {
      places.elder = at; rises(at, 13, 40);
      const tree = new THREE.Group(); tree.position.set(at.x, at.y - 0.5, at.z);
      const trunk = new THREE.CylinderGeometry(1.5, 3.4, 20, 7); trunk.translate(0, 10, 0);
      tree.add(prop(trunk, 0x5e452d));
      for (const [x, y, z, r] of [[0, 27, 0, 12], [8, 22, 3, 8], [-7, 23, -4, 8.5], [2, 21, -9, 7], [-3, 20, 8, 7.5]]) {
        const crown = new THREE.IcosahedronGeometry(r, 0); crown.scale(1, 0.72, 1); crown.translate(x, y, z);
        const leaf = prop(crown, 0x4f8f45);
        leaf.material.onBeforeCompile = (shader) => {                               // it breathes with the wind
          shader.uniforms.uTime = weather.uTime;
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(uTime * 0.8 + position.y * 0.2) * 0.25;');
        };
        tree.add(leaf);
      }
      for (let i = 0; i < 5; i++) {                                                 // roots like buttresses
        const a = i / 5 * 6.28 + 0.4;
        const root = new THREE.CylinderGeometry(0.4, 1.3, 9, 5);
        root.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, V(Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8).normalize()));
        root.translate(Math.cos(a) * 4.6, 2.2, Math.sin(a) * 4.6);
        tree.add(prop(root, 0x5e452d));
      }
      group.add(tree);
    }
  }
  // a WRECK on a beach: the ribs of a ship the sea gave back
  if (!islands) {
    const at = spot([BIOME.BEACH], { room: 12, level: 2.5, maxR: 900, minY: 0.8, claim: true });
    if (at) {
      const ribs = [[1.0, 0.7, 12, 0, 0.3, 0, 0.75]];                                // the keel
      for (let i = -4; i <= 4; i++) for (const side of [1, -1]) {
        const h = 3.6 - Math.abs(i) * 0.35;
        ribs.push([0.3, h, 0.3, side * (1.9 - Math.abs(i) * 0.12), h / 2 + 0.2, i * 1.25, 0.6 + rand() * 0.3, side * -0.45]);
      }
      ribs.push([0.3, 8, 0.3, 0.6, 3.6, -1.5, 0.55, -0.5]);                          // what is left of the mast
      places.wreck = at;
      const wreck = prop(boxes(ribs), 0x5b4532, { vertexColors: true });
      wreck.position.set(at.x, at.y - 0.3, at.z); wreck.rotation.set(0.06, rand() * 6.28, 0.22);
      group.add(wreck);
    }
  }
  // the REFUGE at the top of the island: a hut, a cairn, a flag in the wind
  {
    const { x, y, z } = graph.massif.peak;
    if (y - field.liftAt(x, z) > 80 && !graph.massif.crater && (!islands || islands.atWorld(x, z))) {       // (nobody winters on a crater's rim)
      places.refuge = { x, y, z };
      const top = new THREE.Group(); top.position.set(x, y - 0.6, z);
      top.add(prop(boxes([[2.6, 1.8, 2.2, 0, 0.9, 0], [3.0, 0.3, 2.6, 0, 1.95, 0, 0.5], [0.5, 0.9, 0.1, 0.4, 0.6, 1.11, 0.3]]), 0xb85a3a, { vertexColors: true }));
      const cairn = new THREE.DodecahedronGeometry(0.9, 0); cairn.scale(1, 1.5, 1); cairn.translate(-2.6, 0.9, 0.6);
      top.add(prop(cairn, 0x8a857c));
      top.add(prop(new THREE.CylinderGeometry(0.06, 0.06, 6, 4).translate(-2.6, 4.2, 0.6), 0x3a3d42));
      const flag = prop(new THREE.PlaneGeometry(2.2, 1.1, 6, 1).translate(1.1, 0, 0), 0xd9412f, { side: THREE.DoubleSide });
      flag.castShadow = false; flag.position.set(-2.6, 6.5, 0.6);
      flag.material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = weather.uTime;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.z += sin(position.x * 3.0 - uTime * 7.0) * 0.16 * position.x;');
      };
      top.add(flag);
      group.add(top);
    }
  }

  // ===== BARNS in the fields round the farming towns (gen/farmland.js) =====
  {
    const kept = barns.filter((b) => free(b.x, b.z, 7));
    if (kept.length) {
      const walls = instanced(box(3.4, 2.4, 5.2, 0, 1.2, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }), kept.length, { cast: true });
      const roofs = instanced(new THREE.CylinderGeometry(0, 2.75, 1.9, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 1.5).translate(0, 3.3, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }), kept.length, { cast: true });
      kept.forEach((b, i) => {
        place(walls, i, b.x, b.y - 0.3, b.z, b.rot, 1.15 + b.tint * 0.5); place(roofs, i, b.x, b.y - 0.3, b.z, b.rot, 1.15 + b.tint * 0.5);
        walls.setColorAt(i, col.set(b.tint < 0.3 ? '#a8452f' : b.tint < 0.6 ? '#e9dfc8' : '#c9b08a'));
        roofs.setColorAt(i, col.set(b.tint < 0.3 ? '#4a4a4f' : '#8a4a35'));
        taken.push({ x: b.x, z: b.z, r: 6 }); claims.push({ x: b.x, z: b.z, r: 5 });
      });
    }
  }

  // ===== WHAT PEOPLE LEFT: each climate its own =====
  const stand = (geo, at, o = {}) => {
    const m = prop(geo, 0xffffff, { vertexColors: true, ...o });
    m.position.set(at.x, at.y, at.z);
    group.add(m);
    return m;
  };
  const inward = (at) => Math.atan2(-at.x, -at.z);                      // facing the middle of the island
  // WINDMILLS on the grasslands, their sails going round
  if (among('balanced', 'prairie', 'verdant', 'autumn', 'highlands')) {
    const at = spot([BIOME.PLAINS, BIOME.PLATEAU, BIOME.MOOR, BIOME.SAVANNA], { room: 30, level: 5, claim: true });
    if (at) {
      places.windmills = at;
      const body = parts([[drum(2.5, 1.6, 9.5), '#efe7d6'], [new THREE.ConeGeometry(2.0, 2.4, 8).translate(0, 10.7, 0), '#8f4a35'], [box(1.1, 2.0, 0.3, 0, 1.0, 2.36), '#5b4332'], [drum(0.28, 0.28, 2.2, 0, 0, 0, 6).rotateX(Math.PI / 2).translate(0, 9.6, 1.3), '#5b4332']]);
      const blades = [];
      for (let k = 0; k < 4; k++) {
        const turn = (g) => g.rotateZ(k * Math.PI / 2);
        blades.push([turn(box(0.26, 7.2, 0.2, 0, 3.9, 0)), '#6b4f33'], [turn(box(1.5, 5.4, 0.08, 0.86, 4.5, 0)), '#f1e9d6']);
      }
      const sails = parts(blades), heading = inward(at) + 0.5, mills = [];
      for (let i = 0; i < 3; i++) {
        const x = at.x + Math.cos(heading) * (i - 1) * 17 + (rand() - 0.5) * 5, z = at.z - Math.sin(heading) * (i - 1) * 17 + (rand() - 0.5) * 5;
        const mill = new THREE.Group();
        mill.position.set(x, levelGround(x, z, 5) - 0.4, z); mill.rotation.y = heading + (rand() - 0.5) * 0.3;
        mill.scale.setScalar(1.25 + rand() * 0.3);
        mill.add(prop(body, 0xffffff, { vertexColors: true }));
        const wheel = prop(sails, 0xffffff, { vertexColors: true, side: THREE.DoubleSide });
        wheel.position.set(0, 9.6, 2.5); mill.add(wheel);
        mills.push({ wheel, speed: 0.5 + rand() * 0.25, p: rand() * 6.28 });
        rises(mill.position, 11, 24);
        group.add(mill);
      }
      updaters.push((t) => { for (const m of mills) m.wheel.rotation.z = m.p + t * m.speed; });
    }
  }
  // a CASTLE on the best hill it could find: half of it still stands
  if (among('balanced', 'highlands', 'autumn', 'alpine', 'boreal', 'verdant')) {
    const at = spot([BIOME.HILLS, BIOME.MOOR, BIOME.PLATEAU, BIOME.FOREST, BIOME.TAIGA], { room: 26, level: 9, minY: 16, maxY: 80, of: 6, claim: true, where: (x, z) => field.massifAt(x, z) < 0.3 });
    if (at) {
      at.y = levelGround(at.x, at.z, 17);
      places.castle = at; rises(at, 21, 26);
      const STONE = '#aaa392', DARK = '#8d8778', SLATE = '#56637a', list = [];
      for (const [x, z, ry, len, h] of [[0, 12, 0, 24, 5], [-12, 0, Math.PI / 2, 24, 5], [0, -12, 0, 9, 3.2], [8.5, -12, 0, 6, 5], [12, 4, Math.PI / 2, 15, 5]]) list.push([box(len, h, 1.5, x, h / 2, z, ry), STONE]);
      for (const [x, z, h, roofed] of [[12, 12, 9.5, 1], [-12, 12, 9.5, 1], [-12, -12, 8, 1], [12, -12, 5.2, 0]]) {
        list.push([drum(2.8, 2.5, h, x, 0, z), DARK]);
        if (roofed) list.push([new THREE.ConeGeometry(3.1, 4, 8).translate(x, h + 2, z), SLATE]);
      }
      list.push([box(8.5, 14, 8.5, 2, 7, 1), STONE], [box(9.4, 1.1, 9.4, 2, 14.3, 1), DARK], [box(3, 3.6, 0.5, 0, 1.8, 12.6), '#4b3c2e']);
      for (let k = 0; k < 8; k++) list.push([box(1.5, 1.3, 1.5, 2 + Math.cos(k * Math.PI / 4) * 4.2, 15.4, 1 + Math.sin(k * Math.PI / 4) * 4.2), STONE]);
      for (let k = 0; k < 7; k++) list.push([box(1.2 + rand() * 1.6, 0.8 + rand() * 1.2, 1.2 + rand() * 1.4, 4 + rand() * 9, 0.5, -13 - rand() * 4, rand()), DARK]);    // what fell
      list.push([drum(0.09, 0.09, 6.5, 2, 15.5, 1, 4), '#3a3d42']);
      const castle = stand(parts(list), { x: at.x, y: at.y - 0.4, z: at.z });
      castle.rotation.y = inward(at);
      const flag = prop(new THREE.PlaneGeometry(3.2, 1.6, 6, 1).translate(1.6, 0, 0), 0xc8a13a, { side: THREE.DoubleSide });
      flag.castShadow = false; flag.position.set(2, 21, 1);
      flag.material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = weather.uTime;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.z += sin(position.x * 2.4 - uTime * 6.0) * 0.2 * position.x;');
      };
      castle.add(flag);
    }
  }
  // PYRAMIDS in the desert: three, and the stumps of lesser ones
  if (among('arid', 'balanced', 'prairie')) {
    const at = spot([BIOME.DESERT], { room: 58, level: 12, claim: true });
    if (at) {
      at.y = levelGround(at.x, at.z, 40);
      places.pyramids = at; rises(at, 44, 34);
      const SAND = '#dfc48c', list = [];
      for (const [x, z, r, h] of [[-4, -6, 27, 31], [30, 10, 20, 23], [-32, 16, 13, 15], [14, 34, 5, 5.5], [24, 37, 4, 4.5], [-12, 36, 4.5, 5]]) list.push([new THREE.ConeGeometry(r, h, 4, 1).rotateY(Math.PI / 4).translate(x, h / 2, z), SAND]);
      list.push([new THREE.ConeGeometry(3.4, 4, 4, 1).rotateY(Math.PI / 4).translate(-4, 29.2, -6), '#f0dfae']);        // the capstone still on the great one
      stand(parts(list), { x: at.x, y: at.y - 0.5, z: at.z }).rotation.y = rand() * 6.28;
    }
  }
  // a TEMPLE the jungle has almost taken back
  if (among('tropical', 'verdant')) {
    const at = spot([BIOME.JUNGLE, BIOME.FOREST], { room: 24, level: 6, maxR: 640, claim: true });
    if (at) {
      at.y = levelGround(at.x, at.z, 16);
      claims[claims.length - 1].r = 17;                                 // the trees stand right against it
      places.temple = at; rises(at, 18, 27);
      const list = [];
      for (let i = 0; i < 5; i++) list.push([box(27 - i * 4.6, 3.2, 27 - i * 4.6, 0, 1.6 + i * 3.2, 0), i % 2 ? '#7f8c6c' : '#8e907f']);
      list.push([box(5, 1, 20.4, 0, 0, 0).rotateX(0.9).translate(0, 8.3, 10.9), '#a09c88']);                             // the stair, from the ground to the shrine
      list.push([box(5.6, 4.4, 5.6, 0, 18.2, 0), '#8e907f'], [box(7.2, 0.9, 7.2, 0, 20.8, 0), '#6f7a5e'], [new THREE.ConeGeometry(1.3, 2.6, 4).translate(0, 22.5, 0), '#d8b24a']);
      for (let k = 0; k < 9; k++) {                                     // moss and creepers on the steps
        const tier = (rand() * 4) | 0, half = (27 - tier * 4.6) / 2, a = rand() < 0.5 ? 1 : -1;
        list.push([new THREE.IcosahedronGeometry(1.5 + rand() * 1.4, 0).scale(1, 0.5, 1).translate((rand() - 0.5) * half * 1.6, 3.4 + tier * 3.2, a * half * (0.7 + rand() * 0.25)), '#4f8a4a']);
      }
      stand(parts(list), { x: at.x, y: at.y - 0.4, z: at.z }).rotation.y = inward(at);
    }
  }
  // STONE HEADS in a row on a shore, their backs to the sea
  if (!islands && among('tropical', 'prairie', 'arid', 'balanced')) {
    const at = spot([BIOME.BEACH, BIOME.PLAINS, BIOME.SAVANNA], { room: 16, level: 3, maxR: 900, minY: 1.6, maxY: 14, claim: true, where: (x, z) => { const r = Math.hypot(x, z); return field.heightAt(x * (r + 70) / r, z * (r + 70) / r) < 0; } });
    if (at) {
      at.y = levelGround(at.x, at.z, 10);
      places.moai = at; rises(at, 15, 13);
      const ROCK = '#9a9486', SHADE = '#5d584f', list = [[box(19, 1.3, 5, 0, 0.65, 0), '#7a7468']];
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 3.6, k = 0.85 + rand() * 0.4, lean = (rand() - 0.5) * 0.08;
        // shoulders, the long head, a heavy brow over hollow eyes, the nose, the chin
        const head = [[box(1.9, 2.4, 1.4, 0, 2.4, 0), ROCK], [box(1.5, 2.9, 1.7, 0, 5.0, 0.1), ROCK], [box(1.8, 0.5, 0.75, 0, 5.95, 0.85), ROCK],
          [box(1.3, 0.5, 0.2, 0, 5.45, 0.9), SHADE], [box(0.5, 1.5, 0.75, 0, 4.85, 1.05), ROCK], [box(1.0, 0.45, 0.5, 0, 3.8, 0.95), ROCK], [box(0.9, 0.14, 0.2, 0, 4.2, 0.98), SHADE]];
        for (const [g, tone] of head) list.push([g.scale(k, k, k).rotateZ(lean).translate(x, 0.5, 0), tone]);
        if (i % 2 === 0) list.push([drum(0.95, 0.95, 1.0, 0, 6.45, 0.1, 7).scale(k, k, k).translate(x, 0.5, 0), '#a8563c']);  // a red topknot
      }
      const row = stand(parts(list), { x: at.x, y: at.y - 0.4, z: at.z });
      row.rotation.y = inward(at); row.scale.setScalar(1.6);
    }
  }
  // an ARCH of red rock the wind cut
  if (among('arid', 'prairie', 'highlands', 'balanced')) {
    const at = spot([BIOME.DESERT, BIOME.SAVANNA, BIOME.MESA, BIOME.MOOR], { room: 22, level: 7, claim: true });
    if (at) {
      places.arch = at; rises(at, 18, 28);
      const RED = among('highlands') ? '#8d8778' : '#c27a4c', DEEP = among('highlands') ? '#77736a' : '#a9623c';
      const rock = (sx, sy, sz, x, y, z, rz = 0) => new THREE.DodecahedronGeometry(1, 0).scale(sx, sy, sz).rotateZ(rz).translate(x, y, z);
      const list = [[rock(4.4, 12, 5, -9.5, 9, 0, 0.1), RED], [rock(5, 13.5, 4.6, 9.5, 10, 0.5, -0.08), DEEP], [rock(14.5, 3.4, 4.4, 0, 21.5, 0.2, 0.05), RED], [rock(5, 3, 4, -13, 2, 3), DEEP], [rock(3, 2, 3, 14, 1.4, -4), RED]];
      stand(parts(list), { x: at.x, y: at.y - 1.2, z: at.z }).rotation.y = inward(at) + (rand() - 0.5) * 0.8;
    }
  }

  return { group, claims, places, tall, update(t, dt) { for (const u of updaters) u(t, dt); } };
}
