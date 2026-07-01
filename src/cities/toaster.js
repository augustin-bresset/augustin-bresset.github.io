// toaster.js — Toaster: a 3D LiDAR point-cloud ANNOTATION tool.
// Reimagined as a cyberpunk annotation lab: a dense neon district (dark but never
// pure black — charcoals tinted blue/red/warm) around a holographic stage that
// RE-CREATES the actual tool: a glowing 3D point cloud with neon annotation
// bounding boxes and a sweeping scan plane. Identity nod: a brutalist red-slot
// landmark. A mini-map portal returns you to the overview.
import * as THREE from 'three';
import { box, cyl, platform, glow, strip, wireBox, pointCloud, makeLabel, makePortal, poiBeacon, tagPOI, tagPickable, sprawl } from './kit.js';

export function build() {
  const g = new THREE.Group();
  // cyberpunk charcoals — DARK but nuanced (blue-steel, warm-rust, ink), not black
  const C1 = 0x272d38, C2 = 0x313a48, C3 = 0x382a2a, C4 = 0x1e222b, C5 = 0x3a3029;
  const RED = 0xe10600, AMBER = 0xff8a3c, CYAN = 0x33d6ff, MAG = 0xff2b6d;

  g.add(platform(52, 0x33302a));

  // dense neon district — varied dark hues, mostly-red glow with stray amber/cyan
  g.add(sprawl({ rInner: 19, rOuter: 52, count: 120, seed: 22,
    colors: [C1, C2, C3, C4, C5], lit: { color: RED, p: 0.6 }, maxH: 22 }));

  // a few taller skyline towers with coloured edge-lighting for depth
  const towerSpecs = [
    [-18, -14, 26, C2, CYAN], [16, -19, 30, C1, RED], [22, 12, 22, C3, AMBER],
    [-24, 8, 24, C4, MAG], [-6, 24, 20, C2, RED],
  ];
  const towerStrips = [];
  const towerBodies = [];
  for (const [x, z, h, col, neon] of towerSpecs) {
    const tw = box(5, h, 5, col, { pos: [x, h / 2, z], roughness: 0.5, metalness: 0.3 });
    tw.rotation.y = (x * z) % 1.4;
    g.add(tw); towerBodies.push(tw);
    // vertical neon edge tubes
    for (const [ex, ez] of [[2.55, 2.55], [-2.55, 2.55], [2.55, -2.55], [-2.55, -2.55]]) {
      const e = box(0.16, h, 0.16, neon, { emissive: neon, emissiveIntensity: 1.8, cast: false });
      e.position.set(x + ex, h / 2, z + ez); e.rotation.y = tw.rotation.y;
      g.add(e); towerStrips.push(e);
    }
    // rooftop blinking beacon
    const bc = box(0.7, 0.7, 0.7, neon, { pos: [x, h + 1, z], emissive: neon, emissiveIntensity: 2.5, cast: false });
    g.add(bc); towerStrips.push(bc);
  }

  // ===== HERO: the holographic 3D-annotation stage (the real Toaster tool) =====
  const hero = new THREE.Group(); g.add(hero); tagPOI(hero, 'stage');
  // dark console base + emitter rim
  hero.add(box(17, 1.4, 13, C4, { pos: [0, 0.7, 0], roughness: 0.4, metalness: 0.5 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.18, 6, 48),
    new THREE.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 1.6 }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 1.5; hero.add(rim);
  // holographic scene floor (faint emissive grid)
  const floor = glow(15.5, 11.5, 0x0b2b38, 0.5);
  floor.rotation.x = -Math.PI / 2; floor.position.y = 1.45; hero.add(floor);

  // the point cloud — three labelled clusters floating above the stage
  const cloud = pointCloud([
    { cx: -2.4, cz: 0.4, color: RED, n: 70, spread: 2.3, y: 3.4 },
    { cx: 3.2, cz: 1.2, color: CYAN, n: 52, spread: 1.7, y: 2.9 },
    { cx: 1.2, cz: -3.2, color: AMBER, n: 40, spread: 1.4, y: 2.6 },
  ], { size: 0.26 });
  hero.add(cloud);

  // neon annotation bounding boxes around each cluster (the labeling itself)
  const boxes = [
    wireBox(5.2, 3.8, 5.0, RED, { pos: [-2.4, 3.4, 0.4] }),
    wireBox(4.0, 3.2, 3.6, CYAN, { pos: [3.2, 2.9, 1.2] }),
    wireBox(3.2, 2.6, 3.2, AMBER, { pos: [1.2, 2.6, -3.2] }),
  ];
  for (const b of boxes) hero.add(b);

  // a horizontal scan plane sweeping up through the cloud
  const scan = glow(15, 11, CYAN, 0.9);
  scan.rotation.x = -Math.PI / 2; scan.material.transparent = true; scan.material.opacity = 0.16;
  scan.position.y = 2; hero.add(scan);

  // ===== identity landmark: brutalist tower with two red "toaster" slots =====
  const land = box(7, 16, 7, C3, { pos: [-13, 8, -8], roughness: 0.5, metalness: 0.2 });
  g.add(land); tagPOI(land, 'landmark');
  tagPOI(towerBodies[2], 'clustering');     // the amber skyline tower → clustering note
  const slots = [];
  for (let i = 0; i < 2; i++) {
    const slot = glow(4.4, 0.9, RED, 2.4);
    slot.rotation.x = -Math.PI / 2; slot.position.set(-13, 16.05, -9.4 + i * 2.8);
    g.add(slot); slots.push(slot);
  }
  // a slice of "toast" peeking from a slot
  g.add(box(3.4, 2.2, 0.6, 0xcaa15a, { pos: [-13, 17.3, -8.6], emissive: 0x3a2a10, emissiveIntensity: 0.5 }));
  // red heating strips around the landmark base
  for (const [x, z, len, rot] of [[-13, -4.6, 7, 0], [-13, -11.4, 7, 0], [-9.6, -8, 7, 1], [-16.4, -8, 7, 1]]) {
    const s = strip(len, RED, 0.3, 2); s.position.set(x, 0.6, z); if (rot) s.rotation.y = Math.PI / 2;
    g.add(s); slots.push(s);
  }

  // holographic billboard (floating emissive sign)
  const billboard = glow(9, 5, MAG, 1.2);
  billboard.position.set(20, 18, -6); billboard.rotation.y = -0.5;
  billboard.material.transparent = true; billboard.material.opacity = 0.5; g.add(billboard);

  // ===== floating markers over the three readable landmarks =====
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); g.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('stage', '#33d6ff', 0, 12, 0);
  addBeacon('landmark', '#e10600', -13, 20, -8);
  addBeacon('clustering', '#ff8a3c', 22, 26, 22);

  // ===== portal back to the map =====
  const portal = makePortal('#e10600');
  portal.group.position.set(14, 0, 12); g.add(portal.group);

  const label = makeLabel('Toaster', '3D Annotation', '#e10600');
  label.sprite.position.set(0, 40, 0); g.add(label.sprite);

  tagPickable(g, 'toaster');

  return {
    group: g, label,
    // dive-in framing: centre on the holographic annotation stage with the neon
    // skyline rising around it (fixed, so it's the same hero shot on every seed).
    frame: { target: [0, 7, 0], azimuth: 0.6, polar: 57, radius: 64 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t, dt) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);
      // the cloud breathes; boxes pulse; scan sweeps
      cloud.position.y = Math.sin(t * 0.8) * 0.25;
      cloud.rotation.y = Math.sin(t * 0.2) * 0.15;
      for (const b of boxes) {
        b.material.opacity = 0.7 + Math.sin(t * 2.4) * 0.25;
        if (b.children[0]) b.children[0].material.opacity = 0.06 + Math.max(0, Math.sin(t * 2.4)) * 0.06;
      }
      scan.position.y = 2 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 4.6;
      scan.material.opacity = 0.10 + Math.abs(Math.sin(t * 0.9)) * 0.10;
      // neon flicker across towers + heating strips
      const flick = (Math.sin(t * 9) > 0.85 || Math.sin(t * 13 + 2) > 0.9) ? 0.45 : 1;
      const pulse = (1.7 + Math.sin(t * 2.2) * 0.6) * flick;
      for (const s of slots) if (s.material.emissive) s.material.emissiveIntensity = pulse;
      for (const e of towerStrips) e.material.emissiveIntensity = 1.4 + Math.sin(t * 2 + e.position.x) * 0.6;
      rim.material.emissiveIntensity = 1.3 + Math.sin(t * 1.6) * 0.5;
      billboard.material.opacity = 0.4 + Math.abs(Math.sin(t * 1.1)) * 0.25;
    },
  };
}
