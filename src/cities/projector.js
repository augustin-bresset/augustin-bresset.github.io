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
import { Fabric, GROUND } from './urban.js';

const GOLD = 0xd4af37, GOLD_HI = 0xf6dd8c;
const ONYX = 0x211c28, ONYX_LO = 0x171420;
const CREAM = 0xe9ddc0;
const SCREEN_DARK = 0x0b0d12;
const RED = 0xc81e3a, GREEN = 0x3ee08a;
const CYAN = 0x6fe0ff, VIOLET = 0x9a7bff;
const BEV_RAMP = [0x1c2b57, 0x27508f, 0x3d84c4, 0x74c4e8];

// ===== THE STUDIO GATE — two interchangeable builders (see GATE_STYLE in build())
// original: flanking fluted Art Deco pillars + a flat lintel band.
function buildGateArtDeco(wall, gp0, gp1, wallH) {
  for (const p of [gp0, gp1]) {
    wall.add(cyl(1.1, 1.3, wallH + 3.2, ONYX_LO, 8, { pos: [p.x, (wallH + 3.2) / 2, p.z], roughness: 0.75 }));
    for (let k = 0; k < 6; k++) {
      const a = k * (Math.PI / 3);
      wall.add(box(0.18, (wallH + 3.2) * 0.8, 0.18, GOLD, {
        pos: [p.x + Math.cos(a) * 1.15, (wallH + 3.2) / 2, p.z + Math.sin(a) * 1.15],
        emissive: GOLD, emissiveIntensity: 1.0, cast: false, receive: false,
      }));
    }
    wall.add(box(2.6, 0.5, 2.6, GOLD, { pos: [p.x, wallH + 3.45, p.z], emissive: GOLD, emissiveIntensity: 0.5, cast: false }));
  }
  const gateLen = Math.hypot(gp1.x - gp0.x, gp1.z - gp0.z);
  const gateAng = Math.atan2(gp1.x - gp0.x, gp1.z - gp0.z);
  const lintel = box(1.6, 1.0, gateLen, ONYX_LO, {
    pos: [(gp0.x + gp1.x) / 2, wallH + 3.6, (gp0.z + gp1.z) / 2], roughness: 0.75,
  });
  lintel.rotation.y = gateAng; wall.add(lintel);
  const lintelBand = box(1.8, 0.3, gateLen, GOLD, {
    pos: [(gp0.x + gp1.x) / 2, wallH + 4.25, (gp0.z + gp1.z) / 2], emissive: GOLD, emissiveIntensity: 0.5, cast: false,
  });
  lintelBand.rotation.y = gateAng; wall.add(lintelBand);
  return { spin: null };
}

// new default: a grand rounded arch + a spinning globe at the apex — the SHAPE
// language of the Universal Studios gate (arch + rotating Earth), built from a
// plain sphere and perpendicular ring struts rather than any copied logo art.
function buildGateUniversal(wall, gp0, gp1, wallH) {
  const gateLen = Math.hypot(gp1.x - gp0.x, gp1.z - gp0.z);
  const gateAng = Math.atan2(gp1.x - gp0.x, gp1.z - gp0.z);
  const mx = (gp0.x + gp1.x) / 2, mz = (gp0.z + gp1.z) / 2;
  const pillarH = wallH + 2.4;
  for (const p of [gp0, gp1]) {
    wall.add(cyl(1.3, 1.5, pillarH, CREAM, 8, { pos: [p.x, pillarH / 2, p.z], roughness: 0.8 }));
    wall.add(cyl(1.5, 1.5, 0.4, GOLD, 8, { pos: [p.x, pillarH + 0.2, p.z], emissive: GOLD, emissiveIntensity: 0.4, cast: false }));
  }
  // the arch: a half-torus spanning the two pillars, bulging up to its apex
  const archR = gateLen / 2, archTube = 1.5;
  const archGeo = new THREE.TorusGeometry(archR, archTube, 10, 28, Math.PI);
  archGeo.rotateY(Math.PI / 2);        // span along local Z, matching the gateAng convention used elsewhere
  const arch = new THREE.Mesh(archGeo, new THREE.MeshStandardMaterial({ color: CREAM, flatShading: true, roughness: 0.8 }));
  arch.position.set(mx, pillarH, mz); arch.rotation.y = gateAng; wall.add(arch);
  const trimGeo = new THREE.TorusGeometry(archR, archTube * 0.28, 6, 28, Math.PI);
  trimGeo.rotateY(Math.PI / 2);
  const trim = new THREE.Mesh(trimGeo, new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.5, flatShading: true }));
  trim.position.set(mx, pillarH + archTube * 0.75, mz); trim.rotation.y = gateAng; wall.add(trim);

  // the spinning globe crowning the arch
  const globe = new THREE.Group();
  globe.position.set(mx, pillarH + archR + 3.2, mz);
  wall.add(globe);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12),
    new THREE.MeshStandardMaterial({ color: GOLD_HI, flatShading: true, roughness: 0.5, metalness: 0.2 })));
  const ringMat = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.5, flatShading: true });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.16, 6, 24), ringMat); globe.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.16, 6, 24), ringMat);
  ring2.rotation.x = Math.PI / 2; globe.add(ring2);
  const ring3 = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.16, 6, 24), ringMat);
  ring3.rotation.x = Math.PI / 2; ring3.rotation.y = Math.PI / 3; globe.add(ring3);
  globe.add(cyl(1.0, 1.6, 1.0, CREAM, 10, { pos: [0, -3.1, 0], roughness: 0.8 }));   // collar seating it on the arch
  return { spin: globe };
}

// a raked shore/cross-tie between two 3D points — the backlot truss holding a
// false-front skyline flat up from behind (see the METROPOLIS SKYLINE section)
function brace(ax, ay, az, bx, by, bz, color) {
  const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = box(0.3, len, 0.3, color, { roughness: 0.9, cast: false });
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

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

  const label = makeLabel('Projector', '3D/2D Display Engine', '#d4af37');
  label.sprite.position.set(0, 41, 0); hero.add(label.sprite);

  // ===== the stage door — backstage, tucked behind the tower =====================
  const portal = makeWallPortal('#d4af37', 5.2, 4.4);
  portal.group.position.set(0, 0, -9.4);
  portal.group.rotation.y = Math.PI;
  hero.add(portal.group);

  // ===== THE METROPOLIS SKYLINE — Hollywood backlot FALSE FRONTS, not real
  // buildings: painted-flat facades (window-slit Art Deco towers, the old Fritz
  // Lang silhouette the marquee could be playing footage of) thin enough to be
  // obviously flat, held up from behind by a raked-shore truss + sandbags — the
  // reveal is hidden from the carpet's approach (−Z, away from the camera's
  // usual +Z/+X quadrant) but plain to see if you orbit around back.
  const SKY_COL = [0x4b4550, 0x554c50, 0x413b46];
  const SKY_BAND = 0xc9b98f;    // pale stone banding at each tier setback
  const SKY_BRASS = 0x9c8a5a;   // dulled brass fluting/crown — quieter than the palace's gold
  const BRACE = 0x4a3a26, BRACE_LO = 0x36291a, SANDBAG = 0x6b5a42;
  const FLAT_D = 1.1;           // a real building would be tw.d deep — this is a painted flat
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
      if (k > 0) grp.add(box(tw.w * (1 - (k - 1) * 0.3) * 1.04, 0.22, FLAT_D * 1.15, SKY_BAND, { pos: [0, y, 0], roughness: 0.6 }));
      grp.add(box(tw.w * f, th, FLAT_D, col, { pos: [0, y + th / 2, 0], roughness: 0.8 }));
      if (k === 0) {
        // corner fluting on the tallest, most-visible base tier
        const hw = tw.w * f / 2, hd = FLAT_D / 2;
        for (const [fx, fz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
          grp.add(box(0.16, th * 0.86, 0.16, SKY_BRASS, {
            pos: [fx, y + th / 2, fz], emissive: SKY_BRASS, emissiveIntensity: 0.45, cast: false, receive: false,
          }));
        }
      }
      y += th;
    }
    // stepped brass crown
    grp.add(box(tw.w * 0.34, 0.5, FLAT_D * 0.3, SKY_BRASS, { pos: [0, y + 0.25, 0], emissive: SKY_BRASS, emissiveIntensity: 0.5, cast: false }));
    grp.add(box(tw.w * 0.18, 0.45, FLAT_D * 0.16, SKY_BRASS, { pos: [0, y + 0.7, 0], emissive: SKY_BRASS, emissiveIntensity: 0.5, cast: false }));
    // sparse deterministic grid of tiny lit windows on the +Z face
    for (let r = 0; r < Math.floor((tw.h * 0.82) / 3.2); r++) {
      for (let c = -1; c <= 1; c++) {
        if ((r * 7 + (c + 1) * 5 + ti * 3) % 4 !== 0) continue;
        grp.add(box(0.5, 1.0, 0.14, 0xf3d38a, {
          pos: [c * (tw.w * 0.28), 1.6 + r * 3.2, FLAT_D / 2 + 0.04],
          emissive: 0xf3d38a, emissiveIntensity: 1.1, cast: false, receive: false,
        }));
      }
    }
    // ===== THE BACKSTAGE TRUSS — raked shores + cross-ties holding the flat up
    // from behind, plus sandbag weights at their feet (the classic backlot tell)
    const totalH = y, backZ = -FLAT_D / 2 - 0.1, spread = tw.w * 0.4;
    for (const sx of [-spread, spread]) {
      grp.add(brace(sx, 0.1, backZ - 3.0, sx * 0.32, totalH * 0.78, backZ, BRACE));
      grp.add(brace(sx * 0.6, 0.1, backZ - 1.5, sx * 0.32, totalH * 0.4, backZ, BRACE));
      grp.add(box(1.1, 0.6, 0.9, SANDBAG, { pos: [sx, 0.3, backZ - 3.0], roughness: 1, cast: false }));
    }
    for (let hy = totalH * 0.22; hy < totalH * 0.75; hy += totalH * 0.26) {
      grp.add(box(spread * 0.66, 0.18, 0.2, BRACE_LO, { pos: [0, hy, backZ], roughness: 0.9, cast: false }));
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

  // ===== THE STUDIO WALL — a Hollywood backlot perimeter, gated on the carpet's
  // own axis (the classic studios — Paramount, Warners, MGM — were famously walled
  // compounds with one grand gate). Cream stucco + gold coping, echoing the
  // palace's own Art Deco vocabulary; fluted pilasters carry small warm sconces.
  const WALL_N = 14, WALL_R = 50, WALL_H = 4.2;
  const wallPts = [];
  for (let i = 0; i < WALL_N; i++) {
    const phi = (i / WALL_N) * Math.PI * 2;
    wallPts.push({ x: Math.sin(phi) * WALL_R, z: Math.cos(phi) * WALL_R });
  }
  const wall = new THREE.Group(); g.add(wall);
  const GATE_I = WALL_N - 1;   // the segment between pts[GATE_I] and pts[0] is left open
  for (let i = 0; i < WALL_N; i++) {
    if (i === GATE_I) continue;
    const a = wallPts[i], b = wallPts[(i + 1) % WALL_N];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, ang = Math.atan2(dx, dz);
    const panel = box(1.2, WALL_H, len, CREAM, { pos: [mx, WALL_H / 2, mz], roughness: 0.85 });
    panel.rotation.y = ang; wall.add(panel);
    const cap = box(1.4, 0.32, len + 0.3, GOLD, { pos: [mx, WALL_H + 0.16, mz], emissive: GOLD, emissiveIntensity: 0.35, cast: false });
    cap.rotation.y = ang; wall.add(cap);
  }
  // fluted pilasters at every vertex — skipping the two flanking the gate, which
  // get taller dedicated gate pillars instead
  for (let i = 0; i < WALL_N; i++) {
    if (i === 0 || i === GATE_I) continue;
    const p = wallPts[i];
    wall.add(cyl(0.75, 0.85, WALL_H + 1.0, CREAM, 8, { pos: [p.x, (WALL_H + 1.0) / 2, p.z], roughness: 0.8 }));
    wall.add(box(0.9, 0.4, 0.9, GOLD, { pos: [p.x, WALL_H + 1.4, p.z], emissive: GOLD, emissiveIntensity: 0.5, cast: false }));
    wall.add(box(0.35, 0.4, 0.35, GOLD_HI, { pos: [p.x * 0.97, WALL_H - 0.4, p.z * 0.97], emissive: GOLD_HI, emissiveIntensity: 1.1, cast: false, receive: false }));
  }
  // ===== THE STUDIO GATE — two builders on hand, one active =====================
  // Augustin asked to keep the original Art Deco gate available even after
  // switching the default to a Universal-Studios-style rounded arch + spinning
  // globe — flip GATE_STYLE to swap back instantly, nothing is deleted.
  const GATE_STYLE = 'universal';   // 'universal' | 'artdeco'
  const gp0 = wallPts[0], gp1 = wallPts[GATE_I];
  const gateRig = GATE_STYLE === 'universal'
    ? buildGateUniversal(wall, gp0, gp1, WALL_H)
    : buildGateArtDeco(wall, gp0, gp1, WALL_H);

  // ===== THE PLAZA DECK — a real paved platform under the carpet + screens =======
  // world.js's flattenPlateau blends the terrain toward flat but deliberately
  // keeps "a whisper of the original relief" (its own comment — core weight caps
  // at 0.94, never 1.0), so bare ground under a city can still carry a real bump.
  // The carpet sat almost flush on that bare ground (y=0.05) with no deck to
  // stand on, unlike its siblings' own disclaimed "no platform" cities — on a
  // seed with enough residual relief it got swallowed outright. A solid deck
  // fixes it for every seed, not just the one that happened to be flat enough.
  const DECK_Y = 0.4;
  g.add(box(38, 0.6, 48, 0x2a2620, { pos: [0, DECK_Y - 0.3, 12.5], roughness: 0.9 }));

  // ===== RED CARPET from the doors toward the triple bill ========================
  const carpet = glow(5.4, 20, RED, 1.0);
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, DECK_Y + 0.05, 19);
  carpet.material.transparent = true; carpet.material.opacity = 0.82;
  g.add(carpet);
  for (const z of [11, 15, 19, 23, 27]) for (const x of [-3.1, 3.1]) {
    g.add(cyl(0.14, 0.17, 1.3, GOLD, 8, { pos: [x, DECK_Y + 0.65, z], roughness: 0.4, metalness: 0.5 }));
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
    const mast = new THREE.Group(); mast.position.set(tw.x, 0, tw.z); g.add(mast);
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

  // ===== THE BACKLOT — a studio at work inside its wall: blind sound stages, the
  // writers' bungalows, the water tower every lot has, a crowd pressed along the
  // carpet with its flashbulbs, limousines circling to the gate, a set being shot.
  const fab = new Fabric({
    seed: 1927, walls: [CREAM, 0xd9cdb0, 0xcfc2a2], roof: 'gable', roofs: [0x3a3440, 0x4a4352], trim: GOLD, pavement: 0x2f2a35,
    windowLit: [0xf3d38a, 0xffe6b0], windowOff: 0x14121a, litP: 0.5, floorH: 2.0, bay: 1.8,
    cars: [0x111014, 0xf2ead8, 0xc81e3a, GOLD], people: [0x111014, 0xf2ead8, 0xc81e3a, GOLD, CYAN, VIOLET],
    leaves: [0x4f8a4a, 0x3f7a44], trunk: 0x6b5a42, lamp: GOLD_HI, pole: 0x2b2a32,
  });
  for (const [x, z, w, d, h] of [[-31, -7, 13, 9, 6.5], [31, -7, 13, 9, 6.5], [32, 13, 10, 8, 5.5]]) {     // the sound stages
    fab.building(x, z, w, d, h, { windows: false, shop: false, y: 0, rise: 2.2 });
    fab.prop(x, h - 1.0, z, w + 0.12, 0.4, d + 0.12, GOLD);
    fab.prop(x, 0, z + d / 2 + 0.06, 3.4, 3.6, 0.1, ONYX_LO);                                           // the elephant door
  }
  for (const [x, z] of [[-27, 29], [-33, 23.5], [26, 29], [31.5, 23], [-36, 7], [28.5, -22]]) {         // the bungalows
    fab.building(x, z, 4.4, 4.0, 3.2, { rot: Math.atan2(-x, -z), shop: false, y: 0 });
  }
  const DRIVE = 44;
  fab.ring(DRIVE, 3.0, 0x1b1820);
  fab.traffic({ ring: DRIVE }, { n: 7, speed: 3.4, l: 2.7, w: 1.0, h: 0.72 });
  const palm = (x, z) => {
    fab.prop(x, 0, z, 0.22, 5.6, 0.22, 0x6b5a42);
    fab.crowns.push({ x, y: 6.1, z, s: 1.25, color: 0x4f8a4a }, { x: x + 0.5, y: 5.7, z: z + 0.3, s: 0.8, color: 0x3f7a44 });
  };
  for (const z of [9, 15, 21, 27]) { palm(-9.6, z); palm(9.6, z); }
  for (let k = 0; k < 16; k++) {
    const a = (k + 0.5) / 16 * Math.PI * 2;
    if (Math.abs(a - 6.06) > 0.3) palm(Math.sin(a) * 47.2, Math.cos(a) * 47.2);                         // not across the gate
  }
  // the premiere: a crowd held back along the carpet, flashbulbs going off
  fab.crowd(46, (i, rand) => [(i % 2 ? 1 : -1) * (4.4 + rand() * 3.6), 10 + rand() * 18], { roam: 0.35 });
  for (let k = 0; k < 16; k++) {
    fab.light((k % 2 ? 1 : -1) * (4.6 + (k * 0.37) % 3), GROUND + 1.5, 10.5 + (k * 1.13) % 17, 0xffffff, 0.36, 2.1 + (k % 5) * 0.7, k * 0.19, 0.05);
  }
  fab.walkers({ ring: DRIVE - 2.6 }, { n: 12, spread: 0.6 });
  for (let k = 0; k < 10; k++) { const a = (k + 0.5) / 10 * Math.PI * 2; fab.lamp(Math.sin(a) * (DRIVE - 2.3), Math.cos(a) * (DRIVE - 2.3), 3.8); }
  const fabric = fab.build();
  g.add(fabric.group);

  // the water tower
  const tower = new THREE.Group(); tower.position.set(-28.5, 0, -22.5); g.add(tower);
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) tower.add(box(0.28, 11, 0.28, ONYX_LO, { pos: [dx, 5.5, dz], roughness: 0.7 }));
  for (const y of [3.6, 7.2]) for (const s of [-1.5, 1.5]) {
    tower.add(box(3.1, 0.16, 0.16, ONYX_LO, { pos: [0, y, s], cast: false }), box(0.16, 0.16, 3.1, ONYX_LO, { pos: [s, y, 0], cast: false }));
  }
  tower.add(cyl(2.5, 2.5, 3.6, CREAM, 14, { pos: [0, 12.6, 0], roughness: 0.7 }), cyl(2.56, 2.56, 0.5, GOLD, 14, { pos: [0, 12.6, 0], emissive: GOLD, emissiveIntensity: 0.4 }));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 14), new THREE.MeshStandardMaterial({ color: ONYX, flatShading: true, roughness: 0.6 }));
  cap.position.y = 15.2; cap.castShadow = true; tower.add(cap);

  // a set being shot: a painted sky flat, two lamps, the camera riding its crane
  const set = new THREE.Group(); set.position.set(-25, 0, 5); set.rotation.y = 0.9; g.add(set);
  set.add(box(7, 4.4, 0.2, 0x8fc4e8, { pos: [0, 2.6, -2.4], roughness: 0.9 }), box(7.2, 0.3, 0.6, 0x4a3a26, { pos: [0, 0.35, -2.4] }));
  for (const dx of [-3.2, 3.2]) {
    set.add(cyl(0.07, 0.07, 3.4, ONYX_LO, 5, { pos: [dx, 1.9, 1.4] }));
    const lamp = glow(1.3, 1.0, 0xfff1cf, 1.6); lamp.position.set(dx, 3.6, 1.36); lamp.rotation.y = Math.PI; set.add(lamp);
  }
  set.add(box(1.5, 0.5, 1.0, ONYX_LO, { pos: [0, 0.65, 2.6] }), cyl(0.1, 0.1, 1.6, GOLD, 6, { pos: [0, 1.6, 2.6] }));
  const boom = new THREE.Group(); boom.position.set(0, 2.4, 2.6); set.add(boom);
  boom.add(box(0.16, 0.16, 5.2, GOLD, { pos: [0, 0, -1.8], roughness: 0.5 }), box(0.5, 0.45, 0.7, ONYX, { pos: [0, 0, -4.5] }), box(0.6, 0.6, 0.6, ONYX_LO, { pos: [0, 0, 0.9] }));

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

      // the backlot: its fabric, and the camera crane feeling for its shot
      fabric.update(t);
      boom.rotation.y = Math.sin(t * 0.3) * 0.7; boom.rotation.x = 0.25 + Math.sin(t * 0.47) * 0.18;

      // the studio gate's globe, slowly turning (only present in the Universal-style gate)
      if (gateRig.spin) gateRig.spin.rotation.y = t * 0.3;
    },
  };
}
