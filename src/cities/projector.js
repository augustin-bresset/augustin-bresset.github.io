// projector.js — Projector: a viewer that REPLAYS multi-sensor robotics sequences.
// "THE PREMIERE": an Art Deco cinema palace at Hollywood-hills scale — the pun is
// literal, a data-PROJECTOR reads as a movie PROJECTOR. A stepped ziggurat marquee
// tower with a chasing-bulb canopy and sunburst pediment stands at the head of a red
// carpet; across the plaza a triple-bill proscenium shows the tool's own parallel
// views (3D cloud hologram · 2D camera reel · BEV grid) exactly as the app renders
// them. A critics' booth spins a green/red reel pair for the confusion metric (the
// v1 headline feature). Four klieg search-light towers flank the carpet, gimballed
// beams sweeping the sky in slow, uneven crossing arcs.
import * as THREE from 'three';
import { box, cyl, glow, pointCloud, makeLabel, makeWallPortal, poiBeacon, tagPOI, tagPickable } from './kit.js';

const GOLD = 0xd4af37, GOLD_HI = 0xf6dd8c;
const ONYX = 0x211c28, ONYX_LO = 0x171420;
const CREAM = 0xe9ddc0;
const SCREEN_DARK = 0x0b0d12;
const RED = 0xc81e3a, GREEN = 0x3ee08a;
const CYAN = 0x6fe0ff, VIOLET = 0x9a7bff;
const BEV_RAMP = [0x1c2b57, 0x27508f, 0x3d84c4, 0x74c4e8];

export function build() {
  const g = new THREE.Group();

  // ===== THE PALACE — stepped Art Deco marquee tower at the origin ==============
  const hero = new THREE.Group(); g.add(hero); tagPOI(hero, 'marquee');
  const LEVELS = [
    { r: 9.0, h: 6.0, y: 3.0,  c: ONYX },
    { r: 7.2, h: 5.0, y: 8.7,  c: ONYX_LO },
    { r: 5.6, h: 5.0, y: 13.9, c: ONYX },
    { r: 4.1, h: 5.0, y: 19.2, c: ONYX_LO },
    { r: 2.7, h: 5.5, y: 24.9, c: ONYX },
  ];
  for (const lv of LEVELS) hero.add(cyl(lv.r, lv.r, lv.h, lv.c, 8, { pos: [0, lv.y, 0], roughness: 0.75 }));
  hero.add(cyl(0.3, 2.5, 6.6, ONYX_LO, 8, { pos: [0, 31.0, 0], roughness: 0.6 })); // spire

  // fluted gold fins on the three lowest, most-visible drums
  for (const lv of LEVELS.slice(0, 3)) {
    for (let k = 0; k < 8; k++) {
      const a = k * (Math.PI / 4);
      hero.add(box(0.22, lv.h * 0.86, 0.22, GOLD, {
        pos: [Math.cos(a) * (lv.r + 0.16), lv.y, Math.sin(a) * (lv.r + 0.16)],
        emissive: GOLD, emissiveIntensity: 1.1, cast: false, receive: false,
      }));
    }
  }

  // rooftop film reel, spinning
  const reelTop = new THREE.Group(); reelTop.position.set(0, 35.0, 0); hero.add(reelTop);
  reelTop.add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 6, 20),
    new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 1.6 })));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = box(1.5, 0.14, 0.14, GOLD, { pos: [Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0], emissive: GOLD, emissiveIntensity: 1.2, cast: false });
    spoke.rotation.z = a; reelTop.add(spoke);
  }

  // sunburst pediment fanning above the entrance (+Z face of the base drum)
  const sunburst = new THREE.Group(); hero.add(sunburst);
  for (let i = -4; i <= 4; i++) {
    const a = i * 0.19, len = 4.2 - Math.abs(i) * 0.16;
    const rod = box(len, 0.16, 0.16, GOLD, { emissive: GOLD, emissiveIntensity: 1.5, cast: false, receive: false });
    rod.position.set(Math.sin(a) * len / 2, 6.4 + Math.cos(a) * len / 2, 9.35);
    rod.rotation.z = Math.PI / 2 - a;
    sunburst.add(rod);
  }

  // canopy over the entrance, glowing warm underside
  hero.add(box(12.8, 0.55, 2.6, CREAM, { pos: [0, 6.0, 10.6], roughness: 0.6 }));
  const underglow = glow(12.2, 2.3, GOLD_HI, 1.0);
  underglow.rotation.x = Math.PI / 2; underglow.position.set(0, 5.68, 10.6);
  underglow.material.transparent = true; underglow.material.opacity = 0.55;
  hero.add(underglow);

  // two rows of chasing marquee bulbs along the canopy's leading edge
  const bulbs = [];
  for (const row of [{ y: 6.35, dir: 1 }, { y: 5.72, dir: -1 }]) {
    for (let i = 0; i < 15; i++) {
      const x = -6.3 + (i / 14) * 12.6;
      const b = box(0.22, 0.22, 0.22, GOLD, { pos: [x, row.y, 11.85], emissive: GOLD, emissiveIntensity: 1, cast: false, receive: false });
      hero.add(b); bulbs.push({ m: b.material, i, dir: row.dir });
    }
  }

  // entrance doors, flanked by pilasters
  hero.add(box(3.2, 4.2, 0.4, ONYX_LO, { pos: [0, 2.1, 9.2], emissive: 0x0c0a12, emissiveIntensity: 0.3 }));
  for (const dx of [-2.0, 2.0]) hero.add(box(0.6, 4.6, 0.7, GOLD, { pos: [dx, 2.3, 9.2], emissive: GOLD, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.4 }));

  const label = makeLabel('Projector', 'Multi-Sensor Replay', '#d4af37');
  label.sprite.position.set(0, 41, 0); hero.add(label.sprite);

  // ===== the stage door — backstage, tucked behind the tower =====================
  const portal = makeWallPortal('#d4af37', 5.2, 4.4);
  portal.group.position.set(0, 0, -9.4);
  portal.group.rotation.y = Math.PI;
  hero.add(portal.group);

  // ===== THE METROPOLIS SKYLINE — a brooding backdrop behind the tower ==========
  // a handful of window-slit Art Deco towers looming behind the palace (the old
  // Fritz Lang silhouette the marquee could be playing footage of), one elevated
  // sky-bridge slung between the two tallest with light-pulses crossing it. Warm
  // graphite stone, not black monoliths — banded setbacks, corner fluting and a
  // stepped brass crown on each, echoing the palace's own vocabulary at a distance.
  const SKY_COL = [0x4b4550, 0x554c50, 0x413b46];
  const SKY_BAND = 0xc9b98f;    // pale stone banding at each tier setback
  const SKY_BRASS = 0x9c8a5a;   // dulled brass fluting/crown — quieter than the palace's gold
  const SKYLINE = [
    { x: -21, z: -23, w: 5.5, d: 5.5, h: 21, tiers: 2 },
    { x: -11, z: -30, w: 6.5, d: 6.0, h: 29, tiers: 3 },
    { x: 1,   z: -34, w: 5.0, d: 5.0, h: 18, tiers: 2 },
    { x: 11,  z: -29, w: 7.0, d: 6.5, h: 33, tiers: 3 },
    { x: 21,  z: -22, w: 5.5, d: 5.0, h: 23, tiers: 2 },
  ];
  const skyline = new THREE.Group(); g.add(skyline);
  SKYLINE.forEach((tw, ti) => {
    const grp = new THREE.Group(); grp.position.set(tw.x, 0, tw.z); skyline.add(grp);
    const col = SKY_COL[ti % SKY_COL.length];
    let y = 0;
    for (let k = 0; k < tw.tiers; k++) {
      const f = 1 - k * 0.3;
      const th = tw.h * (k === 0 ? 0.55 : k === 1 ? 0.3 : 0.15);
      if (k > 0) grp.add(box(tw.w * (1 - (k - 1) * 0.3) * 1.04, 0.22, tw.d * (1 - (k - 1) * 0.3) * 1.04, SKY_BAND, { pos: [0, y, 0], roughness: 0.6 }));
      grp.add(box(tw.w * f, th, tw.d * f, col, { pos: [0, y + th / 2, 0], roughness: 0.8 }));
      if (k === 0) {
        // corner fluting on the tallest, most-visible base tier
        const hw = tw.w * f / 2, hd = tw.d * f / 2;
        for (const [fx, fz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
          grp.add(box(0.16, th * 0.86, 0.16, SKY_BRASS, {
            pos: [fx, y + th / 2, fz], emissive: SKY_BRASS, emissiveIntensity: 0.45, cast: false, receive: false,
          }));
        }
      }
      y += th;
    }
    // stepped brass crown
    grp.add(box(tw.w * 0.34, 0.5, tw.d * 0.34, SKY_BRASS, { pos: [0, y + 0.25, 0], emissive: SKY_BRASS, emissiveIntensity: 0.5, cast: false }));
    grp.add(box(tw.w * 0.18, 0.45, tw.d * 0.18, SKY_BRASS, { pos: [0, y + 0.7, 0], emissive: SKY_BRASS, emissiveIntensity: 0.5, cast: false }));
    // sparse deterministic grid of tiny lit windows on the +Z face
    for (let r = 0; r < Math.floor((tw.h * 0.82) / 3.2); r++) {
      for (let c = -1; c <= 1; c++) {
        if ((r * 7 + (c + 1) * 5 + ti * 3) % 4 !== 0) continue;
        grp.add(box(0.5, 1.0, 0.14, 0xf3d38a, {
          pos: [c * (tw.w * 0.28), 1.6 + r * 3.2, tw.d / 2 + 0.04],
          emissive: 0xf3d38a, emissiveIntensity: 1.1, cast: false, receive: false,
        }));
      }
    }
  });
  // the sky-bridge, slung between the two tallest towers
  const [T1, T3] = [SKYLINE[1], SKYLINE[3]];
  const bLen = Math.hypot(T3.x - T1.x, T3.z - T1.z);
  const bAng = Math.atan2(T3.z - T1.z, T3.x - T1.x);
  const bridge = new THREE.Group();
  bridge.position.set((T1.x + T3.x) / 2, T1.h * 0.85 + 1.6, (T1.z + T3.z) / 2);
  bridge.rotation.y = -bAng;
  skyline.add(bridge);
  bridge.add(box(bLen, 0.32, 1.1, 0x1a1a22, { roughness: 0.75 }));
  for (const dz of [-0.55, 0.55]) bridge.add(box(bLen, 0.85, 0.08, 0x2a2a34, { pos: [0, 0.6, dz], cast: false }));
  const bridgePulses = [];
  for (let i = 0; i < 3; i++) {
    const p = box(0.42, 0.2, 0.7, 0xf3d38a, { pos: [0, 0.36, 0], emissive: 0xf3d38a, emissiveIntensity: 1.7, cast: false, receive: false });
    bridge.add(p); bridgePulses.push({ m: p, off: i / 3 });
  }

  // ===== RED CARPET from the doors toward the triple bill ========================
  const carpet = glow(5.4, 20, RED, 1.0);
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.05, 19);
  carpet.material.transparent = true; carpet.material.opacity = 0.82;
  g.add(carpet);
  for (const z of [11, 15, 19, 23, 27]) for (const x of [-3.1, 3.1]) {
    g.add(cyl(0.14, 0.17, 1.3, GOLD, 8, { pos: [x, 0.65, z], roughness: 0.4, metalness: 0.5 }));
  }

  // ===== THE TRIPLE BILL — a shared proscenium wall, three screens ===============
  const screens = new THREE.Group(); screens.position.set(0, 0, 30); g.add(screens); tagPOI(screens, 'screens');
  // the dive/overview camera always approaches from the +Z/+X quadrant (see
  // camera.js's azimuth convention), so the content-bearing face is built facing
  // +Z and the whole wall is turned to present it toward the approach direction.
  screens.rotation.y = Math.PI;
  for (const x of [-6.5, 6.5]) screens.add(box(0.24, 7.2, 0.5, GOLD, { pos: [x, 3.6, 0], emissive: GOLD, emissiveIntensity: 0.7, cast: false }));
  const SCREEN_X = [-13, 0, 13];
  for (const sx of SCREEN_X) {
    screens.add(box(9.6, 6.6, 0.16, GOLD, { pos: [sx, 3.5, -0.1], emissive: GOLD, emissiveIntensity: 0.4, cast: false }));
    screens.add(box(9.2, 6.2, 0.3, CREAM, { pos: [sx, 3.5, 0], roughness: 0.6 }));
    screens.add(box(8.4, 5.4, 0.2, SCREEN_DARK, { pos: [sx, 3.4, -0.28], emissive: 0x05070a, emissiveIntensity: 0.4, cast: false }));
    // stepped Art Deco cornice above each screen
    screens.add(box(9.8, 0.4, 0.6, GOLD, { pos: [sx, 6.9, -0.1], emissive: GOLD, emissiveIntensity: 0.5, cast: false }));
    screens.add(box(8.4, 0.4, 0.6, CREAM, { pos: [sx, 7.3, -0.1], roughness: 0.6 }));
    screens.add(box(7.0, 0.4, 0.6, GOLD, { pos: [sx, 7.7, -0.1], emissive: GOLD, emissiveIntensity: 0.5, cast: false }));
  }

  // screen A (left): the 3D point-cloud hologram, beamed up in front of the panel
  const cloud = pointCloud([
    { cx: 0, cz: 0, color: CYAN, n: 60, spread: 2.9, y: 2.4 },
    { cx: 0.4, cz: -0.2, color: VIOLET, n: 22, spread: 1.7, y: 3.0 },
  ], { size: 0.16 });
  cloud.position.set(-13, 1.4, -0.55);
  screens.add(cloud);

  // screen B (middle): the camera feed — warm gradient + a scanning highlight bar
  const feed = glow(8.0, 5.0, 0xffb454, 1.1);
  feed.position.set(0, 3.4, -0.36); feed.material.transparent = true; feed.material.opacity = 0.5;
  screens.add(feed);
  const scanBar = box(8.0, 0.3, 0.05, 0xffe2b0, { pos: [0, 3.4, -0.4], emissive: 0xffe2b0, emissiveIntensity: 1.6, cast: false, receive: false });
  screens.add(scanBar);

  // screen C (right): the BEV grid — a small top-down raster, blue ramp
  const bevCells = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    const cx = 13 + (i - 2.5) * 0.62, cy = 3.4 + (j - 2.5) * 0.62;
    const d = Math.abs(i - 2.5) + Math.abs(j - 2.5);
    const col = BEV_RAMP[Math.min(BEV_RAMP.length - 1, Math.floor(d * 0.62))];
    const cell = box(0.5, 0.5, 0.1, col, { pos: [cx, cy, -0.4], emissive: col, emissiveIntensity: 0.9, cast: false, receive: false });
    screens.add(cell);
    bevCells.push({ m: cell.material, col: i });
  }

  // ===== THE CONFUSION BOOTH — green/red reel pair + a live equalizer ===========
  const booth = new THREE.Group(); booth.position.set(-27, 0, 15); g.add(booth); tagPOI(booth, 'booth');
  booth.add(box(4.4, 3.2, 3.4, CREAM, { pos: [0, 1.6, 0], roughness: 0.6 }));
  booth.add(box(5.2, 0.4, 3.9, GOLD, { pos: [0, 3.4, 0], emissive: GOLD, emissiveIntensity: 0.4, cast: false }));
  function reel(radius, color) {
    const rg = new THREE.Group();
    rg.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.11, 6, 18),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 })));
    const hub = cyl(0.16, 0.16, 0.14, 0x2a2a30, 8, { roughness: 0.4, metalness: 0.4 });
    hub.rotation.x = Math.PI / 2; rg.add(hub); // flat face toward the camera, like the ring
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const sp = box(radius * 1.5, 0.1, 0.1, color, { emissive: color, emissiveIntensity: 1.2, cast: false });
      sp.rotation.z = a; rg.add(sp);
    }
    return rg;
  }
  const reelGreen = reel(0.7, GREEN); reelGreen.position.set(-1.0, 2.4, 1.75); booth.add(reelGreen);
  const reelRed = reel(0.7, RED); reelRed.position.set(1.0, 2.4, 1.75); booth.add(reelRed);
  const eq = [];
  for (let i = 0; i < 5; i++) {
    const bar = box(0.28, 0.7, 0.18, GOLD_HI, { pos: [-0.9 + i * 0.45, 0.9, 1.78], emissive: GOLD_HI, emissiveIntensity: 1.2, cast: false, receive: false });
    booth.add(bar); eq.push({ m: bar, i });
  }

  // ===== KLIEG SEARCHLIGHTS — four gimballed towers sweeping the sky =============
  const TOWERS = [
    { x: -18, z: 3,  sp: 0.22,  base: 0.55, ts: 0.62, ph: 0.0 },
    { x: 18,  z: 3,  sp: -0.17, base: 0.62, ts: 0.51, ph: 1.7 },
    { x: -15, z: 27, sp: 0.19,  base: 0.5,  ts: 0.7,  ph: 3.1 },
    { x: 15,  z: 27, sp: -0.24, base: 0.66, ts: 0.55, ph: 4.4 },
  ];
  const klieg = [];
  for (const tw of TOWERS) {
    const mast = new THREE.Group(); mast.position.set(tw.x, 0, tw.z); g.add(mast); tagPOI(mast, 'lights');
    mast.add(cyl(0.42, 0.6, 7.2, 0x2b2a32, 8, { pos: [0, 3.6, 0], metalness: 0.4, roughness: 0.5 }));
    mast.add(cyl(1.0, 1.1, 1.1, 0x3a3a44, 8, { pos: [0, 7.4, 0], metalness: 0.6, roughness: 0.3 }));
    const az = new THREE.Group(); az.position.set(0, 7.9, 0); mast.add(az);
    const tilt = new THREE.Group(); az.add(tilt);
    const beamH = 46;
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 0.12, beamH, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: GOLD_HI, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.y = beamH / 2; tilt.add(cone);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, beamH, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff6df, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.y = beamH / 2; tilt.add(core);
    klieg.push({ az, tilt, tw });
  }

  // ===== POI beacons ==============================================================
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); g.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('marquee', '#d4af37', 0, 37, 0);
  addBeacon('screens', '#6fe0ff', 0, 9, 30);
  addBeacon('booth', '#3ee08a', -27, 6.5, 15);
  addBeacon('lights', '#f6dd8c', 18, 12, 3);

  tagPickable(g, 'projector');

  return {
    group: g, label,
    frame: { target: [0, 13, 5], azimuth: 0.4, polar: 57, radius: 68 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);

      reelTop.rotation.y = t * 0.4;
      sunburst.children.forEach((r, i) => { r.material.emissiveIntensity = 1.2 + Math.sin(t * 1.4 + i * 0.4) * 0.5; });

      // sky-bridge: light-pulses crossing between the two tallest skyline towers
      for (const p of bridgePulses) {
        const u = (t * 0.18 + p.off) % 1;
        p.m.position.x = -bLen / 2 + u * bLen;
        p.m.material.emissiveIntensity = 1.2 + Math.sin(u * Math.PI) * 1.2;
      }

      // marquee chase: a bright pulse runs along each row, opposite directions
      for (const b of bulbs) {
        const ph = ((b.i / 15) - t * 0.55 * b.dir + 10) % 1;
        b.m.emissiveIntensity = 0.5 + 1.6 * Math.pow(Math.max(0, Math.cos(ph * Math.PI * 2)), 5);
      }

      // screen A: the hologram slowly turns
      cloud.rotation.y = t * 0.25;
      // screen B: the reel scans up and down like a film-gate flicker
      scanBar.position.y = 3.4 + Math.sin(t * 0.9) * 2.1;
      feed.material.opacity = 0.4 + Math.sin(t * 2.1) * 0.08;
      // screen C: a bright column sweeps the BEV grid, column by column
      const sweepCol = Math.floor((t * 1.2) % 6);
      for (const c of bevCells) c.m.emissiveIntensity = c.col === sweepCol ? 2.1 : 0.85;

      // booth: reels spin at different speeds, equalizer bars bounce
      reelGreen.rotation.z = t * 1.1; reelRed.rotation.z = -t * 0.8;
      for (const e of eq) e.m.scale.y = 0.5 + 0.5 * Math.abs(Math.sin(t * (2.2 + e.i * 0.4) + e.i));

      // klieg lights: gimballed sweep, azimuth spin + tilt oscillation, uneven
      // phases so the beams cross the sky instead of moving in lockstep
      for (const k of klieg) {
        k.az.rotation.y = t * k.tw.sp + k.tw.ph;
        k.tilt.rotation.x = k.tw.base + Math.sin(t * k.tw.ts + k.tw.ph * 1.3) * 0.22;
      }
    },
  };
}
