// toaster.js — Toaster: a 3D LiDAR point-cloud ANNOTATION tool.
// "THE SCAN": the whole city is ONE lidar frame seen from inside. A chrome
// sensor-toaster spire stands at the exact origin; the city radiates from it on a
// POLAR SCAN-GRID (concentric rings × radial spokes — zero random placement, every
// façade faces the sensor). Radius = pipeline stage: a tall, saturated LABELS
// downtown around the core, a mid-ring of translucent GROUPING scaffolds, a low
// grey NOISE rim. A rotating segmenter sweep "toasts" grey wedges into colour as
// it passes — the tool's one-click-label mechanic performed on loop. One full
// sector stays grey (group_id = −1, not yet labelled) and hosts the portal.
import * as THREE from 'three';
import { box, cyl, glow, strip, wireBox, pointCloud, makeLabel, makePortal, poiBeacon, tagPOI, tagPickable } from './kit.js';
import { Simplex, lerp } from '../gen/noise.js';

// 8 angular sectors = 8 clusters (Paul Tol palette: {body, accent}); index 5 is the
// grey NOISE wedge (the "before the segmenter runs" sector — it hosts the portal).
const SECTORS = [
  { body: 0x4a636e, accent: 0x88ccee },  // cyan
  { body: 0x3f5f57, accent: 0x44aa99 },  // teal
  { body: 0x6a6350, accent: 0xddcc77 },  // sand
  { body: 0x6a5058, accent: 0xcc6677 },  // rose
  { body: 0x5a4560, accent: 0xaa4499 },  // purple
  null,                                   // ← the grey NOISE wedge
  { body: 0x3f5a44, accent: 0x117733 },  // forest
  { body: 0x45456a, accent: 0x332288 },  // indigo
];
const GREY = 0x5b6472;
const RED = 0xe10600, CYAN = 0x88ccee, TOAST = 0xcaa15a, CHROME = 0xb8c0c8;
// TURBO height/intensity ramp for the ground scan-rings (hot core → cold rim)
const TURBO = [0xe10600, 0xff8a3c, 0xddcc77, 0x44aa99, 0x3b6fe0, 0x2a4a8a, 0x223a5e];

const RINGS = [7, 12, 18, 25, 33, 42];        // ring-band radii (widen like scan returns)
const BAND_H = [14, 10, 8, 6, 4, 2.5];        // ziggurat: height steps DOWN outward
const OCC_T = [0.12, 0.18, 0.26, 0.36, 0.44, 0.5]; // occupancy threshold rises outward
const SEC_W = (Math.PI * 2) / 8;

export function build() {
  const g = new THREE.Group();
  const sim = new Simplex(22);

  // slate ground platform — never near-black lit bulk
  g.add(platformSlate(50));

  // landmark spots (grid cells are skipped around them)
  const PORTAL_A = 5.5 * SEC_W;                              // grey-wedge centre angle
  const portalPos = { x: Math.cos(PORTAL_A) * 30, z: Math.sin(PORTAL_A) * 30 };
  const voxelPos = { x: Math.cos(2.5 * SEC_W) * 10, z: Math.sin(2.5 * SEC_W) * 10 };
  const clear = [
    { ...portalPos, r: 6 }, { ...voxelPos, r: 4.5 },
  ];

  // ===== THE POLAR SCAN-GRID — every structure on a (ring, spoke) cell ==========
  // Shared materials per (sector, band) so the segmenter sweep can flash a whole
  // sector by touching ~6 materials, and radial chroma fades bodies to grey rim.
  const _c1 = new THREE.Color(), _c2 = new THREE.Color(GREY);
  const sectorMats = SECTORS.map((sec, si) => RINGS.map((_, k) => {
    if (!sec) return new THREE.MeshStandardMaterial({
      color: GREY, flatShading: true, roughness: 0.85 });
    _c1.set(sec.body).lerp(_c2, (k / 5) * 0.55);   // desaturate toward the raw rim
    return new THREE.MeshStandardMaterial({
      color: _c1.clone(), flatShading: true, roughness: 0.8,
      emissive: sec.accent, emissiveIntensity: 0.12,   // anti-crush emissive floor
    });
  }));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const labelTowers = [];          // vivid inner towers → the 'clustering' note anchor

  for (let k = 0; k < RINGS.length; k++) {
    const r = RINGS[k];
    const n = Math.round((Math.PI * 2 * r) / 3.4);
    for (let j = 0; j < n; j++) {
      const th = (j / n) * Math.PI * 2;
      const sf = (th % SEC_W) / SEC_W;
      if (sf < 0.035 || sf > 0.965) continue;              // gutter avenues
      const x = Math.cos(th) * r, z = Math.sin(th) * r;
      if (clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
      const occ = 0.5 + 0.5 * sim.fbm(x * 0.06, z * 0.06, { octaves: 3 });
      if (occ < OCC_T[k]) continue;                        // empty lot / plaza

      const si = Math.floor(th / SEC_W) % 8;
      const sec = SECTORS[si];
      const h = BAND_H[k] * (0.8 + 0.4 * (0.5 + 0.5 * sim.noise2D(x * 0.1, z * 0.1)));

      if (sec && k <= 1) {
        // LABELS downtown: solid, tall, saturated (persistent .toaster.npy)
        const m = new THREE.Mesh(boxGeo, sectorMats[si][k]);
        m.scale.set(2.6, h, 2.2); m.position.set(x, h / 2, z); m.rotation.y = -th;
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
        if (si === 0 || si === 1) labelTowers.push(m);   // → 'clustering' anchors
      } else if (sec && k <= 3) {
        // GROUPING mid-ring: a SOLID object wearing its neon annotation bounding
        // box — literally what the tool draws around a segmented cluster. (The old
        // hollow scaffolds read as unexplained transparency.)
        const m = new THREE.Mesh(boxGeo, sectorMats[si][k]);
        m.scale.set(2.2, h * 0.8, 1.9); m.position.set(x, h * 0.4, z); m.rotation.y = -th;
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
        const wb = wireBox(2.8, h * 0.8 + 0.7, 2.5, sec.accent, { opacity: 0.6, fill: false });
        wb.position.set(x, h * 0.4 + 0.1, z); wb.rotation.y = -th;
        g.add(wb);
      } else {
        // NOISE rim + the whole grey wedge: plain raw mounds with NO annotation
        // boxes — unlabelled data, the visual "before" of the segmenter pass.
        const m = new THREE.Mesh(boxGeo, sectorMats[sec ? si : 5][Math.max(k, 4)]);
        m.scale.set(2.4, h, 2.0); m.position.set(x, h / 2, z); m.rotation.y = -th;
        m.receiveShadow = true;
        g.add(m);
      }
    }
  }

  // ===== ground scan-rings (TURBO by radius) + radial spokes ====================
  const ringMeshes = [];
  [...RINGS, 48].forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.14, 6, 72),
      new THREE.MeshStandardMaterial({ color: TURBO[i], emissive: TURBO[i], emissiveIntensity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    g.add(ring); ringMeshes.push(ring);
  });
  for (let s = 0; s < 8; s++) {
    const a = s * SEC_W;                                    // spoke on each sector boundary
    const sp = box(40, 0.06, 0.22, CYAN, { emissive: CYAN, emissiveIntensity: 0.5, cast: false, receive: false });
    sp.position.set(Math.cos(a) * 26, 0.07, Math.sin(a) * 26);
    sp.rotation.y = -a;
    g.add(sp);
  }

  // ===== HERO: the SENSOR-TOASTER spire at the exact origin =====================
  const hero = new THREE.Group(); g.add(hero); tagPOI(hero, 'stage');
  hero.add(cyl(2.0, 3.0, 18, CHROME, 14, { pos: [0, 9, 0], metalness: 0.55, roughness: 0.3, flat: true }));
  // spinning drum with the red scan-slit that casts the sweep
  const drum = new THREE.Group(); drum.position.y = 20; hero.add(drum);
  drum.add(cyl(2.6, 2.6, 3.2, 0x9aa4ac, 16, { metalness: 0.5, roughness: 0.35 }));
  const slit = box(0.3, 2.4, 0.5, RED, { pos: [2.55, 0, 0], emissive: RED, emissiveIntensity: 2.6, cast: false });
  drum.add(slit);
  // the rotating segmenter sweep — a translucent radial wedge sweeping the city
  const sweepPivot = new THREE.Group(); sweepPivot.position.y = 7; hero.add(sweepPivot);
  const sweep = glow(46, 13, CYAN, 1.2);
  sweep.material.transparent = true; sweep.material.opacity = 0.10;
  sweep.position.set(23, 0, 0); sweep.rotation.y = Math.PI / 2;
  sweepPivot.add(sweep);
  // two toast slabs springing from the top on a heartbeat
  const toasts = [];
  for (const dz of [-0.9, 0.9]) {
    const tst = box(2.6, 2.4, 0.6, TOAST, { pos: [0, 22.6, dz], emissive: 0x3a2a10, emissiveIntensity: 0.5 });
    hero.add(tst); toasts.push(tst);
    hero.add(box(3.0, 0.3, 0.9, RED, { pos: [0, 21.7, dz], emissive: RED, emissiveIntensity: 1.6, cast: false }));
  }
  // heating strips around the base + TURBO gauge up the mast + rooftop beacon
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const st = strip(4.2, RED, 0.3, 2);
    st.position.set(Math.cos(a) * 3.6, 0.7, Math.sin(a) * 3.6); st.rotation.y = -a + Math.PI / 2;
    g.add(st);
  }
  [0x3b6fe0, 0x44aa99, 0xddcc77, 0xe10600].forEach((c, i) => {
    hero.add(box(0.5, 2.6, 0.18, c, { pos: [1.6 + (i > 1 ? 0.35 : 0.2) * 0, 4 + i * 3.4, 1.9], emissive: c, emissiveIntensity: 1.1, cast: false }));
  });
  const beacon = box(0.8, 0.8, 0.8, CYAN, { pos: [0, 24.6, 0], emissive: CYAN, emissiveIntensity: 2.2, cast: false });
  hero.add(beacon);
  // raw points about to be toasted: a breathing halo of palette-coloured cubes
  const halo = pointCloud(
    SECTORS.filter(Boolean).slice(0, 5).map((s, i) => ({
      cx: Math.cos(i * 1.26) * 2.4, cz: Math.sin(i * 1.26) * 2.4,
      color: s.accent, n: 10, spread: 1.1, y: 0 })),
    { size: 0.22 });
  halo.position.y = 27; hero.add(halo);

  // ===== THE VOXEL BLOCK — the tool's second selection mode, made geometry ======
  const voxels = new THREE.Group(); voxels.position.set(voxelPos.x, 0, voxelPos.z);
  for (let vi = 0; vi < 3; vi++) for (let vj = 0; vj < 3; vj++) for (let vk = 0; vk < 2; vk++) {
    const wb = wireBox(1.5, 1.5, 1.5, RED, { opacity: 0.75, fillOpacity: 0.2 });
    wb.position.set((vi - 1) * 1.6, 0.85 + vk * 1.6, (vj - 1) * 1.6);
    voxels.add(wb);
  }
  g.add(voxels);

  // POI wiring: the voxel block IS the selection-modes note ('landmark': point /
  // box / voxel), and the vivid label districts carry the segmenters note.
  tagPOI(voxels, 'landmark');
  for (const m of labelTowers) tagPOI(m, 'clustering');

  // ===== the click-to-label rubber-band (box-select that stays drawn) ===========
  const band = wireBox(3.6, 4.2, 3.2, RED, { opacity: 0.9, fillOpacity: 0.06 });
  g.add(band);
  const bandSpots = SECTORS.map((s, i) => ({
    x: Math.cos((i + 0.5) * SEC_W) * 9.5, z: Math.sin((i + 0.5) * SEC_W) * 9.5,
  }));

  // ===== toasting conveyor: grey point-blobs drift in, pop to colour ============
  const runners = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * 2 + 1) * SEC_W;
    const pc = pointCloud([{ cx: 0, cz: 0, color: 0x9aa2ad, n: 12, spread: 0.8, y: 0.6 }], { size: 0.2 });
    g.add(pc);
    runners.push({ pc, a, mat: pc.children[0].material, off: i * 0.25,
      accent: (SECTORS[Math.floor(a / SEC_W) % 8] || { accent: GREY }).accent });
  }

  // ===== POI beacons (existing content ids stay wired) ==========================
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); g.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('stage', '#33d6ff', 0, 31, 0);
  // segmenters note floats over the cyan/teal LABELS district (what they produce)
  addBeacon('clustering', '#88ccee', Math.cos(SEC_W) * 10, 18, Math.sin(SEC_W) * 10);
  // selection-modes note over the voxel block
  addBeacon('landmark', '#e10600', voxelPos.x, 8, voxelPos.z);

  // ===== portal — parked in the grey wedge's clear rim lot ======================
  const portal = makePortal('#e10600');
  portal.group.position.set(portalPos.x, 0, portalPos.z); g.add(portal.group);

  const label = makeLabel('Toaster', '3D Annotation', '#e10600');
  label.sprite.position.set(0, 40, 0); g.add(label.sprite);

  tagPickable(g, 'toaster');

  return {
    group: g, label,
    frame: { target: [0, 8, 0], azimuth: 0.6, polar: 57, radius: 64 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);

      // the segmenter sweep + label-flash: sectors light up as the beam crosses them
      const beam = -t * 0.35;
      sweepPivot.rotation.y = beam;
      drum.rotation.y = beam;
      for (let si = 0; si < 8; si++) {
        if (!SECTORS[si]) continue;
        // angular distance from the beam to this sector's centre (wrapped)
        let d = (((si + 0.5) * SEC_W) - (-beam % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        const f = Math.max(0, 1 - Math.abs(d) / 0.55);
        for (let k = 0; k <= 1; k++) sectorMats[si][k].emissiveIntensity = 0.12 + 0.85 * f;
      }
      // scan-ring ping rippling outward from the origin
      for (let i = 0; i < ringMeshes.length; i++) {
        ringMeshes[i].material.emissiveIntensity = 0.55 + 0.8 * Math.max(0, Math.sin(t * 1.4 - i * 0.9));
      }
      // toast heartbeat (~6s)
      const spring = Math.max(0, Math.sin((t % 6) / 6 * Math.PI * 2 - Math.PI / 2));
      for (const tst of toasts) tst.position.y = 22.6 + spring * 1.6;
      // raw-point halo breathes + counter-rotates
      halo.rotation.y = -t * 0.3;
      halo.position.y = 27 + Math.sin(t * 0.8) * 0.5;
      // grey blobs march inward and pop to their sector colour at the heating ring
      for (const rn of runners) {
        const f = 1 - ((t * 0.05 + rn.off) % 1);           // 1 → 0 (rim → core)
        const r = 6 + f * 38;
        rn.pc.position.set(Math.cos(rn.a) * r, 0, Math.sin(rn.a) * r);
        rn.mat.color.set(r < 12 ? rn.accent : 0x9aa2ad);
      }
      // the rubber-band select hops district to district
      const spot = bandSpots[Math.floor(t / 4) % 8];
      band.position.set(spot.x, 2.1, spot.z);
      band.material.opacity = 0.55 + Math.abs(Math.sin(t * 2.6)) * 0.4;
      beacon.material.emissiveIntensity = 1.6 + Math.sin(t * 2.4) * 0.7;
      slit.material.emissiveIntensity = 2.0 + Math.sin(t * 6) * 0.8;
    },
  };
}

// slate platform — lifted toward warm grey so it sits WITH the terrain instead of
// punching a black hole in it (the city fabric covers most of it anyway)
function platformSlate(radius) {
  const geo = new THREE.CylinderGeometry(radius, radius + 1.5, 1.4, 26);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3f49, flatShading: true, roughness: 0.95 });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -0.56;
  m.receiveShadow = true;
  return m;
}
