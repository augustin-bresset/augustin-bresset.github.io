// splasher.js — Splasher: synchronized multi-sensor BEV labeling (LiDAR + cameras
// + bird's-eye grid). Reimagined as a cyberpunk sensor lab: a dark blue-teal
// district around a holographic BEV TABLE that re-creates the real tool — a
// top-down grid with an ego car, neon vehicle bounding boxes, lane lines and a
// radial scan sweep, flanked by camera-feed panels. Dark aqua, never pure black.
import * as THREE from 'three';
import { box, cyl, platform, glow, wireBox, pointCloud, makeLabel, makePortal, poiBeacon, tagPOI, tagPickable, sprawl } from './kit.js';

// a flat top-down grid of glowing lines (the BEV ground)
function bevGrid(size, step, color) {
  const pts = [];
  const h = size / 2;
  for (let x = -h; x <= h + 0.001; x += step) { pts.push(x, 0, -h, x, 0, h); }
  for (let z = -h; z <= h + 0.001; z += step) { pts.push(-h, 0, z, h, 0, z); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false });
  return new THREE.LineSegments(geo, mat);
}

export function build() {
  const g = new THREE.Group();
  // dark blue-teal charcoals — nuanced, not black
  const C1 = 0x1c2a36, C2 = 0x243744, C3 = 0x172430, C4 = 0x29404f;
  const CYAN = 0x00d8ff, VIOLET = 0x8a5cff, HI = 0x7af0ff, AMBER = 0xffb14a;

  g.add(platform(50, 0x2a333b));
  g.add(sprawl({ rInner: 19, rOuter: 50, count: 105, seed: 33,
    colors: [C1, C2, C3, C4], lit: { color: CYAN, p: 0.62 }, maxH: 22 }));

  // skyline towers w/ cyan + violet edge light
  const towerStrips = [];
  const towerBodies = [];
  for (const [x, z, h, neon] of [[-19, -13, 28, CYAN], [17, -18, 24, VIOLET],
    [23, 11, 22, CYAN], [-23, 9, 26, VIOLET], [-4, 23, 20, CYAN]]) {
    const tw = box(5, h, 5, C2, { pos: [x, h / 2, z], roughness: 0.5, metalness: 0.3 });
    tw.rotation.y = (x + z) % 1.3; g.add(tw); towerBodies.push(tw);
    for (const [ex, ez] of [[2.55, 2.55], [-2.55, 2.55], [2.55, -2.55], [-2.55, -2.55]]) {
      const e = box(0.16, h, 0.16, neon, { emissive: neon, emissiveIntensity: 1.8, cast: false });
      e.position.set(x + ex, h / 2, z + ez); e.rotation.y = tw.rotation.y; g.add(e); towerStrips.push(e);
    }
  }

  // ===== HERO: holographic BEV labeling table =====
  const hero = new THREE.Group(); g.add(hero); tagPOI(hero, 'table');
  hero.add(box(19, 1.4, 19, C3, { pos: [0, 0.7, 0], roughness: 0.4, metalness: 0.5 }));
  // emissive ground + grid lines
  const ground = glow(17, 17, 0x06303a, 0.55);
  ground.rotation.x = -Math.PI / 2; ground.position.y = 1.5; hero.add(ground);
  const grid = bevGrid(17, 1.7, CYAN); grid.position.y = 1.53; hero.add(grid);

  // ego vehicle (the recording car) at centre
  hero.add(box(1.6, 0.7, 3, HI, { pos: [0, 2.0, 0], emissive: HI, emissiveIntensity: 1.6, cast: false }));
  hero.add(wireBox(2.2, 1.2, 3.6, HI, { pos: [0, 2.1, 0] }));

  // labelled vehicles: flat neon boxes + a tiny point blob, varied class colours
  const carSpecs = [
    [-4.5, 3.2, 0.4, CYAN], [5.0, -2.0, -0.7, VIOLET], [-2.5, -5.5, 0.2, AMBER],
    [3.5, 5.5, 1.1, CYAN], [-6.5, -3.0, 0.9, VIOLET], [6.5, 4.0, -0.4, CYAN],
  ];
  const cars = [];
  for (const [x, z, rot, col] of carSpecs) {
    const wb = wireBox(2.0, 1.2, 3.4, col, { pos: [x, 2.1, z] });
    wb.rotation.y = rot; hero.add(wb); cars.push(wb);
    const blob = pointCloud([{ cx: 0, cz: 0, color: col, n: 16, spread: 0.7, y: 0 }], { size: 0.16 });
    blob.position.set(x, 2.0, z); blob.rotation.y = rot; hero.add(blob);
  }

  // lane lines (dashed glowing segments running "forward")
  for (const lx of [-2.6, 2.6]) {
    for (let s = -7; s <= 7; s += 2.4) {
      hero.add(box(0.18, 0.05, 1.2, 0xeaf6ff,
        { pos: [lx, 1.56, s], emissive: 0xbfe9ff, emissiveIntensity: 1.0, cast: false, receive: false }));
    }
  }

  // rotating radial scan sweep over the table
  const sweepPivot = new THREE.Group(); sweepPivot.position.set(0, 1.7, 0); hero.add(sweepPivot);
  const sweep = glow(8.4, 0.34, HI, 2.2);
  sweep.rotation.x = -Math.PI / 2; sweep.position.set(4.2, 0, 0);
  sweep.material.transparent = true; sweep.material.opacity = 0.6; sweepPivot.add(sweep);

  // camera-feed panels on posts (the "multi-sensor" sync) at the back edge
  const feeds = [];
  for (const [x, z, col] of [[-7.5, -8.5, CYAN], [0, -9.2, VIOLET], [7.5, -8.5, CYAN]]) {
    g.add(cyl(0.18, 0.24, 5, 0x223038, 6, { pos: [x, 2.5, z] }));
    const scr = glow(3.4, 2.1, col, 1.2);
    scr.position.set(x, 5.6, z);
    scr.material.transparent = true; scr.material.opacity = 0.82; g.add(scr); feeds.push(scr);
    // bezel
    g.add(box(3.7, 2.4, 0.18, 0x2a3a44, { pos: [x, 5.6, z - 0.12], roughness: 0.6 }));
  }

  // rotating LiDAR scanner on a mast (Splasher signature)
  const mast = cyl(0.22, 0.3, 7, 0x223038, 8, { pos: [11, 3.5, -3] }); g.add(mast); tagPOI(mast, 'mast');
  const scanner = new THREE.Group(); scanner.position.set(11, 7.2, -3); g.add(scanner); tagPOI(scanner, 'mast');
  tagPOI(towerBodies[1], 'towers');     // the violet skyline tower → "built for" note
  scanner.add(cyl(1.4, 1.6, 1.1, C3, 16, {}));
  const beam = glow(13, 1.0, HI, 1.6); beam.position.set(6.5, 0.2, 0); scanner.add(beam);

  // ripple rings on a water pad (Splasher signature)
  const pad = new THREE.Mesh(new THREE.CircleGeometry(8, 32),
    new THREE.MeshStandardMaterial({ color: 0x0e2730, emissive: 0x07303a, emissiveIntensity: 0.6, roughness: 0.3, transparent: true, opacity: 0.9 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(-12, 0.3, 6); g.add(pad);
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 6, 40),
      new THREE.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 1.8, transparent: true }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(-12, 0.4, 6); g.add(ring); rings.push({ ring, ph: i / 4 });
  }

  // ===== floating markers over the three readable landmarks =====
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); g.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('table', '#00d8ff', 0, 13, 0);
  addBeacon('mast', '#7af0ff', 11, 12, -3);
  addBeacon('towers', '#8a5cff', 17, 30, -18);

  // ===== portal back to the map =====
  const portal = makePortal('#00d8ff');
  portal.group.position.set(15, 0, 13); g.add(portal.group);

  const label = makeLabel('Splasher', 'BEV Labeling', '#00b8d9');
  label.sprite.position.set(0, 40, 0); g.add(label.sprite);

  tagPickable(g, 'splasher');

  return {
    group: g, label,
    // dive-in framing: centre on the holographic BEV table with the dark-aqua neon
    // skyline around it (fixed, so it's the same hero shot on every seed).
    frame: { target: [0, 7, 0], azimuth: 0.5, polar: 57, radius: 64 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t, dt) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);
      sweepPivot.rotation.y = -t * 1.1;
      scanner.rotation.y = t * 1.2;
      for (const c of cars) c.material.opacity = 0.7 + Math.sin(t * 2.2 + c.position.x) * 0.25;
      for (const e of towerStrips) e.material.emissiveIntensity = 1.3 + Math.sin(t * 2 + e.position.z) * 0.6;
      for (let i = 0; i < feeds.length; i++) {
        feeds[i].material.emissiveIntensity = 0.9 + Math.abs(Math.sin(t * (3 + i) + i)) * 0.8; // scanline flicker
      }
      for (const o of rings) {
        const f = (t * 0.35 + o.ph) % 1; const s = 0.6 + f * 7;
        o.ring.scale.set(s, s, 1); o.ring.material.opacity = Math.max(0, 1 - f);
      }
    },
  };
}
