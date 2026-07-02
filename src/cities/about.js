// about.js — Augustin: "L'ARBRE DE TRANSMISSION". A small inventor's town powered
// by the wind: the great windmill at the exact origin turns ONE wooden line shaft
// (the literal pre-electric "arbre de transmission") that winds through the whole
// village like its main street. Each chapter of his path is a workshop-station
// belted to the shaft — Télécom 2022, ENSTA 2024, Rubicon Bangkok 2025,
// Polytechnique 2025-26 — and a bright PULSE of power travels down the shaft,
// waking each invention as it arrives: time = distance along the shaft, and the
// wind (curiosity) powers everything he has built. At the end of the line stands
// the atelier, its gable pinned with the blueprint of the PROCHAINE INVENTION —
// wireframe, not yet built — with the portal at its foot.
// Warm wood + cream canvas, Miyazaki-ish; gliders, kites and pinwheels keep the
// air alive. ONE organizing rule: everything sits on (or flanks) the shaft path.
import * as THREE from 'three';
import { box, cyl, wireBox, pointCloud, makeLabel, makeWallPortal, poiBeacon, tagPOI, tagPickable } from './kit.js';

const WOOD = 0x7a5230, DWOOD = 0x5c3d20, CANVAS = 0xeadfc6, CANVAS2 = 0xe4cfa0;
const RUST = 0xc4763a, ROPE = 0xb8a274, LEAF = 0x6b9a47, WARM = 0xffd98a;
const BRASS = 0xc9a154;

// ---- the line-shaft path: a gentle outward arc from the windmill --------------
// angle sweeps ~197°, radius grows 9 → 38. Stations sit at fixed s; houses flank it.
const A0 = 2.35, SWEEP = 3.45, R0 = 9, R1 = 38;
const SHAFT_Y = 4.2;
function pathAt(s) {
  const a = A0 + SWEEP * s, r = R0 + (R1 - R0) * s;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, a };
}

// station order IS the chronology (content.js ids kept wired)
const STATIONS = [
  { id: 'telecom',       accent: '#3a7ca5', s: 0.16, style: 'house' },
  { id: 'ensta',         accent: '#6b9a47', s: 0.40, style: 'house' },
  { id: 'rubicon',       accent: '#d4a84b', s: 0.62, style: 'office' },
  { id: 'polytechnique', accent: '#b5402f', s: 0.84, style: 'dome' },
];

// ---- flying wood-and-canvas contraptions (unchanged town DNA) ------------------
function makeGlider() {
  const f = new THREE.Group();
  f.add(box(0.45, 0.4, 3.0, DWOOD, { pos: [0, 0, 0] }));
  const wl = box(5.4, 0.12, 1.7, CANVAS, { pos: [-2.8, 0.35, 0.2] }); wl.rotation.z = 0.14; f.add(wl);
  const wr = box(5.4, 0.12, 1.7, CANVAS, { pos: [2.8, 0.35, 0.2] }); wr.rotation.z = -0.14; f.add(wr);
  f.add(box(1.9, 0.1, 0.9, CANVAS2, { pos: [0, 0.2, -1.45] }));
  f.add(box(0.1, 0.9, 0.8, CANVAS2, { pos: [0, 0.55, -1.45] }));
  f.add(cyl(0.05, 0.05, 0.9, WOOD, 5, { pos: [0, 0.45, 0.4] }));
  return f;
}
function makeAirship() {
  const a = new THREE.Group();
  const env = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10),
    new THREE.MeshStandardMaterial({ color: CANVAS, flatShading: true, roughness: 1 }));
  env.scale.set(1, 0.82, 1.95); env.position.y = 0.7; env.castShadow = true; a.add(env);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(2.18, 0.12, 6, 18),
    new THREE.MeshStandardMaterial({ color: RUST, flatShading: true, roughness: 1 }));
  stripe.rotation.y = Math.PI / 2; stripe.scale.set(1, 1.95, 0.82); stripe.position.y = 0.7; a.add(stripe);
  a.add(box(1.5, 0.7, 2.4, WOOD, { pos: [0, -1.5, 0] }));
  a.add(box(0.1, 1.4, 1.2, CANVAS2, { pos: [0, 0.7, -3.6] }));
  a.add(box(1.6, 0.1, 1.0, CANVAS2, { pos: [0, 0.7, -3.6] }));
  return a;
}
function makeKite() {
  const k = new THREE.Group();
  const d = box(1.5, 1.5, 0.05, CANVAS2, {}); d.rotation.z = Math.PI / 4; k.add(d);
  const cross = box(2.0, 0.06, 0.07, WOOD, {}); cross.rotation.z = Math.PI / 4; k.add(cross);
  for (let i = 0; i < 4; i++) k.add(box(0.22, 0.22, 0.04, i % 2 ? RUST : LEAF, { pos: [0, -1.1 - i * 0.5, 0], cast: false }));
  return k;
}

// ---- the campus-house (chapter station building) — kept from the old town ------
function makeSchool(accent, style = 'house') {
  const s = new THREE.Group();
  const ac = new THREE.Color(accent);
  const WALL = style === 'office' ? 0xe6dfcf : 0xf3ecda;
  const bodyH = style === 'office' ? 7.5 : 4.6;
  s.add(box(5, bodyH, 4.4, WALL, { pos: [0, bodyH / 2, 0], roughness: 0.82 }));
  s.add(box(5.4, 0.5, 4.9, 0xb89a6e, { pos: [0, 0.25, 0] }));
  if (style === 'office') {
    const slab = ac.clone().lerp(new THREE.Color(0x39434f), 0.4).getHex();
    s.add(box(5.2, 0.5, 4.6, slab, { pos: [0, bodyH + 0.25, 0] }));
    for (let i = 0; i < 3; i++)
      s.add(box(4.6, 0.7, 0.12, 0xbfe3e8, { pos: [0, 1.7 + i * 2.1, 2.22], emissive: 0xbfe3e8, emissiveIntensity: 0.55, cast: false }));
  } else {
    const roofCol = ac.clone().lerp(new THREE.Color(0x5c3d20), 0.38).getHex();
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.0, 2.6, 4),
      new THREE.MeshStandardMaterial({ color: roofCol, flatShading: true, roughness: 0.9 }));
    roof.rotation.y = Math.PI / 4; roof.position.y = bodyH + 1.3; roof.castShadow = true; s.add(roof);
    if (style === 'dome') {
      s.add(cyl(0.95, 1.15, 1.0, WALL, 12, { pos: [0, bodyH + 2.6, 0] }));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: ac, emissive: ac, emissiveIntensity: 0.35, flatShading: true, roughness: 0.5, metalness: 0.3 }));
      dome.position.y = bodyH + 3.1; s.add(dome);
    }
    for (const dx of [-1.45, 1.45]) s.add(box(0.9, 1.05, 0.12, WARM, { pos: [dx, bodyH * 0.55, 2.22], emissive: WARM, emissiveIntensity: 0.7, cast: false }));
  }
  s.add(box(1.15, 1.95, 0.2, DWOOD, { pos: [0, 0.97, 2.22] }));
  // front sign board (accent) — flares when the power pulse arrives
  s.add(cyl(0.1, 0.1, 2.3, WOOD, 5, { pos: [2.1, 1.15, 3.3] }));
  const sign = box(2.0, 1.0, 0.16, accent, { pos: [2.1, 2.3, 3.3], emissive: accent, emissiveIntensity: 0.5, cast: false });
  s.add(sign);
  s.userData.sign = sign;
  return s;
}

// a simple village cottage flanking the shaft street (deterministic, no sprawl)
function makeCottage(w, h, d, wall, roofCol) {
  const c = new THREE.Group();
  c.add(box(w, h, d, wall, { pos: [0, h / 2, 0], roughness: 0.9 }));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.8, 4),
    new THREE.MeshStandardMaterial({ color: roofCol, flatShading: true, roughness: 0.9 }));
  roof.rotation.y = Math.PI / 4; roof.position.y = h + 0.9; roof.castShadow = true; c.add(roof);
  c.add(box(0.7, 1.2, 0.14, DWOOD, { pos: [0, 0.6, d / 2 + 0.02] }));
  c.add(box(0.7, 0.7, 0.1, WARM, { pos: [w * 0.28, h * 0.6, d / 2 + 0.02], emissive: WARM, emissiveIntensity: 0.6, cast: false }));
  return c;
}

// the "contact" fingerpost (Email / GitHub / LinkedIn)
function makeSignpost() {
  const s = new THREE.Group();
  s.add(cyl(0.2, 0.24, 6.5, WOOD, 6, { pos: [0, 3.25, 0] }));
  s.add(cyl(0.34, 0.34, 0.3, RUST, 8, { pos: [0, 6.5, 0] }));
  const arms = [[5.2, 0xc4763a, 0.4], [4.4, 0x3a7ca5, -0.7], [4.8, 0x6b9a47, -1.8]];
  for (const [y, col, rot] of arms) {
    const board = box(3.2, 0.7, 0.16, col, { pos: [1.5, y, 0], emissive: col, emissiveIntensity: 0.35 });
    const arm = new THREE.Group(); arm.add(board); arm.rotation.y = rot; s.add(arm);
  }
  return s;
}

// the blueprint pinned on the atelier gable: blueprint-blue canvas, white chalk
// linework sketching a contraption that doesn't exist yet, titled by hand.
function bakeBlueprintTex() {
  const w = 512, h = 360;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#33506b'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(230,240,248,0.28)'; ctx.lineWidth = 1;          // faint grid
  for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(240,246,252,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  // the mysterious machine: a wheel, a spring, a box, dashed flow arrows
  ctx.beginPath(); ctx.arc(150, 190, 58, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(150, 190, 20, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(150 + Math.cos(a) * 20, 190 + Math.sin(a) * 20);
    ctx.lineTo(150 + Math.cos(a) * 58, 190 + Math.sin(a) * 58); ctx.stroke();
  }
  ctx.strokeRect(300, 140, 130, 100);
  ctx.beginPath(); ctx.moveTo(300, 190); // a spring
  for (let i = 0; i <= 12; i++) ctx.lineTo(240 + i * 5, 190 + (i % 2 ? -14 : 14));
  ctx.stroke();
  ctx.setLineDash([8, 7]);
  ctx.beginPath(); ctx.moveTo(365, 140); ctx.lineTo(365, 88); ctx.lineTo(210, 88); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(240,246,252,0.95)';
  ctx.font = '600 44px Caveat, cursive'; ctx.textAlign = 'center';
  ctx.fillText('Prochaine invention', w / 2, 320);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function build() {
  const g = new THREE.Group();
  // no platform: the hillside itself is tinted warm sand under the village
  // (terrain.js fusion zone) and lightly flattened.

  // ===== HERO: the GREAT windmill at the exact origin ==========================
  const mill = new THREE.Group(); g.add(mill);
  mill.add(cyl(4.2, 5.6, 19, 0xd9cbb0, 12, { pos: [0, 9.5, 0], roughness: 0.9, flat: true }));
  mill.add(cyl(3.6, 4.8, 1.6, 0xb89a6e, 12, { pos: [0, 0.8, 0] }));            // stone base ring
  const cap = new THREE.Mesh(new THREE.ConeGeometry(5.0, 4.6, 12),
    new THREE.MeshStandardMaterial({ color: DWOOD, flatShading: true, roughness: 0.9 }));
  cap.position.y = 21.4; cap.castShadow = true; mill.add(cap);
  mill.add(box(1.5, 2.6, 0.24, DWOOD, { pos: [0, 1.3, 5.35] }));               // door
  // a wooden balcony ring partway up (the miller's walkway)
  mill.add(cyl(5.4, 5.4, 0.3, WOOD, 12, { pos: [0, 8.5, 0] }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    mill.add(box(0.14, 1.0, 0.14, DWOOD, { pos: [Math.cos(a) * 5.25, 9.1, Math.sin(a) * 5.25], cast: false }));
  }
  for (const dy of [6, 12.5]) mill.add(box(1.1, 1.3, 0.16, WARM, { pos: [0, dy, 5.0 - dy * 0.05], emissive: WARM, emissiveIntensity: 0.7, cast: false }));
  // the sail rotor — four grand canvas blades on a front-facing hub
  const rotor = new THREE.Group(); rotor.position.set(0, 18.6, 5.0); mill.add(rotor);
  rotor.add(cyl(0.7, 0.7, 1.6, DWOOD, 8, {}));
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.z = (i / 4) * Math.PI * 2; rotor.add(arm);
    arm.add(box(0.28, 13.5, 0.28, WOOD, { pos: [0, 6.75, 0] }));
    const sail = box(2.6, 11.5, 0.1, i % 2 ? CANVAS : CANVAS2, { pos: [1.45, 7.2, 0], cast: false });
    arm.add(sail);
  }
  rotor.rotation.x = 0.06;                                                      // slight tilt
  tagPOI(mill, 'contact');   // clicking the mill also opens "say hello" — the inventor's home

  // ===== THE LINE SHAFT — one wooden drive shaft winding through the town ======
  const SAMPLES = 56;
  const pts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = pathAt(i / SAMPLES);
    pts.push(new THREE.Vector3(p.x, SHAFT_Y, p.z));
  }
  const shaftMat = new THREE.MeshStandardMaterial({ color: WOOD, flatShading: true, roughness: 0.85 });
  const segGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 6);
  const _dir = new THREE.Vector3(), _mid = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < SAMPLES; i++) {
    const a = pts[i], b = pts[i + 1];
    _dir.subVectors(b, a);
    const len = _dir.length();
    const seg = new THREE.Mesh(segGeo, shaftMat);
    seg.scale.y = len * 1.06;
    _mid.addVectors(a, b).multiplyScalar(0.5);
    seg.position.copy(_mid);
    seg.quaternion.setFromUnitVectors(_up, _dir.normalize());
    seg.castShadow = false;
    g.add(seg);
  }
  // support posts + spinning knobbed flanges (they make the rotation VISIBLE)
  const flanges = [];
  for (let i = 3; i < SAMPLES; i += 6) {
    const p = pts[i];
    g.add(cyl(0.12, 0.18, SHAFT_Y, DWOOD, 5, { pos: [p.x, SHAFT_Y / 2, p.z] }));
    const holder = new THREE.Group();
    holder.position.copy(p);
    _dir.subVectors(pts[i + 1], pts[i]).normalize();
    holder.quaternion.setFromUnitVectors(_up, _dir);
    const flange = new THREE.Group();
    flange.add(cyl(0.42, 0.42, 0.14, BRASS, 8, { flat: true }));
    for (let k = 0; k < 3; k++) {
      const knob = box(0.16, 0.16, 0.16, DWOOD, { cast: false });
      const ka = (k / 3) * Math.PI * 2;
      knob.position.set(Math.cos(ka) * 0.4, 0, Math.sin(ka) * 0.4);
      flange.add(knob);
    }
    holder.add(flange);
    g.add(holder);
    flanges.push(flange);
  }
  // THE PULSE — the travelling charge of power (time itself moving down the line)
  const pulse = box(0.5, 0.5, 0.5, WARM, { emissive: WARM, emissiveIntensity: 2.4, cast: false });
  g.add(pulse);

  // ===== chapter stations belted to the shaft ===================================
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); g.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  const stations = [];
  for (const st of STATIONS) {
    const p = pathAt(st.s);
    // the building sits OUTSIDE the shaft street, door facing the shaft
    const off = 8.5;
    const ox = Math.cos(p.a) * (R0 + (R1 - R0) * st.s + off);
    const oz = Math.sin(p.a) * (R0 + (R1 - R0) * st.s + off);
    const school = makeSchool(st.accent, st.style);
    school.scale.setScalar(1.35);              // village-scale buildings, easy to read & click
    school.position.set(ox, 0.1, oz);
    school.rotation.y = Math.atan2(p.x - ox, p.z - oz);        // door toward the shaft
    g.add(school); tagPOI(school, st.id);

    // belt from the shaft down to a station wheel (two thin slats + a brass wheel)
    const wheel = new THREE.Group();
    wheel.position.set(p.x, 1.1, p.z);
    wheel.add(cyl(0.55, 0.55, 0.18, BRASS, 10, { flat: true }));
    wheel.rotation.x = Math.PI / 2;
    g.add(wheel);
    const beltCol = new THREE.Color(st.accent).lerp(new THREE.Color(DWOOD), 0.45).getHex();
    for (const s of [-0.28, 0.28]) {
      const belt = box(0.1, SHAFT_Y - 1.1, 0.05, beltCol, { cast: false });
      belt.position.set(p.x + s, (SHAFT_Y + 1.1) / 2, p.z);
      g.add(belt);
    }

    // the station MECHANISM — a themed little machine that wakes when the pulse hits
    const mech = new THREE.Group();
    mech.position.set(p.x, 0, p.z);
    let mechAnim = null;
    if (st.id === 'telecom') {                    // a signal mast pinging rings
      mech.add(cyl(0.1, 0.14, 4.6, WOOD, 5, { pos: [1.6, 2.3, 0] }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 18),
        new THREE.MeshStandardMaterial({ color: 0x3a7ca5, emissive: 0x3a7ca5, emissiveIntensity: 1.2, transparent: true }));
      ring.position.set(1.6, 4.8, 0); mech.add(ring);
      mechAnim = (t, on) => {
        const f = on ? (t * 0.8) % 1 : 0;
        ring.scale.setScalar(0.6 + f * 2.4);
        ring.material.opacity = on ? Math.max(0, 1 - f) : 0.25;
      };
    } else if (st.id === 'ensta') {               // a little lidar drum + point puff
      const drum = cyl(0.5, 0.6, 0.8, 0x445544, 10, { pos: [1.6, 2.6, 0], metalness: 0.3, roughness: 0.5 });
      mech.add(cyl(0.14, 0.2, 2.2, WOOD, 5, { pos: [1.6, 1.1, 0] }));
      mech.add(drum);
      const puff = pointCloud([{ cx: 0, cz: 0, color: 0x6b9a47, n: 16, spread: 1.0, y: 0 }], { size: 0.12 });
      puff.position.set(1.6, 3.6, 0); mech.add(puff);
      mechAnim = (t, on) => {
        drum.rotation.y = on ? t * 4 : t * 0.3;
        puff.scale.setScalar(on ? 1 + Math.sin(t * 3) * 0.25 : 0.7);
      };
    } else if (st.id === 'rubicon') {             // the crate hoist (ERP migration, box by box)
      mech.add(cyl(0.12, 0.12, 5.2, WOOD, 5, { pos: [1.7, 2.6, 0] }));
      mech.add(box(1.6, 0.14, 0.14, DWOOD, { pos: [1.0, 5.2, 0], cast: false }));
      const crate = box(0.9, 0.9, 0.9, 0xd4a84b, { emissive: 0x8a6a2a, emissiveIntensity: 0.25 });
      crate.position.set(1.0, 1.0, 0); mech.add(crate);
      mechAnim = (t, on) => {
        const f = on ? (Math.sin(t * 1.6) * 0.5 + 0.5) : 0.05;
        crate.position.y = 0.6 + f * 3.6;
      };
    } else {                                       // polytechnique: a small brass orrery
      mech.add(cyl(0.12, 0.16, 2.6, WOOD, 5, { pos: [1.6, 1.3, 0] }));
      const orr = new THREE.Group(); orr.position.set(1.6, 3.0, 0); mech.add(orr);
      orr.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
        new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.4, roughness: 0.4 })));
      const m1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0xb5402f, emissive: 0xb5402f, emissiveIntensity: 0.5 }));
      const m2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0x3a7ca5, emissive: 0x3a7ca5, emissiveIntensity: 0.5 }));
      orr.add(m1); orr.add(m2);
      mechAnim = (t, on) => {
        const sp = on ? 1.6 : 0.15;
        m1.position.set(Math.cos(t * sp) * 0.85, 0, Math.sin(t * sp) * 0.85);
        m2.position.set(Math.cos(-t * sp * 1.7 + 1) * 1.3, 0, Math.sin(-t * sp * 1.7 + 1) * 1.3);
      };
    }
    mech.rotation.y = p.a + Math.PI / 2;           // tuck the machine beside the street
    g.add(mech); tagPOI(mech, st.id);

    addBeacon(st.id, st.accent, ox, st.style === 'office' ? 17 : 14.5, oz);
    stations.push({ s: st.s, wheel, mechAnim, sign: school.userData.sign, accent: new THREE.Color(st.accent) });
  }

  // ===== the ATELIER at the end of the line + PROCHAINE INVENTION ==============
  const endP = pathAt(1);
  const atOff = 8;
  const ax = Math.cos(endP.a) * (R1 + atOff), az = Math.sin(endP.a) * (R1 + atOff);
  const atelier = new THREE.Group();
  atelier.position.set(ax, 0, az);
  atelier.scale.setScalar(1.35);              // the workshop is the village's BIG building
  atelier.rotation.y = Math.atan2(endP.x - ax, endP.z - az);     // gable faces the shaft
  // a tall workshop with a broad gable — big enough to carry the portal doorway
  atelier.add(box(12, 8, 9, 0xe9dcc2, { pos: [0, 4, 0], roughness: 0.85 }));
  const gable = new THREE.Mesh(new THREE.ConeGeometry(8.8, 4.4, 4),
    new THREE.MeshStandardMaterial({ color: 0x8a5a34, flatShading: true, roughness: 0.9 }));
  gable.rotation.y = Math.PI / 4; gable.position.y = 10.2; gable.castShadow = true;
  atelier.add(gable);
  // THE PORTAL — rectangular, flush on the façade: the atelier's great doorway IS
  // the way out. The blueprint of the next invention hangs right above it.
  const portal = makeWallPortal('#c4763a');
  portal.group.position.set(0, 0, 4.55);
  atelier.add(portal.group);
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.6),
    new THREE.MeshStandardMaterial({ map: bakeBlueprintTex(), emissive: 0x223a52, emissiveIntensity: 0.35, roughness: 0.9 }));
  bp.position.set(0, 6.5, 4.56);
  atelier.add(bp);
  // a faint wireframe of the machine floating just off the blueprint (hologram-sketch)
  const ghost = wireBox(1.5, 1.1, 0.9, 0xbfd8ea, { opacity: 0.5, fillOpacity: 0.04 });
  ghost.position.set(0, 6.5, 5.4);
  atelier.add(ghost);
  // two side windows so the workshop feels lived-in
  for (const dx of [-4.2, 4.2]) atelier.add(box(1.0, 1.2, 0.14, WARM, { pos: [dx, 4.4, 4.56], emissive: WARM, emissiveIntensity: 0.6, cast: false }));
  g.add(atelier);
  tagPOI(atelier, 'contact');

  // the contact fingerpost by the atelier door
  const sign = makeSignpost();
  const sx = ax + Math.sin(atelier.rotation.y) * 5.5, sz = az + Math.cos(atelier.rotation.y) * 5.5;
  sign.position.set(sx + 2.5, 0, sz); g.add(sign); tagPOI(sign, 'contact');
  addBeacon('contact', '#8b6845', ax, 19, az);

  // ===== the village: cottages flanking the shaft street (deterministic) ========
  const COTTAGES = [
    [0.07, -6.2, 2.8], [0.13, 6.6, 3.2], [0.22, -6.0, 2.6], [0.30, 6.4, 3.0],
    [0.36, -6.6, 2.7], [0.46, 6.8, 3.1], [0.52, -6.2, 2.6], [0.60, 6.6, 3.0],
    [0.68, -6.4, 2.8], [0.76, 6.2, 2.9], [0.82, -6.0, 2.6], [0.92, 6.8, 3.1],
  ];
  const cotWalls = [0xd8c9a8, 0xcdbf9c, 0xe0d4b8];
  COTTAGES.forEach(([s, off, ch], i) => {
    const p = pathAt(s);
    const r = R0 + (R1 - R0) * s + off;
    const cx = Math.cos(p.a) * r, cz = Math.sin(p.a) * r;
    const c = makeCottage(2.8 + (i % 3) * 0.5, ch, 2.6 + (i % 2) * 0.6,
      cotWalls[i % 3], i % 2 ? 0x8a5a34 : 0x6e4526);
    c.scale.setScalar(1.25);
    c.position.set(cx, 0.1, cz);
    c.rotation.y = Math.atan2(p.x - cx, p.z - cz);   // door toward the street
    g.add(c);
  });

  // the GRANARY — a bigger barn with a side silo, off the street's outer bend
  {
    const p = pathAt(0.44);
    const r = R0 + (R1 - R0) * 0.44 + 11;
    const bx = Math.cos(p.a) * r, bz = Math.sin(p.a) * r;
    const barn = new THREE.Group();
    barn.scale.setScalar(1.25);
    barn.position.set(bx, 0.1, bz);
    barn.rotation.y = Math.atan2(p.x - bx, p.z - bz);
    barn.add(box(6.5, 4.5, 5, 0xd2c1a0, { pos: [0, 2.25, 0], roughness: 0.9 }));
    const broof = new THREE.Mesh(new THREE.ConeGeometry(4.9, 2.8, 4),
      new THREE.MeshStandardMaterial({ color: 0x6e4526, flatShading: true, roughness: 0.9 }));
    broof.rotation.y = Math.PI / 4; broof.position.y = 5.9; broof.castShadow = true; barn.add(broof);
    barn.add(box(2.0, 2.8, 0.2, DWOOD, { pos: [0, 1.4, 2.55] }));
    barn.add(cyl(1.5, 1.5, 5.5, 0xcdbf9c, 10, { pos: [4.6, 2.75, -0.5] }));
    barn.add(cyl(1.5, 0.4, 1.2, 0x8a5a34, 10, { pos: [4.6, 6.1, -0.5] }));
    g.add(barn);
  }
  // STREET LIFE along the shaft road: warm lamps, barrel clusters, a hay cart —
  // the density that makes it a village, all placed ON the path rule (no scatter)
  [0.08, 0.24, 0.42, 0.58, 0.74, 0.90].forEach((s, i) => {
    const p = pathAt(s);
    const side = i % 2 ? 3.4 : -3.4;
    const r = R0 + (R1 - R0) * s + side;
    const lx = Math.cos(p.a) * r, lz = Math.sin(p.a) * r;
    g.add(cyl(0.09, 0.13, 3.6, DWOOD, 5, { pos: [lx, 1.8, lz] }));
    const lamp = box(0.5, 0.6, 0.5, WARM, { pos: [lx, 3.8, lz], emissive: WARM, emissiveIntensity: 1.1, cast: false });
    g.add(lamp);
  });
  [0.19, 0.45, 0.66, 0.87].forEach((s, i) => {
    const p = pathAt(s);
    const side = i % 2 ? -4.6 : 4.6;
    const r = R0 + (R1 - R0) * s + side;
    const bx = Math.cos(p.a) * r, bz = Math.sin(p.a) * r;
    for (let k = 0; k < 3; k++) {
      g.add(cyl(0.55, 0.6, 1.1, i % 2 ? 0x8a6f49 : 0x9a7a52, 8,
        { pos: [bx + (k % 2) * 1.2 - 0.5, 0.55 + (k > 1 ? 1.1 : 0), bz + (k === 1 ? 1.0 : 0)], roughness: 0.9 }));
    }
  });
  { // the hay cart resting by the granary bend
    const p = pathAt(0.5);
    const r = R0 + (R1 - R0) * 0.5 + 5.2;
    const hx = Math.cos(p.a) * r, hz = Math.sin(p.a) * r;
    const cart = new THREE.Group(); cart.position.set(hx, 0, hz); cart.rotation.y = p.a;
    cart.add(box(3.2, 0.3, 1.8, WOOD, { pos: [0, 0.9, 0] }));
    cart.add(box(2.6, 0.9, 1.4, 0xd8c176, { pos: [0, 1.5, 0], roughness: 1 }));
    for (const dx of [-1.1, 1.1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 6, 12),
        new THREE.MeshStandardMaterial({ color: DWOOD, flatShading: true, roughness: 0.9 }));
      wheel.position.set(dx, 0.55, 0.95); cart.add(wheel);
    }
    g.add(cart);
  }

  // the WELL on the mill plaza — the village's little heart
  {
    const wa = A0 - 0.7;
    const wx = Math.cos(wa) * 7.5, wz = Math.sin(wa) * 7.5;
    const well = new THREE.Group(); well.position.set(wx, 0, wz);
    well.add(cyl(1.3, 1.5, 1.1, 0xa39172, 10, { pos: [0, 0.55, 0], roughness: 0.95 }));
    for (const dx of [-1.1, 1.1]) well.add(cyl(0.09, 0.11, 2.4, WOOD, 5, { pos: [dx, 1.9, 0] }));
    const wroof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a5a34, flatShading: true, roughness: 0.9 }));
    wroof.rotation.y = Math.PI / 4; wroof.position.y = 3.5; wroof.castShadow = true; well.add(wroof);
    well.add(cyl(0.05, 0.05, 1.4, ROPE, 4, { pos: [0, 2.3, 0], cast: false }));
    well.add(box(0.5, 0.5, 0.5, WOOD, { pos: [0, 1.5, 0], cast: false }));
    g.add(well);
  }

  // ===== air life: gliders, the airship, tethered kites, pinwheels ==============
  const flyers = [];
  const g1 = makeGlider(); g.add(g1); flyers.push({ o: g1, cx: 0, cz: 0, r: 17, y: 19, sp: 0.3, ph: 0, bob: 1.2, bank: 0.25 });
  const g2 = makeGlider(); g.add(g2); flyers.push({ o: g2, cx: 3, cz: -2, r: 23, y: 23, sp: -0.22, ph: 2.1, bob: 1.6, bank: 0.3 });
  const air = makeAirship(); g.add(air); flyers.push({ o: air, cx: -2, cz: 3, r: 15, y: 26, sp: 0.13, ph: 1.0, bob: 1.0, bank: 0 });
  const kites = [];
  for (const [tx, ty, tz, r, sp, ph] of [[-14, 9, -8, 4, 1.1, 0], [12, 9, -14, 3.6, -0.9, 1.5]]) {
    const k = makeKite(); g.add(k);
    const tether = cyl(0.03, 0.03, 8, ROPE, 4, {}); tether.position.set(tx, ty + 3, tz); g.add(tether);
    kites.push({ o: k, tx, ty, tz, r, sp, ph, tether });
  }
  const spinners = [];
  [[0.2, -10, CANVAS], [0.45, -10.5, CANVAS2], [0.62, 10.4, CANVAS], [0.88, 10.8, CANVAS2]].forEach(([s, off, col], i) => {
    const p = pathAt(s);
    const r = R0 + (R1 - R0) * s + off;
    const x = Math.cos(p.a) * r, z = Math.sin(p.a) * r, h = 5 + (i % 2);
    const post = cyl(0.18, 0.28, h, WOOD, 6, { pos: [x, h / 2, z] }); g.add(post);
    const hub = new THREE.Group(); hub.position.set(x, h, z + 0.35); g.add(hub);
    for (let k = 0; k < 4; k++) {
      const blade = box(0.08, 1.9, 0.6, col, { pos: [0, 1.0, 0], cast: false });
      blade.rotation.z = k * Math.PI / 2; hub.add(blade);
    }
    hub.add(box(0.3, 0.3, 0.3, RUST, { cast: false }));
    spinners.push({ hub, sp: 1.0 + (i % 3) * 0.5 });
  });

  const label = makeLabel('Origin', 'The Inventor', '#c4763a');
  label.sprite.position.set(0, 44, 0); g.add(label.sprite);

  tagPickable(g, 'about');

  const PULSE_PERIOD = 22;      // seconds for the power (time) to run 2022 → now
  return {
    group: g, label,
    frame: { target: [-6, 5, -9], azimuth: 0.42, polar: 53, radius: 70 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t, dt) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);

      // the windmill turns everything
      rotor.rotation.z = t * 0.5;
      for (const f of flanges) f.rotation.y = t * 2.2;

      // THE PULSE — power leaves the mill and travels the whole line (chronology)
      const sP = (t / PULSE_PERIOD) % 1;
      const p = pathAt(sP);
      pulse.position.set(p.x, SHAFT_Y, p.z);
      pulse.material.emissiveIntensity = 1.8 + Math.sin(t * 8) * 0.6;

      // stations wake as the pulse reaches them, then settle back to idle
      for (const st of stations) {
        const d = Math.abs(sP - st.s);
        const on = d < 0.09;
        st.wheel.rotation.z = t * (on ? 5 : 0.5);
        if (st.mechAnim) st.mechAnim(t, on);
        st.sign.material.emissiveIntensity = on ? 1.6 : 0.45;
      }
      // the blueprint's ghost-machine breathes — brightest when the pulse arrives home
      const endGlow = sP > 0.94 ? 1 : 0;
      ghost.material.opacity = 0.3 + endGlow * 0.5 + Math.sin(t * 1.4) * 0.1;

      for (const f of flyers) {
        const a = t * f.sp + f.ph;
        f.o.position.set(f.cx + Math.cos(a) * f.r, f.y + Math.sin(t * 0.5 + f.ph) * f.bob, f.cz + Math.sin(a) * f.r);
        f.o.rotation.y = -a + Math.PI / 2;
        f.o.rotation.z = Math.sin(a) * f.bank;
      }
      for (const k of kites) {
        const a = t * k.sp + k.ph;
        const kx = k.tx + Math.cos(a) * k.r, kz = k.tz + Math.sin(a) * k.r * 0.5;
        const ky = k.ty + 5 + Math.sin(a * 1.3) * 1.4;
        k.o.position.set(kx, ky, kz);
        k.o.rotation.set(Math.sin(t + k.ph) * 0.3, a, Math.cos(t * 1.2 + k.ph) * 0.4);
        const dx = kx - k.tx, dy = ky - k.ty, dz = kz - k.tz;
        const len = Math.hypot(dx, dy, dz);
        k.tether.position.set((k.tx + kx) / 2, (k.ty + ky) / 2, (k.tz + kz) / 2);
        k.tether.scale.y = len / 8;
        k.tether.rotation.z = Math.atan2(dx, dy);
        k.tether.rotation.x = -Math.atan2(dz, dy);
      }
      for (const s of spinners) s.hub.rotation.z = t * s.sp;
    },
  };
}
