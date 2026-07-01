// about.js — Augustin: a "ville du vent" (city of wind). Wooden towers and rope
// bridges around a small CLIMBING CLIFF (escalade — one of his real hobbies),
// with flying wood-and-canvas contraptions drifting overhead: gliders, a little
// airship, kites and windmills. Warm wood + cream canvas, Miyazaki-ish. A mini-map
// portal returns you to the overview.
import * as THREE from 'three';
import { box, cyl, platform, glow, makeLabel, makePortal, poiBeacon, tagPOI, tagPickable, sprawl } from './kit.js';

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

// a little campus building — a schoolhouse (hip roof), with an optional dome (a
// grande-école nod) or a modern flat-roof block (an office). An accent flag + a
// front sign tie it to the field note it opens. Warm wood + cream, diorama-scale.
function makeSchool(accent, style = 'house') {
  const s = new THREE.Group();
  const ac = new THREE.Color(accent);
  // bright walls so the campus reads apart from the warm sprawl
  const WALL = style === 'office' ? 0xe6dfcf : 0xf3ecda;
  const bodyH = style === 'office' ? 7.5 : 4.6;
  s.add(box(5, bodyH, 4.4, WALL, { pos: [0, bodyH / 2, 0], roughness: 0.82 }));
  s.add(box(5.4, 0.5, 4.9, 0xb89a6e, { pos: [0, 0.25, 0] }));         // stone base

  if (style === 'office') {
    const slab = ac.clone().lerp(new THREE.Color(0x39434f), 0.4).getHex();
    s.add(box(5.2, 0.5, 4.6, slab, { pos: [0, bodyH + 0.25, 0] }));   // flat roof slab
    for (let i = 0; i < 3; i++)                                        // glass bands
      s.add(box(4.6, 0.7, 0.12, 0xbfe3e8, { pos: [0, 1.7 + i * 2.1, 2.22], emissive: 0xbfe3e8, emissiveIntensity: 0.55, cast: false }));
    s.add(box(0.5, 0.5, 0.5, accent, { pos: [2, bodyH + 0.8, -1.8], emissive: accent, emissiveIntensity: 1.6, cast: false })); // roof beacon
  } else {
    // accent-tinted hip roof → instantly tells the schools apart and colour-codes them
    const roofCol = ac.clone().lerp(new THREE.Color(0x5c3d20), 0.38).getHex();
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.0, 2.6, 4),
      new THREE.MeshStandardMaterial({ color: roofCol, flatShading: true, roughness: 0.9 }));
    roof.rotation.y = Math.PI / 4; roof.position.y = bodyH + 1.3; roof.castShadow = true; s.add(roof);
    if (style === 'dome') {                                            // a little cupola
      s.add(cyl(0.95, 1.15, 1.0, WALL, 12, { pos: [0, bodyH + 2.6, 0] }));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: ac, emissive: ac, emissiveIntensity: 0.35, flatShading: true, roughness: 0.5, metalness: 0.3 }));
      dome.position.y = bodyH + 3.1; s.add(dome);
    }
    // two warm windows on the +z face
    for (const dx of [-1.45, 1.45]) s.add(box(0.9, 1.05, 0.12, WARM, { pos: [dx, bodyH * 0.55, 2.22], emissive: WARM, emissiveIntensity: 0.7, cast: false }));
  }
  s.add(box(1.15, 1.95, 0.2, DWOOD, { pos: [0, 0.97, 2.22] }));       // door

  // front sign board on a post (accent) — a little campus placard
  s.add(cyl(0.1, 0.1, 2.3, WOOD, 5, { pos: [2.1, 1.15, 3.3] }));
  s.add(box(2.0, 1.0, 0.16, accent, { pos: [2.1, 2.3, 3.3], emissive: accent, emissiveIntensity: 0.5, cast: false }));
  // rooftop flag
  s.add(cyl(0.05, 0.05, 2.3, DWOOD, 4, { pos: [-2.0, bodyH + 1.1, 1.7] }));
  s.add(box(0.06, 0.85, 1.15, accent, { pos: [-2.0, bodyH + 1.6, 2.25], emissive: accent, emissiveIntensity: 0.5, cast: false }));
  return s;
}

// a wooden fingerpost — the "contact" landmark (Email / GitHub / LinkedIn)
function makeSignpost() {
  const s = new THREE.Group();
  s.add(cyl(0.2, 0.24, 6.5, WOOD, 6, { pos: [0, 3.25, 0] }));
  s.add(cyl(0.34, 0.34, 0.3, RUST, 8, { pos: [0, 6.5, 0] }));          // finial cap
  const arms = [[5.2, 0xc4763a, 0.4], [4.4, 0x3a7ca5, -0.7], [4.8, 0x6b9a47, -1.8]];
  for (const [y, col, rot] of arms) {
    const board = box(3.2, 0.7, 0.16, col, { pos: [1.5, y, 0], emissive: col, emissiveIntensity: 0.35 });
    const arm = new THREE.Group(); arm.position.y = 0; arm.add(board);
    arm.rotation.y = rot; s.add(arm);
  }
  return s;
}

export function build() {
  const g = new THREE.Group();

  g.add(platform(44, 0xb6a07e));
  // a sparse warm hamlet on the OUTER ring only, so the campus + towers read clearly
  g.add(sprawl({ rInner: 21, rOuter: 42, count: 24, seed: 44,
    colors: [0xcdbf9c, 0xb89a6e, 0x9a8468, 0x7a5230, 0xd8c9a8],
    lit: { color: WARM, p: 0.4 }, maxH: 6 }));

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

  // ===== the campus corner: the schools & jobs that built him =====
  // a paved plaza ties the four buildings together as one "campus"
  const plaza = box(30, 0.3, 11, 0xcabf9f, { pos: [-5, 0.16, -11], receive: true, cast: false });
  g.add(plaza);
  const campus = [
    ['polytechnique', '#b5402f', 'dome', -16, -9],
    ['telecom', '#3a7ca5', 'house', -9, -12],
    ['ensta', '#6b9a47', 'house', -1, -13.5],
    ['rubicon', '#d4a84b', 'office', 6, -11],
  ];
  for (const [id, accent, style, x, z] of campus) {
    const sc = makeSchool(accent, style);
    sc.position.set(x, 0.3, z);
    sc.rotation.y = Math.atan2(-x, -z);          // turn the door toward the centre
    g.add(sc); tagPOI(sc, id);
  }
  // the contact fingerpost
  const sign = makeSignpost(); sign.position.set(17, 0, 2); g.add(sign); tagPOI(sign, 'contact');

  // ===== floating markers over every readable landmark =====
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); g.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('polytechnique', '#b5402f', -16, 15, -9);
  addBeacon('telecom', '#3a7ca5', -9, 13, -12);
  addBeacon('ensta', '#6b9a47', -1, 13, -13.5);
  addBeacon('rubicon', '#d4a84b', 6, 15, -11);
  addBeacon('contact', '#8b6845', 17, 9.5, 2);

  // ===== portal back to the map =====
  const portal = makePortal('#c4763a');
  portal.group.position.set(13, 0, 11); g.add(portal.group);

  const label = makeLabel('Origin', 'The Inventor', '#c4763a');
  label.sprite.position.set(0, 38, 0); g.add(label.sprite);

  tagPickable(g, 'about');

  return {
    group: g, label,
    // dive-in framing: centre on the school campus (the -z corner) from its front,
    // raised 3/4, so the four colour-coded schools read clearly with the wind-city
    // rising behind them.
    frame: { target: [-4, 4, -10], azimuth: 3.3, polar: 56, radius: 56 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t, dt) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);
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
    },
  };
}
