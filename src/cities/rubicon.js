// rubicon.js — Rubicon: a solo ERP-migration internship at a Bangkok jewelry
// manufacturer, told as NATURE RECLAIMING THE OFFICE PARK. Two real concrete-and-
// glass Bangkok office towers stand in a cracked forecourt — most floors gone dark
// and vine-choked, a handful still lit (the company still runs while it's migrated),
// a tree has punched clean through one upper floor. Vines cascade off every roof
// edge and balcony; roots have cracked the pavement and fan out from the buildings'
// base. Around them the whole business district is going the same way: a score of
// towers of the SAME make (one builder draws them all — see Reclaimed), lower toward
// the visitor, taller behind, the jungle at their feet. In the gaps that fan opens between the roots (Augustin's own request: "put a
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
import { Fabric, GROUND } from './urban.js';
import { mulberry32 } from '../gen/noise.js';

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

// ===== RECLAIMED BANGKOK OFFICE TOWERS ==========================================
// Concrete mass + a horizontal glass-curtain floor band per storey on each side.
// Each floor is independently 'lit' (still in use), 'glass' (dark, empty) or 'vine'
// (a leaf blob swallows the whole band) — mostly dark/vine, a few still lit. On the
// roof: a parapet, a water tank, a tree that broke through; vines pour off its edges
// and sway, roots climb its corners.
// Every tower of the city is described here and drawn TOGETHER: all the concrete is
// one instanced mesh, all the dark glass another, and so on — a district of towers
// costs a dozen draw calls, however many there are.
const FACES = [                       // outward normal · a shift in the floors' pattern
  { nx: 0, nz: 1, turn: 0 }, { nx: 1, nz: 0, turn: 0 }, { nx: 0, nz: -1, turn: 2 }, { nx: -1, nz: 0, turn: 4 },
];
const LEAVES = [LEAF_A, LEAF_B, LEAF_C];
const UP = new THREE.Vector3(0, 1, 0);

class Reclaimed {
  constructor(seed) {
    this.rand = mulberry32(seed >>> 0);
    this.blocks = []; this.glass = []; this.lit = [[], [], []];
    this.blobs = []; this.canopy = []; this.tanks = []; this.roots = []; this.vines = [];
  }

  // A tower standing at (x, y, z): y is its base, so one can stand on another's roof.
  // o.skip: [{ f, face }] leaves that floor's band bare on that face (index in FACES),
  // so a wall portal can be embedded there. → { roofY, topWindow }
  tower(x, y, z, w, d, floors, floorH, seed, o = {}) {
    const h = floors * floorH, top = y + h, skip = o.skip ?? [];
    this.blocks.push({ x, y: y + h / 2, z, w, h, d, color: CONCRETE });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      this.blocks.push({ x: x + sx * (w / 2 - 0.1), y: y + h / 2, z: z + sz * (d / 2 - 0.1), w: 0.5, h, d: 0.5, color: CONCRETE_LO });
    }
    let topWindow = null;
    for (let f = 0; f < floors; f++) {
      const fy = y + f * floorH + floorH * 0.6;
      FACES.forEach((face, k) => {
        if (skip.some((sk) => sk.f === f && sk.face === k)) return;
        const state = (f * 3 + seed + face.turn) % 5;         // 0-1 vine · 2-3 glass (dark) · 4 lit
        const bw = (face.nx ? d : w) * 0.72;
        const px = x + face.nx * (w / 2 + 0.08), pz = z + face.nz * (d / 2 + 0.08);
        if (state <= 1) { this.blobs.push({ x: px, y: fy, z: pz, r: bw * 0.34, color: LEAVES[(f + seed + k) % 3] }); return; }
        const band = { x: px, y: fy, z: pz, w: face.nx ? 0.14 : bw, h: floorH * 0.5, d: face.nx ? bw : 0.14 };
        if (state === 4) {
          this.lit[(f + seed + k) % 3].push(band);
          if (k === 0 && f >= floors - 3) topWindow = new THREE.Vector3(px, fy, pz);
        } else this.glass.push(band);
      });
    }
    // flat roof + parapet lip, a water tank, and a stray tree that broke through
    // (no two roofs alike: the tank sits on one side or the other, the tree is big or small)
    const r = this.rand, side = r() < 0.5 ? 1 : -1, grown = 0.75 + r() * 0.55;
    this.blocks.push({ x, y: top + 0.25, z, w: w + 0.3, h: 0.5, d: d + 0.3, color: CONCRETE_LO });
    this.tanks.push({ x: x - side * w * 0.28, y: top + 1.3, z: z + d * 0.18 });
    this.canopy.push({ x: x + side * w * 0.22, y: top + 1.4 * grown, z: z - d * 0.15, r: 1.8 * grown, color: LEAVES[(seed + 0) % 3] });
    this.canopy.push({ x: x - side * w * 0.1, y: top + 2.0 * grown, z: z + d * 0.05, r: 1.3 * grown, color: LEAVES[(seed + 2) % 3] });
    if (r() < 0.4) this.canopy.push({ x: x + side * w * 0.3, y: top + 0.9, z: z + d * 0.3, r: 0.9 + r() * 0.5, color: LEAF_B });
    // roof-edge vines cascading down every face — long enough to drape past a couple
    // of floors, so they read at a glance, not just up close
    for (const fx of [-w * 0.32, 0, w * 0.3]) this.vine(x + fx, top, z + d / 2 + 0.05, 7 + r() * 6, 0, 1);
    for (const fz of [-d * 0.2, d * 0.25]) this.vine(x + w / 2 + 0.05, top, z + fz, 6 + r() * 5, 1, 0);
    this.vine(x - w * 0.18, top, z - d / 2 - 0.05, 5 + r() * 6, 0, -1);
    this.vine(x - w / 2 - 0.05, top, z + d * 0.12, 5 + r() * 5, -1, 0);
    // roots creeping up from the base at the front corners
    for (const sx of [-1, 1]) {
      this.roots.push({
        a: new THREE.Vector3(x + sx * (w / 2 + 0.3), y, z + d / 2 + 0.3),
        b: new THREE.Vector3(x + sx * (w / 2 - 0.6), y + floorH * 1.6, z + d / 2 - 0.6),
      });
    }
    return { roofY: top, topWindow };
  }

  // a liana hanging from (x, y, z) down a face whose outward normal is (nx, nz). Thick
  // and long enough to read as a real cable at diorama distance, three leaf tufts
  // strung along it; it never reaches the ground.
  vine(x, y, z, len, nx, nz) {
    const r = this.rand;
    len = Math.min(len, y - 0.9);
    if (len < 1.2) return;
    this.vines.push({
      x, y, z, len, nx, nz, ph: r() * Math.PI * 2,
      tufts: [0.25, 0.55, 0.85].map((f) => ({ at: len * f, side: r() > 0.5 ? 0.4 : -0.4, r: 0.6 + r() * 0.25 })),
    });
  }

  build() {
    const group = new THREE.Group();
    const o3 = new THREE.Object3D(), col = new THREE.Color(), dir = new THREE.Vector3();
    const inst = (geo, mat, list, place, o = {}) => {
      if (!list.length) return null;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((e, i) => {
        o3.quaternion.identity(); place(e);
        o3.updateMatrix(); mesh.setMatrixAt(i, o3.matrix);
        if (e.color != null) mesh.setColorAt(i, col.set(e.color));
      });
      mesh.castShadow = !!o.cast; mesh.receiveShadow = o.receive !== false;
      if (o.detail) mesh.userData.detail = o.detail;       // size of ONE instance → world.js sortDetail
      group.add(mesh);
      return mesh;
    };
    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.88, ...o });
    const boxAt = (e) => { o3.position.set(e.x, e.y, e.z); o3.scale.set(e.w, e.h, e.d); };
    const blobAt = (e) => { o3.position.set(e.x, e.y, e.z); o3.scale.setScalar(e.r); };
    const BOX = new THREE.BoxGeometry(1, 1, 1), BLOB = new THREE.IcosahedronGeometry(1, 0);
    const leaf = std(0xffffff, { roughness: 0.95 });

    inst(BOX, std(0xffffff), this.blocks, boxAt, { cast: true });
    inst(BOX, std(GLASS, { emissive: GLASS, emissiveIntensity: 0.15, roughness: 0.85 }), this.glass, boxAt, { receive: false });
    // the floors still in use, in three sets that flicker each to its own rhythm
    const litMats = this.lit.map(() => std(WARM, { emissive: WARM, emissiveIntensity: 1.4, roughness: 0.85 }));
    this.lit.forEach((list, k) => inst(BOX, litMats[k], list, boxAt, { receive: false }));
    inst(BLOB, leaf, this.blobs, blobAt);                    // floors the green has swallowed
    inst(BLOB, leaf, this.canopy, blobAt, { cast: true });   // trees through the roofs
    inst(new THREE.CylinderGeometry(1.0, 1.1, 1.6, 10), std(0x8a8368, { roughness: 0.8 }), this.tanks,
      (e) => { o3.position.set(e.x, e.y, e.z); o3.scale.setScalar(1); }, { cast: true });
    inst(new THREE.CylinderGeometry(0.34, 1, 1, 5), std(MOSS), this.roots, (e) => {
      dir.subVectors(e.b, e.a);
      const len = dir.length();
      o3.position.addVectors(e.a, e.b).multiplyScalar(0.5);
      o3.quaternion.setFromUnitVectors(UP, dir.normalize());
      o3.scale.set(0.35, len, 0.35);
    }, { detail: 1.3 });

    // the vines sway: their ropes and tufts are placed afresh every frame
    const n = this.vines.length;
    const ropes = n ? new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 5), std(MOSS), n) : null;
    const tufts = n ? new THREE.InstancedMesh(BLOB, std(LEAF_C, { roughness: 0.95 }), n * 3) : null;
    if (n) {
      ropes.receiveShadow = false; ropes.userData.detail = 0.7;
      tufts.userData.detail = 0.7;
      group.add(ropes, tufts);
    }
    const sway = (t) => {
      if (!n) return;
      this.vines.forEach((v, i) => {
        const th = Math.sin(t * 0.7 + v.ph) * 0.09, s = Math.sin(th), c = Math.cos(th);
        const tx = v.nz, tz = -v.nx;                          // along the face
        const dx = tx * s, dy = -c, dz = tz * s;              // the way the vine hangs, this instant
        o3.position.set(v.x + dx * v.len / 2, v.y + dy * v.len / 2, v.z + dz * v.len / 2);
        o3.quaternion.setFromUnitVectors(UP, dir.set(-dx, -dy, -dz));
        o3.scale.set(1, v.len, 1);
        o3.updateMatrix(); ropes.setMatrixAt(i, o3.matrix);
        o3.quaternion.identity();
        v.tufts.forEach((tf, k) => {
          o3.position.set(v.x + dx * tf.at + tx * c * tf.side, v.y + dy * tf.at + s * tf.side, v.z + dz * tf.at + tz * c * tf.side);
          o3.scale.setScalar(tf.r);
          o3.updateMatrix(); tufts.setMatrixAt(i * 3 + k, o3.matrix);
        });
      });
      ropes.instanceMatrix.needsUpdate = true; tufts.instanceMatrix.needsUpdate = true;
    };
    sway(0);

    return {
      group,
      update(t) {
        sway(t);
        // lit floors flicker gently, an uneven late-night office
        litMats.forEach((m, k) => { m.emissiveIntensity = 1.1 + Math.sin(t * 1.1 + k * 2.1) * 0.3; });
      },
    };
  }
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
  const heart = new Reclaimed(2026);
  const A = { x: -4.5, z: -2 };
  const podium = heart.tower(A.x, 0, A.z, 9.0, 7.0, 6, 2.4, 2);
  const shaft = heart.tower(A.x + 0.2, podium.roofY, A.z - 0.3, 6.4, 5.2, 5, 2.5, 5);

  // ===== TOWER B — a shorter annex, its own little block =========================
  // floors 0-1 on the front face are left bare (skip) — that's where the entrance
  // portal is mounted below, a real lobby doorway instead of a freestanding gate.
  const B = { x: 5.5, z: 2.5, d: 5.5 };
  heart.tower(B.x, 0, B.z, 6.5, B.d, 6, 2.4, 4, { skip: [{ f: 0, face: 0 }, { f: 1, face: 0 }] });
  // …flanked by two vines of its own
  for (const dx of [-2.6, 2.6]) heart.vine(B.x + dx, 4.9, B.z + B.d / 2 + 0.05, 3.6 + Math.random() * 1.4, 0, 1);
  const towers = heart.build();
  hero.add(towers.group);

  const label = makeLabel('Rubicon', 'Jewelry & ERP', '#a56cc1');
  label.sprite.position.set(0, shaft.roofY + 6, 0); hero.add(label.sprite);

  // ===== undergrowth ring — jungle filling the clearing out to the pad edge =====
  const UNDERGROWTH = [
    [0.17, 18], [0.62, 16.5], [1.05, 17], [1.62, 18.5], [1.95, 16],
    [2.55, 18], [2.95, 15.5], [3.55, 18], [4.15, 16.5], [4.85, 18.5],
    [5.35, 15], [5.85, 17.5],
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
  addBeacon('tower', '#a56cc1', -3, shaft.roofY + 2, -2);

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
  // …to a lit floor near its top (the shaft's roof, should none be lit up there)
  const veinTopWorld = shaft.topWindow ?? podium.topWindow ?? new THREE.Vector3(A.x, shaft.roofY - 2, A.z);
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
  portal.group.position.set(B.x, 0, B.z + B.d / 2 + 0.1);
  hero.add(portal.group);

  // ===== THE DISTRICT AROUND — the rest of the business quarter, going the same way
  // as its two neighbours: towers of the same concrete and glass, the same floors
  // gone dark or swallowed, the same vines off the roofs. A ring road still runs
  // between them (taxis, tuk-tuks), a street market by the Ledger, the skytrain behind.
  const fab = new Fabric({
    seed: 77, pavement: 0x8f8c7c, cars: [0xff4fa3, 0x2fbf71, 0xf5d90a, 0xff7a00, 0x3aa0ff],
    leaves: [LEAF_A, LEAF_B, LEAF_C], trunk: BARK_LO,
  });
  const RING = 21.5, RAIL_Z = -31;
  fab.ring(RING, 3.0, 0x4a4d45);
  fab.traffic({ ring: RING }, { n: 10, speed: 4.4, l: 1.5, w: 0.82, h: 0.85 });
  fab.walkers({ ring: RING + 2.3 }, { n: 12, spread: 0.6 });
  for (let k = 0; k < 12; k++) { const a = (k + 0.5) / 12 * Math.PI * 2; fab.lamp(Math.sin(a) * (RING + 2.1), Math.cos(a) * (RING + 2.1)); }

  const quarter = new Reclaimed(4711), rnd = mulberry32(90210);
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
    const x = i * 12.4 + (j & 1 ? 6.2 : 0) + (rnd() - 0.5) * 2.2, z = j * 11.2 + (rnd() - 0.5) * 2.0;
    const w = 6 + rnd() * 2.6, d = 5.2 + rnd() * 1.9, seed = (rnd() * 5) | 0, tall = rnd(), stepped = rnd() < 0.45;
    const r = Math.hypot(x, z);
    if (r < RING + 7.6 || r > 43.5 || Math.abs(z - RAIL_Z) < 7.4) continue;
    // lower toward the dive camera (frame azimuth 0.55), higher behind the two towers
    const front = x * 0.52 + z * 0.85;
    const floors = front > 16 ? 3 + (tall < 0.5 ? 1 : 0) : front > -8 ? 4 + ((tall * 3) | 0) : 6 + ((tall * 3) | 0);
    if (floors >= 6 && stepped) {
      const base = quarter.tower(x, 0, z, w, d, floors - 3, 2.4, seed);              // podium + shaft, like the HQ
      quarter.tower(x + 0.2, base.roofY, z - 0.25, w * 0.72, d * 0.74, 3, 2.5, seed + 3);
    } else quarter.tower(x, 0, z, w, d, floors, 2.4, seed);
    // the jungle at its feet
    for (const [sx, sz] of [[-1, 1], [1, -1], [1, 1]]) {
      if (rnd() < 0.7) fab.tree(x + sx * (w / 2 + 1.3 + rnd()), z + sz * (d / 2 + 1.2 + rnd()), 1.3 + rnd() * 0.9);
    }
  }
  const district = quarter.build();
  g.add(district.group);
  // the street market on the ring, on the Ledger's side: stalls under gem-coloured cloth
  const stalls = [];
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * 0.75 - 0.72 + k * 0.18;             // around the Ledger's bearing (x = cos, z = sin)
    const x = Math.cos(a) * (RING - 3.1), z = Math.sin(a) * (RING - 3.1), rot = Math.PI / 2 - a;
    fab.prop(x, GROUND, z, 1.7, 0.85, 1.1, WOOD, rot);
    fab.prop(x, GROUND + 1.9, z, 2.1, 0.12, 1.6, GEMS[k % GEMS.length], rot);
    stalls.push([x, z]);
  }
  fab.crowd(16, (i, rand) => { const [x, z] = stalls[i % stalls.length]; return [x * 1.07 + (rand() - 0.5), z * 1.07 + (rand() - 0.5)]; }, { roam: 0.5 });
  const fabric = fab.build();
  g.add(fabric.group);

  // the SKYTRAIN: a viaduct behind the towers, a train calling at its one station
  const rail = new THREE.Group(); rail.position.set(0, 0, RAIL_Z); g.add(rail);
  const RAIL_Y = 8.2, RAIL_HALF = 34;
  rail.add(box(RAIL_HALF * 2, 0.7, 2.6, CONCRETE_LO, { pos: [0, RAIL_Y, 0], roughness: 0.9 }));
  for (let x = -RAIL_HALF + 4; x <= RAIL_HALF - 4; x += 8.5) {
    rail.add(box(1.0, RAIL_Y + 0.6, 1.0, CONCRETE, { pos: [x, RAIL_Y / 2 - 0.3, 0], roughness: 0.9 }));
    rail.add(box(2.6, 0.5, 2.6, CONCRETE, { pos: [x, RAIL_Y - 0.5, 0], roughness: 0.9 }));
  }
  rail.add(box(11, 0.3, 4.6, CONCRETE, { pos: [0, RAIL_Y + 0.5, 0], roughness: 0.9 }));                      // the platform
  for (const dx of [-4.6, 4.6]) for (const dz of [-2, 2]) rail.add(box(0.2, 2.6, 0.2, CONCRETE_LO, { pos: [dx, RAIL_Y + 1.9, dz] }));
  rail.add(box(11.6, 0.25, 5.2, 0x6f7f76, { pos: [0, RAIL_Y + 3.3, 0], roughness: 0.8 }));
  const train = new THREE.Group(); train.position.y = RAIL_Y + 0.4; rail.add(train);
  for (const dx of [-5.3, 0, 5.3]) {
    train.add(box(5.0, 1.7, 1.9, 0xeeeeea, { pos: [dx, 0.95, 0], roughness: 0.6 }));
    train.add(box(5.02, 0.32, 1.92, 0x2f5fa8, { pos: [dx, 0.55, 0], roughness: 0.6, cast: false }));
    train.add(box(4.2, 0.55, 1.94, GLASS, { pos: [dx, 1.3, 0], emissive: WARM, emissiveIntensity: 0.35, cast: false }));
  }

  tagPickable(g, 'rubicon');

  const PULSE_PERIOD = 16;
  return {
    group: g, label,
    frame: { target: [0, 11, 3], azimuth: 0.55, polar: 56, radius: 112 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);

      // the towers: vines sway, lit floors flicker (the two at the heart, then the district)
      towers.update(t); district.update(t);
      for (const v of vines) v.piv.rotation.z = Math.sin(t * 0.7 + v.ph) * 0.09;      // the dirigible's own

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

      // the city around: traffic, walkers, the market — and the skytrain, which runs
      // the length of its viaduct, pausing at the station each way
      fabric.update(t);
      const run = (t * 0.045) % 1, leg = run < 0.5 ? run * 2 : 2 - run * 2;       // 0 → 1 → 0
      const eased = leg < 0.5 ? 0.5 * Math.pow(leg * 2, 1.6) : 1 - 0.5 * Math.pow((1 - leg) * 2, 1.6);
      train.position.x = (eased * 2 - 1) * (RAIL_HALF - 9);

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
