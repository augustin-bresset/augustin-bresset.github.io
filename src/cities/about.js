// about.js — Augustin: a "ville du vent" (city of wind). Wooden towers and rope
// bridges around a small CLIMBING CLIFF (escalade — one of his real hobbies),
// with flying wood-and-canvas contraptions drifting overhead: gliders, a little
// airship, kites and windmills. Warm wood + cream canvas, Miyazaki-ish. A mini-map
// portal returns you to the overview.
import * as THREE from 'three';
import { box, cyl, platform, glow, makeLabel, makePortal, tagPickable, sprawl } from './kit.js';

const WOOD = 0x7a5230, DWOOD = 0x5c3d20, CANVAS = 0xeadfc6, CANVAS2 = 0xe4cfa0;
const RUST = 0xc4763a, ROPE = 0xb8a274, ROCK = 0x9a8d78, LEAF = 0x6b9a47, WARM = 0xffd98a;

// a flying glider: wooden fuselage + canvas wings + tail
function makeGlider() {
  const f = new THREE.Group();
  f.add(box(0.45, 0.4, 3.0, DWOOD, { pos: [0, 0, 0] }));
  const wl = box(5.4, 0.12, 1.7, CANVAS, { pos: [-2.8, 0.35, 0.2] }); wl.rotation.z = 0.14; f.add(wl);
  const wr = box(5.4, 0.12, 1.7, CANVAS, { pos: [2.8, 0.35, 0.2] }); wr.rotation.z = -0.14; f.add(wr);
  // canvas tail
  f.add(box(1.9, 0.1, 0.9, CANVAS2, { pos: [0, 0.2, -1.45] }));
  f.add(box(0.1, 0.9, 0.8, CANVAS2, { pos: [0, 0.55, -1.45] }));
  // a thin mast + strut
  f.add(cyl(0.05, 0.05, 0.9, WOOD, 5, { pos: [0, 0.45, 0.4] }));
  return f;
}

// a small airship: canvas envelope + wooden gondola + fins
function makeAirship() {
  const a = new THREE.Group();
  const env = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10),
    new THREE.MeshStandardMaterial({ color: CANVAS, flatShading: true, roughness: 1 }));
  env.scale.set(1, 0.82, 1.95); env.position.y = 0.7; env.castShadow = true; a.add(env);
  // rust stripe
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(2.18, 0.12, 6, 18),
    new THREE.MeshStandardMaterial({ color: RUST, flatShading: true, roughness: 1 }));
  stripe.rotation.y = Math.PI / 2; stripe.scale.set(1, 1.95, 0.82); stripe.position.y = 0.7; a.add(stripe);
  // gondola
  a.add(box(1.5, 0.7, 2.4, WOOD, { pos: [0, -1.5, 0] }));
  // tail fins
  a.add(box(0.1, 1.4, 1.2, CANVAS2, { pos: [0, 0.7, -3.6] }));
  a.add(box(1.6, 0.1, 1.0, CANVAS2, { pos: [0, 0.7, -3.6] }));
  return a;
}

// a diamond kite with a bow tail (rides a tether)
function makeKite() {
  const k = new THREE.Group();
  const d = box(1.5, 1.5, 0.05, CANVAS2, {}); d.rotation.z = Math.PI / 4; k.add(d);
  const cross = box(2.0, 0.06, 0.07, WOOD, {}); cross.rotation.z = Math.PI / 4; k.add(cross);
  for (let i = 0; i < 4; i++) k.add(box(0.22, 0.22, 0.04, i % 2 ? RUST : LEAF, { pos: [0, -1.1 - i * 0.5, 0], cast: false }));
  return k;
}

// a wooden lattice wind-tower with a platform and a canvas sail
function makeTower(h) {
  const t = new THREE.Group();
  // four legs
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const leg = cyl(0.16, 0.22, h, WOOD, 5, { pos: [x, h / 2, z] });
    leg.rotation.x = (z) * 0.04; leg.rotation.z = (-x) * 0.04; t.add(leg);
  }
  // cross braces
  for (let y = 2; y < h; y += 2.4) {
    t.add(box(2.4, 0.1, 0.1, DWOOD, { pos: [0, y, 1], cast: false }));
    t.add(box(2.4, 0.1, 0.1, DWOOD, { pos: [0, y, -1], cast: false }));
    t.add(box(0.1, 0.1, 2.4, DWOOD, { pos: [1, y, 0], cast: false }));
    t.add(box(0.1, 0.1, 2.4, DWOOD, { pos: [-1, y, 0], cast: false }));
  }
  // platform + rail
  t.add(box(3.4, 0.3, 3.4, WOOD, { pos: [0, h, 0] }));
  for (const [x, z, w, d] of [[0, 1.7, 3.4, 0.1], [0, -1.7, 3.4, 0.1], [1.7, 0, 0.1, 3.4], [-1.7, 0, 0.1, 3.4]])
    t.add(box(w, 0.7, d, DWOOD, { pos: [x, h + 0.5, z], cast: false }));
  return t;
}

export function build() {
  const g = new THREE.Group();

  g.add(platform(44, 0xb6a07e));
  // a sparse warm hamlet at the base
  g.add(sprawl({ rInner: 15, rOuter: 42, count: 40, seed: 44,
    colors: [0xcdbf9c, 0xb89a6e, 0x9a8468, 0x7a5230, 0xd8c9a8],
    lit: { color: WARM, p: 0.4 }, maxH: 7 }));

  // ===== the climbing cliff (escalade) — a central craggy landmark =====
  const cliff = new THREE.Group(); cliff.position.set(-9, 0, -2); g.add(cliff);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xa3937b, flatShading: true, roughness: 1 });
  const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x8c7e69, flatShading: true, roughness: 1 });
  // main tower + buttresses + an overhang slab → a rocky, non-boxy silhouette
  const chunks = [[8, 17, 6, 0, 8.5, 0, 0.0, rockMat], [4.5, 11, 4, -4, 5.5, 1.5, 0.2, rockMat2],
    [4, 8, 5, 3.5, 4, -1.5, -0.15, rockMat2], [5, 4, 5, 1.5, 14.5, 1, 0.3, rockMat2]];
  for (const [w, h, d, x, y, z, rot, mat] of chunks) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = (x + z) * 0.05; m.rotation.z = rot * 0.18;
    m.castShadow = true; m.receiveShadow = true; cliff.add(m);
  }
  // a pointed rocky peak so it reads as a crag, not a building
  const peak = new THREE.Mesh(new THREE.ConeGeometry(3.2, 5, 6), rockMat);
  peak.position.set(0.5, 18.5, 0.3); peak.rotation.y = 0.4; peak.castShadow = true; cliff.add(peak);

  // colourful climbing holds dotted up TWO faces (+x and +z) so a route always shows
  const holdCols = [0xd9534f, 0x4a90d9, 0xe6b800, 0x57a957];
  for (let i = 0; i < 12; i++) {
    const hy = 2.2 + Math.floor(i / 2) * 1.5;
    // +z face (face at z = +3)
    cliff.add(box(0.42, 0.42, 0.42, holdCols[i % 4], { pos: [-2.6 + (i % 4) * 1.5, hy, 3.15], cast: false }));
    // +x face (face at x = +4)
    cliff.add(box(0.42, 0.42, 0.42, holdCols[(i + 2) % 4], { pos: [4.15, hy + 0.6, -2.0 + (i % 4) * 1.4], cast: false }));
  }
  // a belay rope down the +z face
  const rope = cyl(0.05, 0.05, 14, ROPE, 4, { pos: [0.6, 9, 3.25] }); cliff.add(rope);
  // a tiny climber on the +z face (body + pack + helmet)
  const climber = new THREE.Group(); climber.position.set(0.4, 8, 3.4); cliff.add(climber);
  climber.add(box(0.5, 0.85, 0.32, 0x3a5f8a, { pos: [0, 0, 0] }));
  climber.add(box(0.52, 0.5, 0.26, RUST, { pos: [0, 0.55, -0.05] }));
  climber.add(box(0.34, 0.34, 0.34, 0xe7d8bd, { pos: [0, 1.0, 0] }));
  // summit banner
  const banner = box(0.08, 1.8, 0.08, WOOD, { pos: [0.5, 21.5, 0.3] }); cliff.add(banner);
  const flagTop = box(0.06, 1.1, 1.7, RUST, { pos: [0.5, 21.9, 1.1] }); cliff.add(flagTop);

  // ===== wooden wind-towers + a rope bridge =====
  const towers = [[10, 6, 18], [16, -7, 14], [2, 13, 16]];
  const builtTowers = [];
  for (const [x, z, h] of towers) {
    const t = makeTower(h); t.position.set(x, 0, z); g.add(t); builtTowers.push({ x, z, h });
    // a canvas sail on top catching the wind
    const sail = box(0.1, 3.0, 2.6, CANVAS, { pos: [0, h + 2, 0] });
    sail.rotation.x = 0.18; t.add(sail);
  }
  // a sagging rope bridge between the first two towers
  (function bridge() {
    const a = builtTowers[0], b = builtTowers[1];
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ang = Math.atan2(b.z - a.z, b.x - a.x);
    const deck = box(len, 0.18, 1.4, DWOOD, { pos: [mx, (a.h + b.h) / 2 - 1.2, mz], cast: false });
    deck.rotation.y = -ang; g.add(deck);
    for (const s of [0.7, -0.7]) {
      const rail = box(len, 0.08, 0.08, ROPE, { pos: [mx, (a.h + b.h) / 2 - 0.5, mz + s], cast: false });
      rail.rotation.y = -ang; g.add(rail);
    }
  })();

  // ===== flying wood-and-canvas contraptions (animated, kept low enough to frame) =====
  const flyers = [];
  const g1 = makeGlider(); g.add(g1); flyers.push({ o: g1, cx: 0, cz: 0, r: 16, y: 17, sp: 0.3, ph: 0, bob: 1.2, bank: 0.25 });
  const g2 = makeGlider(); g.add(g2); flyers.push({ o: g2, cx: 3, cz: -2, r: 22, y: 21, sp: -0.22, ph: 2.1, bob: 1.6, bank: 0.3 });
  const air = makeAirship(); g.add(air); flyers.push({ o: air, cx: -2, cz: 3, r: 15, y: 24, sp: 0.13, ph: 1.0, bob: 1.0, bank: 0 });
  const kites = [];
  for (const [tx, ty, tz, r, sp, ph] of [[10, 12, 6, 4, 1.1, 0], [2, 11, 13, 3.6, -0.9, 1.5]]) {
    const k = makeKite(); g.add(k);
    // tether line from a tower platform up to the kite
    const tether = cyl(0.03, 0.03, 8, ROPE, 4, {}); tether.position.set(tx, ty + 3, tz); g.add(tether);
    kites.push({ o: k, tx, ty, tz, r, sp, ph, tether });
  }

  // ===== ground windmills / pinwheels =====
  const spinners = [];
  for (const [x, z, h, col] of [[-6, 8, 6, CANVAS], [8, -2, 5, CANVAS2], [-10, -4, 5.5, CANVAS]]) {
    const post = cyl(0.18, 0.28, h, WOOD, 6, { pos: [x, h / 2, z] }); g.add(post);
    const hub = new THREE.Group(); hub.position.set(x, h, z + 0.35); g.add(hub);
    for (let i = 0; i < 4; i++) {
      const blade = box(0.08, 1.9, 0.6, col, { pos: [0, 1.0, 0], cast: false });
      blade.rotation.z = i * Math.PI / 2; hub.add(blade);
    }
    hub.add(box(0.3, 0.3, 0.3, RUST, { cast: false }));
    spinners.push({ hub, sp: 1.0 + Math.random() * 1.4 });
  }

  // ===== portal back to the map =====
  const portal = makePortal('#c4763a');
  portal.group.position.set(13, 0, 11); g.add(portal.group);

  const label = makeLabel('Augustin', 'The Inventor', '#c4763a');
  label.sprite.position.set(0, 38, 0); g.add(label.sprite);

  tagPickable(g, 'about');

  return {
    group: g, label,
    update(t, dt) {
      portal.update(t);
      for (const f of flyers) {
        const a = t * f.sp + f.ph;
        f.o.position.set(f.cx + Math.cos(a) * f.r, f.y + Math.sin(t * 0.5 + f.ph) * f.bob, f.cz + Math.sin(a) * f.r);
        // face direction of travel + a little banking
        f.o.rotation.y = -a + Math.PI / 2;
        f.o.rotation.z = Math.sin(a) * f.bank;
      }
      for (const k of kites) {
        const a = t * k.sp + k.ph;
        const kx = k.tx + Math.cos(a) * k.r, kz = k.tz + Math.sin(a) * k.r * 0.5;
        const ky = k.ty + 5 + Math.sin(a * 1.3) * 1.4;
        k.o.position.set(kx, ky, kz);
        k.o.rotation.set(Math.sin(t + k.ph) * 0.3, a, Math.cos(t * 1.2 + k.ph) * 0.4);
        // stretch the tether to follow the kite
        const bx = k.tx, by = k.ty, bz = k.tz;
        const dx = kx - bx, dy = ky - by, dz = kz - bz;
        const len = Math.hypot(dx, dy, dz);
        k.tether.position.set((bx + kx) / 2, (by + ky) / 2, (bz + kz) / 2);
        k.tether.scale.y = len / 8;
        k.tether.rotation.z = Math.atan2(dx, dy);
        k.tether.rotation.x = -Math.atan2(dz, dy);
      }
      for (const s of spinners) s.hub.rotation.z = t * s.sp;
      // banner + climber gentle sway
      flagTop.rotation.x = Math.sin(t * 3) * 0.18;
      climber.position.y = 8 + Math.sin(t * 0.6) * 0.4;
    },
  };
}
