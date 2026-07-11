// rubicon.js — Rubicon: a solo ERP-migration internship at a Bangkok jewelry
// manufacturer, told as NATURE RECLAIMING THE OFFICE PARK. Two real concrete-and-
// glass Bangkok office towers stand in a cracked forecourt — most floors gone dark
// and vine-choked, a handful still lit (the company still runs while it's migrated),
// a tree has punched clean through one upper floor. Vines cascade off every roof
// edge and balcony; roots have cracked the pavement and fan out from the buildings'
// base. In the gaps that fan opens between the roots (Augustin's own request: "put a
// little jewelry workshop down among the buildings") sit three small scenes:
//  - the ATELIER (PDP: stones, metal prices, costing, the product-design engine) —
//    a thatched hut with a tray of hand-cut gems, literally what PDP does.
//  - the LEDGER (SIS: quotations, invoices, the trade-fair sales-pivot tool) — a
//    market stall strung with fair bunting.
//  - the ROOTS (the migration itself) — a half-excavated pit where two broken
//    stone tablets (the old MS-SQL system, "JMS") still sit; a bead of light climbs
//    a vine up the tower's face into one lit floor, on a loop — 13 months of solo
//    import work, always running.
// The portal is the annex's own lobby doorway — a real entrance in a building
// facade, vine-flanked, not a freestanding gate standing apart from the towers.
import * as THREE from 'three';
import { box, cyl, glow, makeLabel, makeWallPortal, poiBeacon, tagPOI, tagPickable } from './kit.js';

const BARK_LO = 0x51422e, MOSS = 0x6f9457;
const LEAF_A = 0x5a8a4c, LEAF_B = 0x335430, LEAF_C = 0x7ba854;
const CONCRETE = 0xb9b3a2, CONCRETE_LO = 0xa39d8c, GLASS = 0x24343a, WARM = 0xffcf82;
const WOOD = 0x8a6a44, THATCH = 0xb98f4e, PAVE = 0x9a9584;
const ACCENT = 0xa56cc1;
const GEMS = [0xb3243c, 0x2e9e5b, 0x3468c9, 0xe0a52e, 0xa56cc1];   // ruby·emerald·sapphire·topaz·amethyst

// a tapered segment from a→b (root or vein): the one organic primitive, reused for
// anything that needs to lean/taper rather than stand as a plain vertical cylinder.
function limb(a, b, r0, r1, color, opts = {}) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r1, r0, len, opts.seg ?? 6);
  const mat = new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: opts.roughness ?? 0.88,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = opts.cast ?? true; m.receiveShadow = opts.receive ?? true;
  return m;
}

function leafBlob(x, y, z, r, color) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0),
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 }));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}

// a hanging vine/liana (pivot at top, sways in update()). Thick enough and long
// enough to read as a real cable at diorama viewing distance — a thin 0.1-radius
// stick was getting lost against the leaf-blob window overgrowth, so this is
// deliberately heavier: a tapered rope with three leaf tufts strung along it.
function makeVine(parent, x, y, z, len, vines) {
  const piv = new THREE.Group(); piv.position.set(x, y, z); parent.add(piv);
  piv.add(cyl(0.16, 0.24, len, MOSS, 5, { pos: [0, -len / 2, 0], cast: false, receive: false }));
  for (const fy of [len * 0.25, len * 0.55, len * 0.85]) {
    piv.add(leafBlob(0.4 * (Math.random() > 0.5 ? 1 : -1), -fy, 0, 0.6 + Math.random() * 0.25, LEAF_C));
  }
  vines.push({ piv, ph: Math.random() * Math.PI * 2 });
}

// a small thatched hut shell for the atelier stall
function hutShell(w, h, d, wall, roof) {
  const s = new THREE.Group();
  s.add(box(w, h, d, wall, { pos: [0, h / 2, 0], roughness: 0.9 }));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.8, h * 0.6, 4),
    new THREE.MeshStandardMaterial({ color: roof, flatShading: true, roughness: 0.95 }));
  cone.rotation.y = Math.PI / 4; cone.position.y = h + h * 0.28; cone.castShadow = true;
  s.add(cone);
  return s;
}

// ===== A RECLAIMED BANGKOK OFFICE TOWER =========================================
// Concrete mass + a horizontal glass-curtain floor band per storey on the two
// camera-facing sides. Each floor is independently 'lit' (still in use), 'glass'
// (dark, empty) or 'vine' (a leaf blob swallows the whole band) — mostly dark/vine,
// a few still lit. opts.skip: [{f, face}] leaves a floor's band empty (bare
// concrete) so a wall portal can be embedded there instead. Returns
// { group, windows, roofY, topWindow }.
function buildTower(w, d, floors, floorH, seed, vines, opts = {}) {
  const g = new THREE.Group();
  const h = floors * floorH;
  const skip = opts.skip ?? [];
  g.add(box(w, h, d, CONCRETE, { pos: [0, h / 2, 0], roughness: 0.88 }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(box(0.5, h, 0.5, CONCRETE_LO, { pos: [sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1)], roughness: 0.85 }));
  }
  const windows = [];
  let topWindow = null;
  for (let f = 0; f < floors; f++) {
    const y = f * floorH + floorH * 0.6;
    const state = (f * 3 + seed) % 5;         // 0-1 vine · 2-3 glass(dark) · 4 lit
    for (const face of ['z', 'x']) {
      if (skip.some((s) => s.f === f && s.face === face)) continue;
      const bw = (face === 'z' ? w : d) * 0.72;
      const pos = face === 'z' ? [0, y, d / 2 + 0.08] : [w / 2 + 0.08, y, 0];
      const rotY = face === 'z' ? 0 : Math.PI / 2;
      if (state <= 1) {
        const lb = leafBlob(pos[0], pos[1], pos[2], bw * 0.34, [LEAF_A, LEAF_B, LEAF_C][(f + seed) % 3]);
        lb.castShadow = false; g.add(lb);
      } else {
        const lit = state === 4;
        const win = box(bw, floorH * 0.5, 0.14, lit ? WARM : GLASS, {
          pos, emissive: lit ? WARM : GLASS, emissiveIntensity: lit ? 1.4 : 0.15, cast: false, receive: false,
        });
        win.rotation.y = rotY; g.add(win);
        const rec = { m: win.material, lit, y };
        windows.push(rec);
        if (lit && f >= floors - 3 && face === 'z') topWindow = { local: new THREE.Vector3(pos[0], pos[1], pos[2]), rec };
      }
    }
  }
  // flat roof + parapet lip, a water tank, and a stray tree that broke through
  g.add(box(w + 0.3, 0.5, d + 0.3, CONCRETE_LO, { pos: [0, h + 0.25, 0], roughness: 0.85 }));
  g.add(cyl(1.0, 1.1, 1.6, 0x8a8368, 10, { pos: [-w * 0.28, h + 1.3, d * 0.18], roughness: 0.8 }));
  g.add(leafBlob(w * 0.22, h + 1.4, -d * 0.15, 1.8, LEAF_A));
  g.add(leafBlob(-w * 0.1, h + 2.0, d * 0.05, 1.3, LEAF_C));
  // roof-edge vines cascading down the front + side faces — long enough to drape
  // past a couple of floors, so they read at a glance, not just up close
  for (const fx of [-w * 0.32, 0, w * 0.3]) makeVine(g, fx, h, d / 2 + 0.05, 7 + Math.random() * 6, vines);
  for (const fz of [-d * 0.2, d * 0.25]) makeVine(g, w / 2 + 0.05, h, fz, 6 + Math.random() * 5, vines);
  // roots creeping up from the base at the corners
  for (const [sx, sz] of [[-1, 1], [1, 1]]) {
    g.add(limb(new THREE.Vector3(sx * (w / 2 + 0.3), 0, sz * (d / 2 + 0.3)),
      new THREE.Vector3(sx * (w / 2 - 0.6), floorH * 1.6, sz * (d / 2 - 0.6)), 0.35, 0.12, MOSS, { seg: 5, cast: false }));
  }
  return { group: g, windows, roofY: h, topWindow };
}

export function build() {
  const g = new THREE.Group();
  const vines = [];

  // ===== THE FORECOURT — cracked pavement between the two towers ================
  const hero = new THREE.Group(); g.add(hero); tagPOI(hero, 'tower');
  const plazaTint = glow(24, 22, 0x33402c, 0.35);
  plazaTint.rotation.x = -Math.PI / 2; plazaTint.position.y = 0.02;
  plazaTint.material.transparent = true; plazaTint.material.opacity = 0.5;
  hero.add(plazaTint);
  const PAVERS = [[-1, -3, 0.05], [2, -1, -0.08], [-3, 2, 0.1], [3.5, 4, -0.05], [-5, -1, 0.08], [1, 6, 0.04]];
  for (const [x, z, tilt] of PAVERS) {
    const p = box(3.2, 0.2, 3.2, PAVE, { pos: [x, 0.08, z], roughness: 0.9, receive: true, cast: false });
    p.rotation.z = tilt; p.rotation.y = tilt * 1.6; hero.add(p);
  }

  // ===== TOWER A — the HQ, taller, podium + shaft massing ========================
  const A = new THREE.Group(); A.position.set(-4.5, 0, -2); hero.add(A);
  const podium = buildTower(9.0, 7.0, 6, 2.4, 2, vines);
  A.add(podium.group);
  const shaft = buildTower(6.4, 5.2, 5, 2.5, 5, vines);
  shaft.group.position.set(0.2, podium.roofY, -0.3);
  A.add(shaft.group);

  // ===== TOWER B — a shorter annex, its own little block =========================
  // floors 0-1 on the front face are left bare (skip) — that's where the entrance
  // portal is mounted below, a real lobby doorway instead of a freestanding gate.
  const B = new THREE.Group(); B.position.set(5.5, 0, 2.5); hero.add(B);
  const annex = buildTower(6.5, 5.5, 6, 2.4, 4, vines, {
    skip: [{ f: 0, face: 'z' }, { f: 1, face: 'z' }],
  });
  B.add(annex.group);

  const windows = [...podium.windows, ...shaft.windows, ...annex.windows];

  const label = makeLabel('Rubicon', 'Jewelry & ERP', '#a56cc1');
  label.sprite.position.set(0, podium.roofY + shaft.roofY + 6, 0); hero.add(label.sprite);

  // ===== undergrowth ring — jungle filling the clearing out to the pad edge =====
  const UNDERGROWTH = [
    [0.17, 18], [0.62, 22], [1.05, 17], [1.62, 24], [1.95, 19],
    [2.55, 21], [2.95, 25], [3.55, 18], [4.15, 23], [4.85, 20],
    [5.35, 26], [5.85, 19],
  ];
  UNDERGROWTH.forEach(([a, r], i) => {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const bushH = 1.1 + (i % 3) * 0.5;
    g.add(cyl(0.1, 0.14, bushH, BARK_LO, 5, { pos: [x, bushH / 2, z], cast: false }));
    g.add(leafBlob(x, bushH + 0.5, z, 0.9 + (i % 3) * 0.3, [LEAF_A, LEAF_B, LEAF_C][i % 3]));
  });

  // ===== FOUR ROOTS fan from the building cluster, framing the gaps between them =
  const BUTTRESS_A = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  for (const a of BUTTRESS_A) {
    const near = new THREE.Vector3(Math.cos(a) * 3.5, 1.4, Math.sin(a) * 3.5);
    const far = new THREE.Vector3(Math.cos(a) * 12.5, 0, Math.sin(a) * 12.5);
    hero.add(limb(near, far, 0.4, 1.7, BARK_LO, { seg: 6, cast: false }));
    // moss patches along the root, so it reads as living, not a bare ramp
    for (const f of [0.3, 0.6, 0.85]) {
      const p = near.clone().lerp(far, f);
      hero.add(leafBlob(p.x, p.y * (1 - f) + 0.3, p.z, 0.5, LEAF_C));
    }
  }

  // ===== POI beacons ==============================================================
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); g.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('tower', '#a56cc1', -3, podium.roofY + shaft.roofY + 2, -2);

  // ===== THE ATELIER (PDP) — a jeweler's hut in the NE gap ======================
  const atelierPos = new THREE.Vector3(Math.cos(Math.PI * 0.25) * 13, 0, Math.sin(Math.PI * 0.25) * 13);
  const atelier = new THREE.Group(); atelier.position.copy(atelierPos); g.add(atelier);
  atelier.rotation.y = Math.atan2(-atelierPos.x, -atelierPos.z);
  atelier.add(hutShell(3.0, 2.1, 2.6, 0xdccbaa, THATCH));
  atelier.add(box(2.0, 0.7, 1.0, WOOD, { pos: [0, 0.35, 2.0], roughness: 0.85 }));
  const gemMeshes = [];
  GEMS.forEach((c, i) => {
    const gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, flatShading: true, roughness: 0.25 }));
    gm.position.set(-0.7 + i * 0.36, 0.85, 2.0 + (i % 2) * 0.15);
    atelier.add(gm); gemMeshes.push(gm);
  });
  const lantern = box(0.4, 0.5, 0.4, WARM, { pos: [1.3, 2.5, 1.2], emissive: WARM, emissiveIntensity: 1.3, cast: false });
  atelier.add(lantern);
  // production-tracking corner, on the table's free edge (top at y=0.7): not a
  // design-invention tool — a barcode scanner and a digital scale, the other half
  // of what PDP actually does (checking, not conjuring)
  atelier.add(box(0.4, 0.3, 0.28, 0x2a2a30, { pos: [0.82, 0.85, 1.85], roughness: 0.5, metalness: 0.3 }));
  const scanLine = box(0.32, 0.03, 0.03, 0xff4444, {
    pos: [0.82, 0.71, 1.68], emissive: 0xff4444, emissiveIntensity: 1.6, cast: false, receive: false,
  });
  atelier.add(scanLine);
  atelier.add(cyl(0.26, 0.28, 0.08, 0x8a8a90, 10, { pos: [0.82, 0.74, 2.25], roughness: 0.4, metalness: 0.5 }));
  const scaleDisplay = box(0.26, 0.12, 0.04, 0x1a2a1a, {
    pos: [0.82, 0.92, 2.4], emissive: 0x4fef6a, emissiveIntensity: 1.2, cast: false, receive: false,
  });
  atelier.add(scaleDisplay);
  tagPOI(atelier, 'atelier');
  addBeacon('atelier', '#a56cc1', atelierPos.x, 5.5, atelierPos.z);

  // ===== THE LEDGER (SIS) — a trade-fair market stall in the SE gap =============
  const ledgerPos = new THREE.Vector3(Math.cos(Math.PI * 0.75) * 13, 0, Math.sin(Math.PI * 0.75) * 13);
  const ledger = new THREE.Group(); ledger.position.copy(ledgerPos); g.add(ledger);
  ledger.rotation.y = Math.atan2(-ledgerPos.x, -ledgerPos.z);
  ledger.add(box(2.6, 0.9, 1.1, WOOD, { pos: [0, 0.45, 0.9], roughness: 0.85 }));
  for (const dx of [-1.1, 1.1]) ledger.add(cyl(0.09, 0.11, 2.6, WOOD, 5, { pos: [dx, 1.3, 1.6] }));
  ledger.add(box(2.6, 0.14, 1.4, 0xb3243c, { pos: [0, 2.6, 1.6], roughness: 0.8 }));
  const bunting = [];
  for (let i = 0; i < 7; i++) {
    const fl = box(0.32, 0.4, 0.06, GEMS[i % GEMS.length], { cast: false, receive: false });
    fl.position.set(-1.05 + i * 0.35, 2.35, 1.6);
    ledger.add(fl); bunting.push(fl);
  }
  const pivotBars = [];
  for (let i = 0; i < 5; i++) {
    const bar = box(0.26, 1, 0.26, GEMS[i % GEMS.length], {
      pos: [-0.6 + i * 0.3, 0.5, -0.9], emissive: GEMS[i % GEMS.length], emissiveIntensity: 0.9, cast: false, receive: false,
    });
    ledger.add(bar); pivotBars.push(bar);
  }
  for (let i = 0; i < 3; i++) {
    ledger.add(box(0.75, 0.75, 0.75, 0x9a7a52, {
      pos: [1.7 - (i % 2) * 0.5, 0.38 + Math.floor(i / 2) * 0.8, -0.3 + (i % 2) * 0.4], roughness: 0.9,
    }));
  }
  tagPOI(ledger, 'ledger');
  addBeacon('ledger', '#a56cc1', ledgerPos.x, 5.5, ledgerPos.z);

  // ===== THE CARGO DIRIGIBLE — canvas-and-rattan airship shuttling crates out to
  // the next trade fair, looping out from the Ledger and back: the SIS shipping
  // line made literal. Vines trail off its rigging, same as the towers.
  const airship = new THREE.Group(); g.add(airship);
  const aEnv = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10),
    new THREE.MeshStandardMaterial({ color: THATCH, flatShading: true, roughness: 0.95 }));
  aEnv.scale.set(4.4, 1.6, 1.6); aEnv.castShadow = true; airship.add(aEnv);
  const aBand = new THREE.Mesh(new THREE.TorusGeometry(1.58, 0.08, 6, 16),
    new THREE.MeshStandardMaterial({ color: WOOD, flatShading: true, roughness: 0.9 }));
  aBand.rotation.y = Math.PI / 2; aBand.scale.set(1, 1, 2.5); airship.add(aBand);
  for (const dz of [-0.7, 0.7]) {
    const fin = box(1.0, 0.9, 0.08, WOOD, { pos: [-3.85, 0.1, dz], roughness: 0.85, cast: false });
    fin.rotation.y = dz > 0 ? -0.4 : 0.4; airship.add(fin);
  }
  // rigging down to a small crate-laden platform — the cargo, stamped in gem colors.
  // Thick enough to actually read as rope (0.025 all but vanished at this scale —
  // the same mistake the tower vines had before they got fixed).
  airship.add(box(1.8, 0.14, 1.0, WOOD, { pos: [0, -2.1, 0], roughness: 0.85 }));
  for (const [rx, rz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]]) {
    airship.add(cyl(0.07, 0.07, 1.7, WOOD, 4, { pos: [rx, -1.25, rz], cast: false }));
  }
  [[-0.5, 0], [0.35, 0.05], [0.0, -0.05]].forEach(([cx, cz], i) => {
    airship.add(box(0.55, 0.55, 0.55, i % 2 ? 0x8a6a44 : 0x9a7a52, { pos: [cx, -1.75, cz], roughness: 0.9 }));
    airship.add(box(0.2, 0.2, 0.06, GEMS[i % GEMS.length], {
      pos: [cx, -1.7, cz + (cz >= 0 ? 0.32 : -0.32)],
      emissive: GEMS[i % GEMS.length], emissiveIntensity: 1.1, cast: false, receive: false,
    }));
  });
  for (const dz of [-0.3, 0.3]) makeVine(airship, -0.9, -2.1, dz, 2.0 + Math.random(), vines);
  const AIRSHIP_R = 18, AIRSHIP_Y = 27, AIRSHIP_SP = 0.05;

  // ===== THE ROOTS — the buried legacy system, still feeding the towers =========
  const ruinsPos = new THREE.Vector3(Math.cos(Math.PI * 1.25) * 11.5, 0, Math.sin(Math.PI * 1.25) * 11.5);
  const ruins = new THREE.Group(); ruins.position.copy(ruinsPos); g.add(ruins);
  const pit = glow(6.2, 5.2, 0x2a2418, 0.5);
  pit.rotation.x = -Math.PI / 2; pit.position.y = 0.03;
  pit.material.transparent = true; pit.material.opacity = 0.85;
  ruins.add(pit);
  const tablets = [];
  [[-1.2, 0.3, 0x7c8071], [1.1, -0.4, 0x6a7264]].forEach(([dx, rot, c]) => {
    const t = box(1.0, 2.0, 0.5, c, { pos: [dx, 1.0, 0], roughness: 0.95 });
    t.rotation.z = rot; ruins.add(t);
    t.add(box(0.6, 0.5, 0.55, MOSS, { pos: [0, 0.5, 0], cast: false, roughness: 1 }));
    tablets.push(t);
  });
  // the vein: a thin glowing conduit climbing from the ruins up tower A's face
  const veinA = new THREE.Vector3().copy(ruinsPos).setY(1.4);
  const veinTopWorld = topWindowWorld(A, podium, shaft);
  const veinMid = veinA.clone().lerp(veinTopWorld, 0.45); veinMid.y = veinA.y + 3.5;
  const veinMat = { color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.9, roughness: 0.5 };
  g.add(limb(veinA, veinMid, 0.09, 0.13, ACCENT, { ...veinMat, seg: 5, cast: false }));
  g.add(limb(veinMid, veinTopWorld, 0.13, 0.07, ACCENT, { ...veinMat, seg: 5, cast: false }));
  // data motes rising from the pit toward the towers
  const motes = [];
  for (let i = 0; i < 6; i++) {
    const m = box(0.18, 0.18, 0.18, WARM, { emissive: WARM, emissiveIntensity: 1.5, cast: false, receive: false });
    g.add(m); motes.push({ m, off: i / 6 });
  }
  // the migration pulse — a bright bead climbing the vein on a loop
  const pulse = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0),
    new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.2, flatShading: true }));
  g.add(pulse);
  tagPOI(ruins, 'roots');
  addBeacon('roots', '#a56cc1', ruinsPos.x, 5.5, ruinsPos.z);

  // ===== THE PORTAL — the annex's lobby entrance, vine-flanked ===================
  // Mounted directly on Tower B's front (+z) facade, over the bare floors left by
  // its `skip` above — a real doorway into a building, not a freestanding gate.
  const portal = makeWallPortal('#a56cc1', 5.0, 4.4);
  portal.group.position.set(0, 0, 5.5 / 2 + 0.1);
  annex.group.add(portal.group);
  for (const dx of [-2.6, 2.6]) makeVine(annex.group, dx, 4.9, 5.5 / 2 + 0.05, 3.6 + Math.random() * 1.4, vines);

  tagPickable(g, 'rubicon');

  const PULSE_PERIOD = 16;
  return {
    group: g, label,
    frame: { target: [0, 15, 2], azimuth: 0.55, polar: 57, radius: 96 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);

      // vines sway
      for (const v of vines) v.piv.rotation.z = Math.sin(t * 0.7 + v.ph) * 0.09;

      // lit floors flicker gently, an uneven late-night office
      for (const w of windows) if (w.lit) w.m.emissiveIntensity = 1.1 + Math.sin(t * 1.1 + w.y * 0.7) * 0.3;

      // atelier: hand-cut gems turn slowly, lantern flickers warm
      gemMeshes.forEach((gm, i) => { gm.rotation.y = t * (0.6 + i * 0.1); });
      lantern.material.emissiveIntensity = 1.1 + Math.sin(t * 2.2) * 0.3;
      // atelier: barcode scanner flickers each pass, scale readout breathes
      scanLine.material.emissiveIntensity = 1.2 + Math.sin(t * 5) * 0.6;
      scaleDisplay.material.emissiveIntensity = 0.9 + Math.sin(t * 1.6 + 1) * 0.5;

      // ledger: bunting sways, the pivot bars pulse per fair/region/country
      bunting.forEach((fl, i) => { fl.rotation.z = Math.sin(t * 1.4 + i * 0.6) * 0.25; });
      pivotBars.forEach((bar, i) => {
        const s = 0.5 + 0.5 * Math.abs(Math.sin(t * (1.1 + i * 0.23) + i));
        bar.scale.y = s; bar.position.y = 0.5 * s;
      });

      // roots: data motes rise from the ruins toward the towers, looping
      for (const mo of motes) {
        const f = (t * 0.09 + mo.off) % 1;
        mo.m.position.set(ruinsPos.x * (1 - f * 0.9), 1.2 + f * 22, ruinsPos.z * (1 - f * 0.9));
        mo.m.material.emissiveIntensity = 1.6 * (1 - f);
      }
      // the migration pulse climbs the vein, ruins → tower face, on a loop
      const pf = (t / PULSE_PERIOD) % 1;
      if (pf < 0.4) pulse.position.lerpVectors(veinA, veinMid, pf / 0.4);
      else pulse.position.lerpVectors(veinMid, veinTopWorld, (pf - 0.4) / 0.6);
      pulse.material.emissiveIntensity = 1.8 + Math.sin(t * 8) * 0.5;
      tablets.forEach((tb, i) => { tb.rotation.y = Math.sin(t * 0.2 + i) * 0.02; });

      // the cargo dirigible loops out from the Ledger and back, banking gently
      const aa = t * AIRSHIP_SP;
      airship.position.set(
        ledgerPos.x + Math.cos(aa) * AIRSHIP_R,
        AIRSHIP_Y + Math.sin(t * 0.2) * 1.2,
        ledgerPos.z + Math.sin(aa) * AIRSHIP_R,
      );
      airship.rotation.y = -aa + Math.PI / 2;
      airship.rotation.z = Math.sin(t * 0.25) * 0.05;
    },
  };
}

// world-space position of a lit floor near the top of tower A, so the migration
// vein has a real destination — falls back to the shaft roof if every floor near
// the top happened to roll 'vine'/'glass' (deterministic seeds make this rare).
function topWindowWorld(A, podium, shaft) {
  const rec = shaft.topWindow ?? podium.topWindow;
  if (!rec) return new THREE.Vector3(A.position.x, podium.roofY + shaft.roofY - 2, A.position.z);
  const world = rec.local.clone();
  if (shaft.topWindow) world.y += podium.roofY;
  world.x += A.position.x + (shaft.topWindow ? 0.2 : 0);
  world.z += A.position.z + (shaft.topWindow ? -0.3 : 0);
  return world;
}
