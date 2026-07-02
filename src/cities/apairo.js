// apairo.js — Apairo: Augustin's FLAGSHIP — an open-source, numpy-native ecosystem
// that unifies heterogeneous robotics datasets behind one lazy, composable API.
//
// "THE HUB & THE TOAST": apairo is NOT a straight assembly line, so neither is the
// city. Raw data arrives from the west — quay, EXTRACT demux, the four-lane
// multi-rate road — and passes BETWEEN the two toasting reservoir-towers (the logo:
// two worlds of data raised in a toast, guarding the STORAGE district where the
// freight racks up at the arrival). The road ends at the centre: THE SYNCHRONIZER,
// a purpose-built armillary clock whose rings flare on every reference tick. From
// it, ONE RING ROAD distributes synchronized frames to the satellites all around —
// PREPROCESS foundry south, SPLIT·JOIN·CACHE works north, VISUALIZE + the TRAIN
// terminal east — and since transform is used EVERYWHERE, the TRANSFORM lenses
// live on the ring itself: the connective tissue every exchange passes through.
// ALL data roads are ELEVATED VIADUCTS on pylons — the network flies clear of the
// ground it crosses. Ghost wireframes hover over the freight ("views, not copies").
//
// COLOUR = DATA STATE: charcoal = materialized/heavy; ochre = EXCLUSIVELY
// data-in-motion + the reference clock; steel = contracts & laziness; four muted
// per-sensor hues track a channel end-to-end; dropped frames grey out — honestly.
import * as THREE from 'three';
import { box, cyl, glow, strip, wireBox, pointCloud, makeLabel, makeWallPortal, poiBeacon, tagPOI, tagPickable } from './kit.js';
import { Simplex, clamp } from '../gen/noise.js';

const PAPER = 0xd8d2c2, CHAR = 0x3a4a5e, DARK = 0x28323e;
const OCHRE = 0xdda42a, STEEL = 0x6b7a88, STEEL_L = 0x93a0ab, DROP = 0x5b6472;
const LANES = [
  { key: 'lidar',  z: -10,  hue: 0x44aa99, pitch: 9.0, speed: 0.85 },
  { key: 'camera', z: -3.5, hue: 0x88ccee, pitch: 3.6, speed: 1.1 },
  { key: 'imu',    z:  3.5, hue: 0xcc6677, pitch: 1.8, speed: 1.35 },
  { key: 'pose',   z:  10,  hue: 0x57a957, pitch: 6.0, speed: 0.95 },
];
const RING_R = 34;                // the transform ring road
const TRACK_Y = 3.4;              // ELEVATED viaduct deck height (clear of the ground)
const TOK_Y = TRACK_Y + 0.85;     // tokens ride on top of the deck
const CYCLE = 12;                 // seconds per Sample run (the master phase)

const lerp = (a, b, t) => a + (b - a) * t;
const win = (p, t0, t1) => clamp((p - t0) / (t1 - t0), 0, 1);

export function build() {
  const g = new THREE.Group();
  const sim = new Simplex(11);
  const pylonMat = new THREE.MeshStandardMaterial({ color: STEEL, flatShading: true, roughness: 0.75 });
  const pylonGeo = new THREE.CylinderGeometry(0.28, 0.42, TRACK_Y, 6);
  const addPylon = (x, z) => {
    const py = new THREE.Mesh(pylonGeo, pylonMat);
    py.position.set(x, TRACK_Y / 2, z); py.castShadow = false;
    g.add(py);
  };

  // ===== the ELEVATED data roads: intake viaduct, the ring, three spurs =========
  // (no platform — the terrain is tinted paper under the city; the network flies)
  g.add(box(66, 0.5, 4.2, DARK, { pos: [-45, TRACK_Y, 0], receive: false, cast: true }));
  const inStrip = strip(64, OCHRE, 0.18, 0.7);
  inStrip.position.set(-45, TRACK_Y + 0.32, 0); g.add(inStrip);
  for (let x = -74; x <= -20; x += 9) { addPylon(x, -1.6); addPylon(x, 1.6); }
  // the ring road (transform layer): elevated torus bed + ochre thread
  const ringBed = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 1.5, 4, 64),
    new THREE.MeshStandardMaterial({ color: DARK, flatShading: true, roughness: 0.85, emissive: DARK, emissiveIntensity: 0.15 }));
  ringBed.rotation.x = -Math.PI / 2; ringBed.position.y = TRACK_Y;
  ringBed.castShadow = true; g.add(ringBed);
  const ringLine = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.14, 4, 72),
    new THREE.MeshStandardMaterial({ color: OCHRE, emissive: OCHRE, emissiveIntensity: 0.7 }));
  ringLine.rotation.x = -Math.PI / 2; ringLine.position.y = TRACK_Y + 0.32;
  g.add(ringLine);
  for (let i = 0; i < 12; i++) {
    const A = (i / 12) * Math.PI * 2;
    addPylon(Math.cos(A) * RING_R, Math.sin(A) * RING_R);
  }
  // spurs: north (works), south (foundry), east (visualize + train)
  for (const [x, z, len, vert] of [[0, 40, 14, 1], [0, -40, 14, 1], [46, 0, 26, 0]]) {
    g.add(box(vert ? 2 : len, 0.5, vert ? len : 2, DARK, { pos: [x, TRACK_Y, z], receive: false, cast: true }));
    const st = strip(len - 1, OCHRE, 0.14, 0.5);
    if (vert) st.rotation.y = Math.PI / 2;
    st.position.set(x, TRACK_Y + 0.32, z);
    g.add(st);
    if (vert) { addPylon(x, z - len * 0.25); addPylon(x, z + len * 0.25); }
    else { addPylon(x - len * 0.25, z); addPylon(x + len * 0.25, z); }
  }

  // ===== 01 · the intake QUAY (west rim, overhanging) ===========================
  const quay = new THREE.Group(); g.add(quay); tagPOI(quay, 'conveyor');
  for (let i = 0; i < 5; i++) quay.add(cyl(0.34, 0.45, TRACK_Y + 1, STEEL, 6, { pos: [-84 - i * 3.4, (TRACK_Y + 1) / 2, 0] }));
  quay.add(box(20, 0.5, 4.6, DARK, { pos: [-90, TRACK_Y + 0.6, 0], cast: false, receive: false }));
  for (const dz of [-3.2, 3.2]) quay.add(box(0.7, 24, 0.7, STEEL, { pos: [-78, 12, dz] }));
  quay.add(box(0.8, 0.8, 8.2, STEEL, { pos: [-78, 24, 0] }));
  const cable = box(0.12, 12, 0.12, STEEL_L, { pos: [-78, 17, 0], cast: false });
  quay.add(cable);
  for (const [x, z, n] of [[-71, -6, 4], [-71, 6, 3], [-75, -5.2, 2]]) {
    for (let k = 0; k < n; k++) {
      quay.add(cyl(1.3, 1.3, 1.7, DARK, 10, {
        pos: [x + (k % 2) * 0.6, 0.9 + k * 1.8, z], roughness: 0.7,
        emissive: DARK, emissiveIntensity: 0.14,
      }));
    }
  }

  // ===== 02 · EXTRACT — the demux hall (the viaduct threads it) =================
  const demux = box(10, 9, 16, CHAR, { pos: [-62, 4.5, 0], roughness: 0.7, emissive: CHAR, emissiveIntensity: 0.2 });
  g.add(demux); tagPOI(demux, 'extract');
  g.add(box(10.8, 0.7, 16.8, DARK, { pos: [-62, 9.35, 0] }));
  LANES.forEach((L) => {
    g.add(box(1.1, 1.4, 1.4, L.hue, { pos: [-56.4, TRACK_Y + 0.7, L.z * 0.45], emissive: L.hue, emissiveIntensity: 0.5, cast: false }));
  });

  // ===== THE STORAGE GATEWAY — the two toasting reservoir-towers (the logo) =====
  // The databases stand AT THE ARRIVAL, flanking the road: every stream drives in
  // between the two raised glasses. Charcoal = the raw world, ochre = the unified
  // one. The freight of the storage district racks up around their feet.
  const toast = new THREE.Group(); g.add(toast); tagPOI(toast, 'hall');
  const towerMats = {
    char: new THREE.MeshStandardMaterial({ color: CHAR, flatShading: true, roughness: 0.6, emissive: CHAR, emissiveIntensity: 0.16 }),
    ochre: new THREE.MeshStandardMaterial({ color: OCHRE, flatShading: true, roughness: 0.55, emissive: OCHRE, emissiveIntensity: 0.22 }),
  };
  const TOWER_X = -38, TOWER_DZ = 21;
  const makeTower = (mat, zPos, lean) => {
    const tw = new THREE.Group();
    tw.position.set(TOWER_X, 0, zPos);
    tw.rotation.x = lean;                       // lean toward the road between them
    let y = 0;
    for (let d = 0; d < 5; d++) {
      const flareUp = d === 4 ? 1.4 : 0;        // the glass rim opens outward
      const r = 7.2 - d * 0.32;
      const h = 10;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(r + flareUp, r, h, 20), mat);
      drum.position.y = y + h / 2; drum.castShadow = true; drum.receiveShadow = true;
      tw.add(drum);
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.8 + flareUp, r + 0.8 + flareUp, 0.65, 20), mat);
      flange.position.y = y + h + 0.33; flange.castShadow = true;
      tw.add(flange);
      y += h + 0.65;
    }
    toast.add(tw);
    return tw;
  };
  makeTower(towerMats.char, -TOWER_DZ, 0.15);
  makeTower(towerMats.ochre, TOWER_DZ, -0.15);
  // the light water-spray above the clinking rims — champagne mist, barely there
  const droplets = [];
  const dropGeo = new THREE.SphereGeometry(0.32, 6, 5);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(dropGeo,
      new THREE.MeshBasicMaterial({ color: 0xd8ecf4, transparent: true, opacity: 0 }));
    m.castShadow = false;
    g.add(m);
    const a = (i / 14) * Math.PI * 2;
    droplets.push({
      m, ph: (i * 0.37) % 1,
      vx: Math.cos(a) * (2.0 + (i % 3) * 0.9),
      vz: Math.sin(a) * (1.8 + (i % 4) * 0.8),
      vy: 3.4 + (i % 5) * 0.7,
    });
  }

  // ===== the LANE FAN — the loved road to synchronization (elevated) ============
  const laneFan = new THREE.Group(); g.add(laneFan); tagPOI(laneFan, 'conveyor');
  const laneTicks = [];
  const tickBase = new THREE.MeshStandardMaterial({ color: STEEL, flatShading: true, roughness: 0.7 });
  LANES.forEach((L) => {
    for (const [x0, z0, x1, z1] of [[-56, L.z * 0.45, -48, L.z], [-24, L.z, -17, L.z * 0.2]]) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const c = box(len, 0.4, 1.2, DARK, { cast: true, receive: false });
      c.position.set((x0 + x1) / 2, TRACK_Y, (z0 + z1) / 2);
      c.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      laneFan.add(c);
    }
    laneFan.add(box(24, 0.4, 1.2, DARK, { pos: [-36, TRACK_Y, L.z], cast: true, receive: false }));
    for (let x = -46; x <= -26; x += 10) addPylon(x, L.z);
    const capMat = new THREE.MeshStandardMaterial({ color: L.hue, emissive: L.hue, emissiveIntensity: 0.5, flatShading: true });
    for (let x = -47; x <= -25; x += L.pitch) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 1.7), tickBase);
      tick.position.set(x, TRACK_Y + 0.26, L.z); tick.castShadow = false; laneFan.add(tick);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.45), capMat);
      cap.position.set(x, TRACK_Y + 0.34, L.z + 0.8); cap.castShadow = false; laneFan.add(cap);
    }
    laneTicks.push({ mat: capMat, lane: L });
  });

  // ===== 03 · THE SYNCHRONIZER — an armillary clock at the exact centre =========
  // A purpose-built machine, not a tower: three great steel rings spinning on
  // different axes around an ochre heart, over the 44-tick encoder wheel. On every
  // reference tick the rings flare — all streams brought onto one time.
  const sync = new THREE.Group(); g.add(sync); tagPOI(sync, 'conveyor');
  sync.add(cyl(1.1, 1.6, 26, STEEL, 10, { pos: [0, 13, 0], metalness: 0.35, roughness: 0.45 }));
  sync.add(cyl(5, 6.5, 1.6, DARK, 16, { pos: [0, 0.8, 0], emissive: DARK, emissiveIntensity: 0.15 }));
  const heart = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10),
    new THREE.MeshStandardMaterial({ color: OCHRE, emissive: OCHRE, emissiveIntensity: 1.1, flatShading: true }));
  heart.position.y = 20; sync.add(heart);
  const armRings = [];
  [[11, 0.42], [8.2, 0.36], [5.6, 0.3]].forEach(([r, tube], i) => {
    const holder = new THREE.Group(); holder.position.y = 20; sync.add(holder);
    holder.rotation.set(i * 0.7, i * 1.1, i * 0.35);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 40),
      new THREE.MeshStandardMaterial({ color: STEEL_L, flatShading: true, roughness: 0.4, metalness: 0.4, emissive: STEEL_L, emissiveIntensity: 0.25 }));
    holder.add(ring);
    armRings.push({ holder, ring, sp: 0.25 + i * 0.18, axis: i % 2 ? 'x' : 'y' });
  });
  // the 44-tick encoder wheel at its feet — THE reference clock
  const encoder = new THREE.Group(); encoder.position.set(0, 0.6, 0); g.add(encoder);
  const tickGeo = new THREE.BoxGeometry(0.36, 0.8, 1.2);
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    const tk = new THREE.Mesh(tickGeo, tickBase);
    tk.position.set(Math.cos(a) * 14, 0, Math.sin(a) * 14);
    tk.rotation.y = -a; tk.castShadow = false;
    encoder.add(tk);
  }

  // ===== TRANSFORM — the lenses live ON THE RING: used by everything ============
  const lenses = [];
  [30, 90, 150, 210, 270, 330].forEach((deg, i) => {
    const A = (deg * Math.PI) / 180;
    const holder = new THREE.Group();
    holder.position.set(Math.cos(A) * RING_R, TRACK_Y + 1.6, Math.sin(A) * RING_R);
    holder.rotation.y = -A;                     // lens plane ⊥ the ring tangent
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.24, 8, 26),
      new THREE.MeshStandardMaterial({ color: STEEL, flatShading: true, roughness: 0.4, metalness: 0.35, emissive: STEEL, emissiveIntensity: 0.25 }));
    holder.add(ring);
    g.add(holder);
    lenses.push({ holder, ring, A, dir: i % 2 ? -1 : 1 });
  });
  tagPOI(lenses[0].holder, 'transform');

  // ===== 04 · PREPROCESS (south spur) — foundry + .apairo sidecar silos =========
  const foundry = new THREE.Group(); g.add(foundry); tagPOI(foundry, 'preprocess');
  foundry.add(box(15, 16, 11, CHAR, { pos: [0, 8, -52], roughness: 0.7, emissive: CHAR, emissiveIntensity: 0.2 }));
  foundry.add(box(16, 0.9, 12, DARK, { pos: [0, 16.5, -52] }));
  for (const dx of [-3.8, 3.8]) {
    foundry.add(cyl(1.3, 1.6, 7.5, DARK, 10, { pos: [dx, 20.2, -53], emissive: DARK, emissiveIntensity: 0.2 }));
  }
  foundry.add(box(4.2, 6, 0.4, OCHRE, { pos: [0, 4.2, -46.3], emissive: OCHRE, emissiveIntensity: 0.5, cast: false }));
  const press = box(2.4, 1.6, 2.4, STEEL, { pos: [0, TRACK_Y + 2.4, -42.7], metalness: 0.3, roughness: 0.5 });
  for (const dz of [-41, -44.5]) foundry.add(box(0.7, 9, 0.7, CHAR, { pos: [0, 4.5, dz], emissive: CHAR, emissiveIntensity: 0.2 }));
  foundry.add(box(0.9, 0.9, 4.6, CHAR, { pos: [0, 9, -42.7], emissive: CHAR, emissiveIntensity: 0.2 }));
  foundry.add(press);
  const gauges = [];
  for (let i = 0; i < 5; i++) {
    const x = -9 + i * 4.5;
    foundry.add(cyl(2.6, 2.6, 13, CHAR, 14, { pos: [x, 6.5, -64], roughness: 0.55, metalness: 0.2, emissive: CHAR, emissiveIntensity: 0.2 }));
    foundry.add(cyl(2.6, 0.65, 2, STEEL, 14, { pos: [x, 14, -64] }));
    const gauge = glow(1.1, 8, OCHRE, 0.9);
    gauge.position.set(x, 5.2, -61.3);
    foundry.add(gauge); gauges.push(gauge);
  }

  // ===== 05 · SPLIT · JOIN · CACHE (north spur) — the dataset works =============
  const works = new THREE.Group(); g.add(works); tagPOI(works, 'silos');
  for (const dx of [-5.6, 5.6]) {
    works.add(box(8, 14, 9, CHAR, { pos: [dx, 7, 52], roughness: 0.7, emissive: CHAR, emissiveIntensity: 0.2 }));
    works.add(box(8.7, 0.8, 9.7, DARK, { pos: [dx, 14.4, 52] }));
  }
  const joinBridge = box(6, 3, 6.5, DARK, { pos: [0, 12.4, 52], emissive: DARK, emissiveIntensity: 0.2 });
  works.add(joinBridge);
  works.add(box(6, 0.5, 6.9, OCHRE, { pos: [0, 14.2, 52], emissive: OCHRE, emissiveIntensity: 0.4, cast: false }));
  for (let i = 0; i < 3; i++) {
    works.add(cyl(1.6, 1.6, 4 + i * 1.1, DARK, 10, { pos: [-13, 2.2 + i * 0.55, 45 + i * 4], emissive: DARK, emissiveIntensity: 0.2 }));
  }
  for (const s of [1, -1]) {
    const br = box(8, 0.3, 0.7, STEEL_L, { cast: false, receive: false });
    br.position.set(s * 4, TRACK_Y + 0.1, 43);
    br.rotation.y = s * 0.5;
    works.add(br);
  }

  // ===== 06 · VISUALIZE — the rr observatory bridging the east spur =============
  const obs = new THREE.Group(); obs.position.set(46, 0, 0); g.add(obs); tagPOI(obs, 'visualize');
  for (const dz of [-6.5, 6.5]) {
    obs.add(box(4.4, 15, 5.5, CHAR, { pos: [0, 7.5, dz], roughness: 0.7, emissive: CHAR, emissiveIntensity: 0.2 }));
  }
  obs.add(box(4.8, 3, 10.4, DARK, { pos: [0, 16.4, 0], emissive: DARK, emissiveIntensity: 0.2 }));
  const obsScreen = glow(3.4, 2.1, 0x88ccee, 0.9);
  obsScreen.position.set(-2.45, 16.4, 0); obsScreen.rotation.y = -Math.PI / 2;
  obs.add(obsScreen);
  obs.add(cyl(2, 2.4, 1.8, STEEL, 12, { pos: [0, 18.8, 4.2], metalness: 0.3, roughness: 0.4 }));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: STEEL_L, flatShading: true, roughness: 0.4, metalness: 0.3 }));
  dome.position.set(0, 19.7, 4.2); obs.add(dome);
  const cloudGrey = pointCloud([{ cx: 0, cz: 0, color: 0x8a8f96, n: 52, spread: 2.6, y: 0 }], { size: 0.24 });
  cloudGrey.position.set(46, 9, 0); g.add(cloudGrey);
  const cloudLbl = pointCloud(LANES.map((L, i) => ({
    cx: Math.cos(i * 1.57) * 1.3, cz: Math.sin(i * 1.57) * 1.3, color: L.hue, n: 15, spread: 1.5, y: 0 })), { size: 0.24 });
  cloudLbl.position.set(46, 9, 0); g.add(cloudLbl);
  const lblMats = [];
  cloudLbl.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = 0; lblMats.push(o.material); } });
  const greyMats = [];
  cloudGrey.traverse((o) => { if (o.material) { o.material.transparent = true; greyMats.push(o.material); } });

  // ===== 07 · the TRAIN terminal + the apéro terrace (east end) =================
  const lab = new THREE.Group(); g.add(lab); tagPOI(lab, 'pier');
  lab.add(box(14, 13, 12, CHAR, { pos: [60, 6.5, 0], roughness: 0.7, emissive: CHAR, emissiveIntensity: 0.2 }));
  lab.add(box(15, 0.9, 13, DARK, { pos: [60, 13.5, 0] }));
  const furnace = glow(4.4, 3.6, OCHRE, 0.8);
  furnace.position.set(52.9, TRACK_Y + 1.3, 0); furnace.rotation.y = -Math.PI / 2;
  lab.add(furnace);
  const lossTicks = [];
  for (let i = 0; i < 5; i++) {
    const lt = glow(0.75, 0.75, OCHRE, 0.5);
    lt.position.set(52.9, 8 + i * 1, 3.2); lt.rotation.y = -Math.PI / 2;
    lab.add(lt); lossTicks.push(lt);
  }
  const terrace = new THREE.Group(); terrace.position.set(54, 0, -13); terrace.scale.setScalar(1.3);
  g.add(terrace); tagPOI(terrace, 'pier');
  terrace.add(cyl(3.4, 3.6, 0.3, PAPER, 14, { pos: [0, 0.15, 0], receive: true, cast: false }));
  terrace.add(cyl(0.1, 0.12, 3, 0x9a8468, 6, { pos: [0, 1.5, 0] }));
  const parasol = cyl(0.1, 2.9, 1.3, 0xcf6b4a, 10, { pos: [0, 3.1, 0] });
  parasol.castShadow = true; terrace.add(parasol);
  terrace.add(cyl(1.15, 1.15, 0.18, 0xf0ece3, 12, { pos: [0, 1.0, 0] }));
  const glassL = cyl(0.16, 0.1, 0.55, CHAR, 8, { pos: [-0.45, 1.35, 0.1], emissive: CHAR, emissiveIntensity: 0.2 });
  const glassR = cyl(0.16, 0.1, 0.55, OCHRE, 8, { pos: [0.45, 1.35, -0.1], emissive: OCHRE, emissiveIntensity: 0.4 });
  glassL.rotation.z = 0.18; glassR.rotation.z = -0.18;
  terrace.add(glassL); terrace.add(glassR);
  for (const [dx, dz] of [[1.6, 0.6], [-1.6, -0.6]]) terrace.add(box(0.5, 0.85, 0.5, OCHRE, { pos: [dx, 0.42, dz], cast: false }));

  // ===== THE STORAGE — freight racked around the towers, where data ARRIVES =====
  const cells = [];
  for (const zRow of [-42, -37, -32, -27, -22, -16, 16, 22, 27, 32, 37, 42]) {
    for (let x = -74; x <= -16; x += 4.4) {
      if (Math.hypot(x + 45, zRow) > 55) continue;
      if (Math.hypot(x - TOWER_X, Math.abs(zRow) - TOWER_DZ) < 11 && Math.abs(zRow) > 9) continue; // tower plazas
      const occ = 0.5 + 0.5 * sim.fbm(x * 0.06, zRow * 0.06, { octaves: 3 });
      if (occ < 0.4) continue;
      const h = 2.6 + occ * 6.5;
      cells.push({ x, z: zRow, h, v: sim.noise2D(x * 0.15, zRow * 0.15) });
    }
  }
  for (const zRow of [-26, -21, 21, 26]) {
    for (let x = 16; x <= 46; x += 4.4) {
      const occ = 0.5 + 0.5 * sim.fbm(x * 0.06, zRow * 0.06, { octaves: 3 });
      if (occ < 0.52) continue;
      const h = 2.2 + occ * 4.5;
      cells.push({ x, z: zRow, h, v: sim.noise2D(x * 0.15, zRow * 0.15) });
    }
  }
  const whGeo = new THREE.BoxGeometry(3.4, 1, 3.4);
  const wh = new THREE.InstancedMesh(whGeo,
    new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.75, emissive: CHAR, emissiveIntensity: 0.2 }),
    cells.length);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
  const _c = new THREE.Color(), _char = new THREE.Color(CHAR);
  cells.forEach((c, i) => {
    _m.compose(_v.set(c.x, c.h / 2, c.z), _q, _s.set(1, c.h, 1));
    wh.setMatrixAt(i, _m);
    _c.copy(_char).offsetHSL(0, 0, c.v * 0.03);
    wh.setColorAt(i, _c);
  });
  wh.castShadow = true; wh.receiveShadow = true;
  g.add(wh);
  const ghostMat = new THREE.LineBasicMaterial({ color: STEEL_L, transparent: true, opacity: 0.55, depthWrite: false });
  const ghostEdges = new THREE.EdgesGeometry(whGeo);
  const ghosts = [];
  cells.forEach((c, i) => {
    if (i % 4 !== 0) return;
    const gh = new THREE.LineSegments(ghostEdges, ghostMat);
    gh.position.set(c.x, c.h + 5, c.z);
    gh.scale.set(1, c.h * 0.8, 1);
    g.add(gh); ghosts.push({ gh, baseY: c.h + 5, ph: i * 0.7 });
  });

  // ===== the VIEW LOT — a district that exists only as an index ================
  const lot = wireBox(13, 6, 13, STEEL_L, { opacity: 0.5, fill: false });
  lot.position.set(-16, 3, 50); g.add(lot);

  // the hidden WALL PORTAL — an ochre-rimmed service door on the FAR side of the
  // lab terminal (you find it walking around the end of the line)
  const portal = makeWallPortal('#dda42a');
  portal.group.position.set(67.1, 0, 0);
  portal.group.rotation.y = Math.PI / 2;        // faces east, away from the city
  lab.add(portal.group);

  // ===== the travelling Sample — the datum is the protagonist ==================
  const bag = cyl(1.2, 1.2, 1.7, DARK, 10, { emissive: DARK, emissiveIntensity: 0.2 });
  g.add(bag);
  const tokens = LANES.map((L) => {
    const tk = new THREE.Group();
    tk.add(box(1.1, 0.75, 1.1, DARK, { emissive: DARK, emissiveIntensity: 0.2, cast: false }));
    tk.add(box(1.1, 0.22, 1.1, L.hue, { pos: [0, 0.5, 0], emissive: L.hue, emissiveIntensity: 0.8, cast: false }));
    g.add(tk);
    const mats = []; tk.traverse((o) => { if (o.material) { o.material.transparent = true; mats.push(o.material); } });
    return { tk, mats, lane: L };
  });
  const frameTok = box(1.7, 0.95, 1.7, OCHRE, { emissive: OCHRE, emissiveIntensity: 1.4, cast: false });
  frameTok.material.transparent = true; g.add(frameTok);
  const slab = box(1.9, 0.55, 1.5, OCHRE, { emissive: OCHRE, emissiveIntensity: 0.9, cast: false });
  slab.material.transparent = true; g.add(slab);

  // ===== POI gems (one per brick, notes + GitHub links in content.js) ===========
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); g.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('hall', '#dda42a', TOWER_X, 62, 0);
  addBeacon('extract', '#93a0ab', -62, 15, 0);
  addBeacon('conveyor', '#88ccee', 0, 36, 0);          // over the synchronizer
  addBeacon('transform', '#6b7a88', Math.cos(Math.PI / 6) * RING_R, 14, Math.sin(Math.PI / 6) * RING_R);
  addBeacon('preprocess', '#dda42a', 0, 26, -52);
  addBeacon('silos', '#dda42a', 0, 22, 52);
  addBeacon('visualize', '#88ccee', 46, 25, 0);
  addBeacon('pier', '#cf6b4a', 58, 18, -8);

  const label = makeLabel('Apairo', 'Robotics Data', '#9a6f12');
  label.sprite.position.set(0, 76, 0); g.add(label.sprite);

  tagPickable(g, 'apairo');

  return {
    group: g, label,
    // dive-in framing: the hub in one perspective — towers west, ring centre,
    // satellites all around
    frame: { target: [-6, 14, 0], azimuth: 0.5, polar: 55, radius: 170 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);

      const cyc = Math.floor(t / CYCLE);
      const p = (t % CYCLE) / CYCLE;
      const dropRun = cyc % 4 === 3;
      const dest = cyc % 3;                     // 0 → train, 1 → works, 2 → foundry

      // the armillary never stops; the encoder wheel turns at the reference rate
      encoder.rotation.y = t * 0.3;
      for (const ar of armRings) ar.holder.rotation[ar.axis] += 0.01 * ar.sp;
      for (const lt of laneTicks) {
        lt.mat.emissiveIntensity = 0.35 + Math.max(0, Math.sin(t * (10 / lt.lane.pitch))) * 0.6;
      }
      for (const gh of ghosts) gh.gh.position.y = gh.baseY + Math.sin(t * 0.9 + gh.ph) * 0.4;

      // — 0.00-0.16 · the crane lowers a bag onto the viaduct, into the demux
      const pIn = win(p, 0, 0.16);
      bag.visible = pIn < 1;
      if (bag.visible) {
        const drop_ = win(p, 0, 0.08), slide = win(p, 0.08, 0.16);
        bag.position.set(lerp(-78, -62, slide), lerp(16, TOK_Y + 0.3, drop_), 0);
        cable.scale.y = 1 - drop_ * 0.8;
        cable.position.y = 23 - (12 * (1 - drop_ * 0.8)) / 2;
      }

      // — 0.16-0.5 · four channel tokens ride the viaduct BETWEEN the toasting towers
      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i], L = tok.lane;
        const isDrop = dropRun && L.key === 'imu';
        const pr = win(p, 0.16, 0.16 + 0.34 / L.speed);
        tok.tk.visible = p >= 0.16 && p < 0.5;
        if (!tok.tk.visible) continue;
        const x = lerp(-56.4, -16, pr);
        const z = pr < 0.15 ? lerp(L.z * 0.45, L.z, pr / 0.15)
          : pr > 0.82 ? lerp(L.z, L.z * 0.2, (pr - 0.82) / 0.18) : L.z;
        tok.tk.position.set(x, TOK_Y, z);
        const fade = isDrop ? 1 - win(p, 0.36, 0.48) : 1;
        for (const m of tok.mats) m.opacity = fade;
        if (isDrop && p > 0.36) tok.tk.children[1].material.color.set(DROP);
        else tok.tk.children[1].material.color.set(L.hue);
      }

      // — 0.5 · THE TICK: at the armillary, all rings flare — one synchronized frame
      const clink = p > 0.495 && p < 0.56;
      heart.material.emissiveIntensity = clink ? 2.2 : 0.9 + Math.sin(t * 1.6) * 0.25;
      for (const ar of armRings) ar.ring.material.emissiveIntensity = clink ? 0.9 : 0.25;
      const sprayBoost = clink ? 1.7 : 1;
      for (const dr of droplets) {
        const f = (t * 0.45 + dr.ph) % 1;
        dr.m.position.set(TOWER_X + dr.vx * f * 2.4, 54 + dr.vy * f * 2.2 - 7.5 * f * f, dr.vz * f * 2.4);
        dr.m.material.opacity = Math.max(0, 0.34 * (1 - f) * sprayBoost - 0.04);
        dr.m.scale.setScalar(1 - f * 0.5);
      }

      // — 0.5-1.0 · the unified frame leaves the centre, rides the elevated RING
      // through the transform lenses, and peels off to a DIFFERENT satellite each
      // cycle: the hub distributing, not a assembly line
      frameTok.visible = p >= 0.5;
      if (frameTok.visible) {
        const out = win(p, 0.5, 0.95);
        let x = 0, z = 0;
        if (dest === 0) {
          x = lerp(0, 53, out); z = 0;
        } else {
          const dir = dest === 1 ? 1 : -1;      // north = works, south = foundry
          if (out < 0.3) { x = lerp(0, RING_R, out / 0.3); z = 0; }
          else if (out < 0.75) {
            const A = ((out - 0.3) / 0.45) * (Math.PI / 2);
            x = Math.cos(A) * RING_R; z = Math.sin(A) * RING_R * dir;
          } else {
            x = 0; z = dir * lerp(RING_R, 46, (out - 0.75) / 0.25);
          }
        }
        frameTok.position.set(x, TOK_Y, z);
        frameTok.material.opacity = 1 - win(p, 0.93, 0.98);
        // ring lenses glint as the frame passes them (transform, everywhere)
        let squeeze = 1;
        for (const l of lenses) {
          const near = Math.hypot(x - Math.cos(l.A) * RING_R, z - Math.sin(l.A) * RING_R);
          if (near < 4) {
            squeeze = 0.72 + (near / 4) * 0.28;
            l.ring.material.emissiveIntensity = 0.9;
          } else if (Math.abs(l.ring.material.emissiveIntensity - 0.25) > 0.01) {
            l.ring.material.emissiveIntensity += (0.25 - l.ring.material.emissiveIntensity) * 0.1;
          }
        }
        frameTok.scale.set(1, squeeze, 1);
        // east run: the observatory colorizes the cloud; arrival fires the furnace
        if (dest === 0) {
          const nearObs = Math.max(0, 1 - Math.abs(x - 46) / 7);
          for (const m of lblMats) m.opacity = nearObs;
          for (const m of greyMats) m.opacity = 1 - nearObs * 0.85;
          const arrive = win(p, 0.88, 0.95);
          furnace.material.emissiveIntensity = 0.5 + arrive * 1.4;
          for (let i = 0; i < lossTicks.length; i++) {
            lossTicks[i].material.emissiveIntensity = 0.3 + (arrive > (i + 1) / 6 ? 0.9 : 0);
          }
          glassL.rotation.z = 0.18 + arrive * 0.12;
          glassR.rotation.z = -0.18 - arrive * 0.12;
        }
      }

      // — deliveries: the foundry stamps on its runs; the works' join-bridge glows
      const stamp = dest === 2 ? Math.max(0, Math.sin(win(p, 0.88, 0.99) * Math.PI)) : 0;
      press.position.y = TRACK_Y + 2.4 - stamp * 2.2;
      slab.visible = dest === 2 && p > 0.9;
      if (slab.visible) {
        const sl = win(p, 0.9, 0.99);
        slab.position.set(lerp(0, -9 + (cyc % 5) * 4.5, sl), lerp(TOK_Y, 2, sl), lerp(-42.7, -61.4, sl));
        slab.material.opacity = 1 - win(p, 0.97, 1);
      }
      joinBridge.material.emissiveIntensity = 0.15 + (dest === 1 ? Math.max(0, Math.sin(win(p, 0.88, 1) * Math.PI)) * 0.5 : 0);
      for (let i = 0; i < gauges.length; i++) {
        const filled = (cyc % 5) >= i || cyc > 5;
        gauges[i].material.emissiveIntensity = (filled ? 0.7 : 0.15) + (clink ? 0.3 : 0);
      }
    },
  };
}
