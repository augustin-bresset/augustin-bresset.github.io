// toaster.js — Toaster: a 3D LiDAR point-cloud ANNOTATION tool.
// "THE SCAN": the whole city is ONE lidar frame seen from inside. A chrome
// sensor-toaster spire stands at the exact origin; the city radiates from it on a
// POLAR SCAN-GRID (concentric rings × radial spokes — zero random placement, every
// façade faces the sensor). The city is DARK GREY, raw, unlabeled — and as the
// segmenter sweep passes, RED NEON OUTLINES flare around the buildings it crosses
// (the annotation bounding boxes igniting), then fade: one-click labeling performed
// on loop, in the tool's brutalist charcoal-and-red identity. One full sector never
// lights up (group_id = −1, not yet labelled) and hides the portal monolith.
import * as THREE from 'three';
import { box, cyl, glow, strip, wireBox, pointCloud, makeLabel, makeWallPortal, poiBeacon, tagPOI, tagPickable } from './kit.js';
import { Simplex } from '../gen/noise.js';

const WEDGE = 5;                              // the never-labelled sector (hosts the portal)
const GREY_IN = 0x454c56, GREY_OUT = 0x30353d;
const RED = 0xe10600, TOAST = 0xcaa15a, CHROME = 0xb8c0c8, STEELG = 0x8a94a2;
// ground scan-rings: hot red core cooling to slate at the rim
const RING_COLS = [0xe10600, 0xc22417, 0x9a3226, 0x6f3a33, 0x54423f, 0x3f4550, 0x37404c];

const RINGS = [7, 12, 18, 25, 33, 42];        // ring-band radii (widen like scan returns)
const BAND_H = [17, 12.5, 10, 7.5, 5, 3];     // ziggurat: height steps DOWN outward
const OCC_T = [0.1, 0.15, 0.22, 0.3, 0.38, 0.44]; // occupancy threshold rises outward
const SEC_W = (Math.PI * 2) / 8;

export function build() {
  const g = new THREE.Group();
  const sim = new Simplex(22);

  // no platform: the terrain itself is tinted slate under the city (terrain.js
  // fusion zone) and lightly flattened — the scan-grid sits on the land.

  // landmark spots (grid cells are skipped around them)
  const voxelPos = { x: Math.cos(2.5 * SEC_W) * 10, z: Math.sin(2.5 * SEC_W) * 10 };
  const clear = [
    { ...voxelPos, r: 4.5 },
  ];

  // ===== THE POLAR SCAN-GRID — dark raw city, red outlines waiting to ignite ====
  // Buildings share ONE grey material per ring band (value fades outward: raw data
  // gets darker at the rim). Each sector owns ONE red outline material: the sweep
  // flashes a whole sector by touching a single opacity.
  const _c1 = new THREE.Color(), _cin = new THREE.Color(GREY_IN), _cout = new THREE.Color(GREY_OUT);
  const bandMats = RINGS.map((_, k) => {
    _c1.copy(_cin).lerp(_cout, k / 5);
    return new THREE.MeshStandardMaterial({
      color: _c1.clone(), flatShading: true, roughness: 0.8,
      emissive: 0x39404a, emissiveIntensity: 0.18,     // anti-crush slate floor
    });
  });
  const outlineMats = [];                              // per-sector shared red neon
  for (let si = 0; si < 8; si++) {
    outlineMats.push(new THREE.LineBasicMaterial({
      color: RED, transparent: true, opacity: 0.05, depthWrite: false,
    }));
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const unitEdges = new THREE.EdgesGeometry(boxGeo);
  const labelTowers = [];          // vivid inner towers → the 'clustering' note anchor

  for (let k = 0; k < RINGS.length; k++) {
    const r = RINGS[k];
    const n = Math.round((Math.PI * 2 * r) / 3.15);
    for (let j = 0; j < n; j++) {
      const th = (j / n) * Math.PI * 2;
      const sf = (th % SEC_W) / SEC_W;
      if (sf < 0.035 || sf > 0.965) continue;              // gutter avenues
      const x = Math.cos(th) * r, z = Math.sin(th) * r;
      if (clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
      const occ = 0.5 + 0.5 * sim.fbm(x * 0.06, z * 0.06, { octaves: 3 });
      if (occ < OCC_T[k]) continue;                        // empty lot / plaza

      const si = Math.floor(th / SEC_W) % 8;
      const h = BAND_H[k] * (0.8 + 0.4 * (0.5 + 0.5 * sim.noise2D(x * 0.1, z * 0.1)));
      const w = k <= 1 ? 2.9 : k <= 3 ? 2.6 : 2.7;
      const d = k <= 1 ? 2.5 : k <= 3 ? 2.2 : 2.3;
      const hh = k <= 3 && k >= 2 ? h * 0.8 : h;

      const m = new THREE.Mesh(boxGeo, bandMats[k]);
      m.scale.set(w, hh, d); m.position.set(x, hh / 2, z); m.rotation.y = -th;
      m.castShadow = k <= 3; m.receiveShadow = true;
      g.add(m);
      if (si <= 1 && k <= 1) labelTowers.push(m);          // → 'clustering' anchors

      // the red annotation outline, dormant until the sweep ignites its sector.
      // The grey wedge NEVER gets one — its data is still group_id = −1.
      if (si !== WEDGE && k <= 3) {
        const ol = new THREE.LineSegments(unitEdges, outlineMats[si]);
        ol.scale.set(w + 0.5, hh + 0.5, d + 0.5);
        ol.position.set(x, hh / 2 + 0.05, z); ol.rotation.y = -th;
        g.add(ol);
      }
    }
  }

  // ===== ground scan-rings (red → slate by radius) + radial spokes ==============
  const ringMeshes = [];
  [...RINGS, 48].forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.14, 6, 72),
      new THREE.MeshStandardMaterial({ color: RING_COLS[i], emissive: RING_COLS[i], emissiveIntensity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    g.add(ring); ringMeshes.push(ring);
  });
  for (let s = 0; s < 8; s++) {
    const a = s * SEC_W;                                    // spoke on each sector boundary
    const sp = box(40, 0.06, 0.22, STEELG, { emissive: STEELG, emissiveIntensity: 0.35, cast: false, receive: false });
    sp.position.set(Math.cos(a) * 26, 0.07, Math.sin(a) * 26);
    sp.rotation.y = -a;
    g.add(sp);
  }

  // ===== HERO: the SENSOR-TOASTER spire at the exact origin =====================
  const hero = new THREE.Group(); hero.scale.setScalar(1.25); g.add(hero); tagPOI(hero, 'stage');
  hero.add(cyl(2.0, 3.0, 18, CHROME, 14, { pos: [0, 9, 0], metalness: 0.55, roughness: 0.3, flat: true }));
  // spinning drum with the red scan-slit that casts the sweep
  const drum = new THREE.Group(); drum.position.y = 20; hero.add(drum);
  drum.add(cyl(2.6, 2.6, 3.2, 0x9aa4ac, 16, { metalness: 0.5, roughness: 0.35 }));
  const slit = box(0.3, 2.4, 0.5, RED, { pos: [2.55, 0, 0], emissive: RED, emissiveIntensity: 2.6, cast: false });
  drum.add(slit);
  // the rotating segmenter sweep — a translucent RED blade sweeping the city
  const sweepPivot = new THREE.Group(); sweepPivot.position.y = 7; hero.add(sweepPivot);
  const sweep = glow(46, 13, 0xff3b2e, 1.2);
  sweep.material.transparent = true; sweep.material.opacity = 0.1;
  sweep.position.set(23, 0, 0); sweep.rotation.y = Math.PI / 2;
  sweepPivot.add(sweep);
  // the two toast slabs, as before — but the -z one stays popped and carries THE
  // PORTAL: a window cut straight into the slice. Just the two rectangles.
  const toasts = [];
  {
    const tst = box(5.6, 5, 0.7, TOAST, { pos: [0, 23.6, 1.0], emissive: 0x3a2a10, emissiveIntensity: 0.5 });
    hero.add(tst); toasts.push(tst);
  }
  const portalSlab = box(5.6, 5, 0.7, TOAST, { pos: [0, 23.9, -1.0], emissive: 0x3a2a10, emissiveIntensity: 0.5 });
  hero.add(portalSlab);
  for (const dz of [-1.0, 1.0]) {
    hero.add(box(6.0, 0.3, 0.9, RED, { pos: [0, 21.7, dz], emissive: RED, emissiveIntensity: 1.6, cast: false }));
  }
  const portal = makeWallPortal('#e10600', 5.0, 4.2);
  portal.group.position.set(0, 21.6, -1.36);
  portal.group.rotation.y = Math.PI;            // the window faces OUT, away from the drum
  hero.add(portal.group);
  // heating strips around the base + red gauge up the mast + rooftop beacon
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const st = strip(4.2, RED, 0.3, 2);
    st.position.set(Math.cos(a) * 3.6, 0.7, Math.sin(a) * 3.6); st.rotation.y = -a + Math.PI / 2;
    g.add(st);
  }
  [0x54423f, 0x9a3226, 0xc22417, 0xe10600].forEach((c, i) => {
    hero.add(box(0.5, 2.6, 0.18, c, { pos: [1.6, 4 + i * 3.4, 1.9], emissive: c, emissiveIntensity: 1.1, cast: false }));
  });
  const beacon = box(0.8, 0.8, 0.8, RED, { pos: [0, 24.6, 0], emissive: RED, emissiveIntensity: 2.2, cast: false });
  hero.add(beacon);
  // raw points about to be toasted: greys with a few already-red sparks
  const halo = pointCloud([
    { cx: -1.8, cz: 0.8, color: 0x8a94a2, n: 14, spread: 1.3, y: 0 },
    { cx: 1.6, cz: -1.2, color: 0x6f7884, n: 12, spread: 1.1, y: 0.3 },
    { cx: 0.4, cz: 1.8, color: RED, n: 8, spread: 0.9, y: -0.2 },
  ], { size: 0.22 });
  halo.position.y = 27; hero.add(halo);

  // ===== THE VOXEL BLOCK — the tool's second selection mode, made geometry ======
  const voxels = new THREE.Group(); voxels.position.set(voxelPos.x, 0, voxelPos.z);
  for (let vi = 0; vi < 3; vi++) for (let vj = 0; vj < 3; vj++) for (let vk = 0; vk < 2; vk++) {
    const wb = wireBox(1.5, 1.5, 1.5, RED, { opacity: 0.75, fillOpacity: 0.2 });
    wb.position.set((vi - 1) * 1.6, 0.85 + vk * 1.6, (vj - 1) * 1.6);
    voxels.add(wb);
  }
  g.add(voxels);
  tagPOI(voxels, 'landmark');
  for (const m of labelTowers) tagPOI(m, 'clustering');

  // ===== the click-to-label rubber-band (box-select that stays drawn) ===========
  const band = wireBox(3.6, 4.2, 3.2, RED, { opacity: 0.9, fillOpacity: 0.06 });
  g.add(band);
  const bandSpots = [];
  for (let i = 0; i < 8; i++) {
    bandSpots.push({ x: Math.cos((i + 0.5) * SEC_W) * 9.5, z: Math.sin((i + 0.5) * SEC_W) * 9.5 });
  }

  // ===== toasting conveyor: grey point-blobs drift in, pop to RED ===============
  const runners = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * 2 + 1) * SEC_W;
    const pc = pointCloud([{ cx: 0, cz: 0, color: 0x9aa2ad, n: 12, spread: 0.8, y: 0.6 }], { size: 0.2 });
    g.add(pc);
    runners.push({ pc, a, mat: pc.children[0].material, off: i * 0.25 });
  }

  // ===== POI beacons (existing content ids stay wired) ==========================
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); g.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('stage', '#33d6ff', 0, 36, 0);
  addBeacon('clustering', '#e10600', Math.cos(SEC_W) * 10, 22, Math.sin(SEC_W) * 10);
  addBeacon('landmark', '#ff8a3c', voxelPos.x, 8, voxelPos.z);


  const label = makeLabel('Toaster', '3D Annotation', '#e10600');
  label.sprite.position.set(0, 44, 0); g.add(label.sprite);

  tagPickable(g, 'toaster');

  return {
    group: g, label,
    frame: { target: [0, 11, 0], azimuth: 0.6, polar: 57, radius: 80 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);

      // the segmenter sweep: as the red blade crosses a sector, that sector's neon
      // outlines IGNITE around its buildings, then decay behind the beam
      const beam = -t * 0.35;
      sweepPivot.rotation.y = beam;
      drum.rotation.y = beam;
      for (let si = 0; si < 8; si++) {
        if (si === WEDGE) continue;
        let dAng = (((si + 0.5) * SEC_W) - (-beam % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        const f = Math.max(0, 1 - Math.abs(dAng) / 0.6);
        outlineMats[si].opacity = 0.05 + 0.9 * f;
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
      // grey blobs march inward and pop RED at the heating ring (labelled!)
      for (const rn of runners) {
        const f = 1 - ((t * 0.05 + rn.off) % 1);           // 1 → 0 (rim → core)
        const r = 6 + f * 38;
        rn.pc.position.set(Math.cos(rn.a) * r, 0, Math.sin(rn.a) * r);
        rn.mat.color.set(r < 12 ? RED : 0x9aa2ad);
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

