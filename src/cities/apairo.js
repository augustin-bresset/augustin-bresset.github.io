// apairo.js — Apairo: an open-source framework for large robotics datasets.
// Reimagined as a clean MODERN data-factory by the sea (apéro on the plage): a
// sleek sawtooth-roof hall, steel silos, a conveyor carrying "data crates", a
// sorting robot arm, a solar array, and a little pier + parasol on the beach.
// Light & well-modelled to contrast the dark cyberpunk labs. Portal returns home.
import * as THREE from 'three';
import { box, cyl, platform, glow, makeLabel, makePortal, tagPickable, sprawl } from './kit.js';

const WHITE = 0xf1ece0, STEEL = 0x8b97a3, GREY = 0xccc7bb, GLASS = 0xbfe3e8;
const AMBER = 0xdda42a, TRIM = 0x39434f, SAND = 0xdcc89a, SOLAR = 0x232f49, SEA = 0x5fa0b4;

export function build() {
  const g = new THREE.Group();

  g.add(platform(48, 0xb9ad95));
  // clean modern light-industrial district
  g.add(sprawl({ rInner: 19, rOuter: 48, count: 70, seed: 11,
    colors: [0xf1ece0, 0xe2dccd, 0xccc7bb, 0x9aa4ae, 0xd9d3c6],
    lit: { color: 0xbfe3e8, p: 0.35 }, maxH: 10 }));

  // ===== beach + sea apron (the apéro side) on +x, hugging the platform edge =====
  const sand = box(24, 0.4, 30, SAND, { pos: [25, 0.05, 2], receive: true, cast: false });
  g.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(26, 36),
    new THREE.MeshStandardMaterial({ color: SEA, transparent: true, opacity: 0.82, roughness: 0.25, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(39, -0.35, 2); g.add(sea);
  // a little pier on posts running out into the sea
  for (let i = 0; i < 5; i++) {
    g.add(cyl(0.22, 0.26, 2.4, 0x6f5a3c, 6, { pos: [24 + i * 3.4, 0.3, 11] }));
    g.add(box(3.4, 0.22, 2.4, 0x8a6f49, { pos: [25.7 + i * 3.4, 1.4, 11], cast: false }));
  }
  // apéro parasol + table + stools on the sand
  g.add(cyl(0.12, 0.12, 3, 0x9a8468, 6, { pos: [19, 1.5, -8] }));
  const para = cyl(0.1, 3.2, 1.4, 0xcf6b4a, 10, { pos: [19, 3.2, -8] }); para.castShadow = true; g.add(para);
  g.add(cyl(1.3, 1.3, 0.2, WHITE, 12, { pos: [19, 1.0, -8] }));     // table top
  for (const [dx, dz] of [[1.5, 0], [-1.5, 0]]) g.add(box(0.5, 0.9, 0.5, AMBER, { pos: [19 + dx, 0.45, -8 + dz], cast: false })); // stools

  // ===== main factory hall with a sawtooth (north-light) roof =====
  const hall = box(17, 7, 12, WHITE, { pos: [-4, 3.5, -1], roughness: 0.7 });
  g.add(hall);
  // steel base trim + corner columns
  g.add(box(17.4, 0.8, 12.4, STEEL, { pos: [-4, 0.4, -1] }));
  for (const [x, z] of [[4.3, 5.8], [-12.3, 5.8], [4.3, -7.8], [-12.3, -7.8]])
    g.add(box(0.5, 7, 0.5, STEEL, { pos: [x, 3.5, z] }));
  // long glass strip windows
  for (const z of [-1]) {
    const win = glow(15.5, 1.6, GLASS, 0.5);
    win.position.set(-4, 4.2, 5.05); g.add(win);
  }
  // sawtooth roof bays: a slanted opaque panel + a vertical glass north-light
  const bayLeds = [];
  for (let i = 0; i < 4; i++) {
    const bx = -11.2 + i * 4.2;
    const panel = box(3.9, 0.3, 12, GREY, { pos: [bx, 7.6, -1] });
    panel.rotation.z = -0.42; panel.position.y = 7.9; g.add(panel);
    const nl = glow(1.7, 3.6, GLASS, 0.6); nl.rotation.y = Math.PI / 2;
    nl.position.set(bx - 1.9, 8.3, -1); g.add(nl); bayLeds.push(nl);
  }

  // ===== steel silos (dataset storage) =====
  for (const [x, z, r, h] of [[-14, 0, 2.2, 9], [-14, 5, 1.8, 7.5], [-10.5, 7.5, 1.5, 6]]) {
    g.add(cyl(r, r, h, STEEL, 16, { pos: [x, h / 2, z], roughness: 0.5, metalness: 0.4 }));
    g.add(cyl(r, r * 0.2, r * 0.8, 0xb9c2cb, 16, { pos: [x, h + r * 0.35, z] })); // dome cap
    g.add(box(r * 2, 0.3, 0.4, AMBER, { pos: [x, h * 0.6, z + r + 0.05], emissive: AMBER, emissiveIntensity: 0.5, cast: false })); // gauge band
  }

  // ===== conveyor carrying data crates into the hall, with a sorting robot arm =====
  const beltY = 2.2;
  g.add(box(14, 0.4, 2.0, TRIM, { pos: [9, beltY, 6], roughness: 0.6 }));   // belt deck
  for (let i = 0; i < 7; i++) g.add(cyl(0.16, 0.16, beltY, STEEL, 6, { pos: [3.5 + i * 2, beltY / 2, 6] })); // legs
  const crates = [];
  const crateCol = [0xdda42a, 0x4a90d9, 0x57a957, 0xcf6b4a];
  for (let i = 0; i < 6; i++) {
    const c = box(1.1, 1.1, 1.1, crateCol[i % 4], { pos: [2 + i * 2.4, beltY + 0.75, 6], roughness: 0.7 });
    g.add(c); crates.push(c);
  }
  // sorting robot arm beside the belt
  const armBase = cyl(0.9, 1.1, 0.7, STEEL, 12, { pos: [3, 0.6, 9] }); g.add(armBase);
  const seg1 = new THREE.Group(); seg1.position.set(3, 1.1, 9); g.add(seg1);
  seg1.add(box(0.6, 4, 0.6, TRIM, { pos: [0, 2, 0] }));
  const seg2 = new THREE.Group(); seg2.position.set(0, 4, 0); seg1.add(seg2);
  seg2.add(box(0.5, 3, 0.5, TRIM, { pos: [0, 1.5, 0] }));
  const claw = box(0.9, 0.5, 0.9, AMBER, { pos: [0, 3, 0], emissive: AMBER, emissiveIntensity: 0.4 }); seg2.add(claw);

  // ===== solar array (clean energy) =====
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const p = box(3.2, 0.18, 2.2, SOLAR, { pos: [-13 + c * 3.6, 1.4, -10 + r * 2.6], roughness: 0.3, metalness: 0.2 });
    p.rotation.x = -0.5; g.add(p);
    g.add(cyl(0.1, 0.1, 1.2, STEEL, 5, { pos: [-13 + c * 3.6, 0.6, -10 + r * 2.6] }));
  }

  // ===== chimney vents with gentle steam =====
  const steam = [];
  const steamMat = new THREE.MeshStandardMaterial({ color: 0xeae6dc, flatShading: true, transparent: true, opacity: 0.6, roughness: 1 });
  const puffGeo = new THREE.IcosahedronGeometry(0.7, 0);
  for (const [x, z] of [[-8, -6], [-1, -6]]) {
    g.add(cyl(0.6, 0.7, 3, GREY, 10, { pos: [x, 8.5, z] }));
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(puffGeo, steamMat.clone()); m.position.set(x, 10, z);
      g.add(m); steam.push({ m, x, z, t: i / 4, sway: Math.random() * 6.28 });
    }
  }

  // rooftop antenna + amber beacon, and a clean logo gear
  g.add(cyl(0.1, 0.14, 5, STEEL, 6, { pos: [3, 11, -5] }));
  const beacon = box(0.7, 0.7, 0.7, AMBER, { pos: [3, 13.6, -5], emissive: AMBER, emissiveIntensity: 2.5, cast: false }); g.add(beacon);
  const gear = new THREE.Group(); gear.position.set(-4, 8.4, 5.2); g.add(gear);
  const gearBody = cyl(1.3, 1.3, 0.3, AMBER, 12, { emissive: AMBER, emissiveIntensity: 0.35 });
  gearBody.rotation.x = Math.PI / 2; gear.add(gearBody);
  for (let i = 0; i < 8; i++) {
    const tooth = box(0.45, 0.45, 0.3, AMBER, { emissive: AMBER, emissiveIntensity: 0.35, cast: false });
    const a = (i / 8) * Math.PI * 2; tooth.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0); gear.add(tooth);
  }

  // ===== portal back to the map =====
  const portal = makePortal('#dda42a');
  portal.group.position.set(13, 0, -12); g.add(portal.group);

  const label = makeLabel('Apairo', 'Robotics Data', '#9a6f12');
  label.sprite.position.set(0, 36, 0); g.add(label.sprite);

  tagPickable(g, 'apairo');

  return {
    group: g, label,
    update(t, dt) {
      portal.update(t);
      gear.rotation.z = t * 0.8;
      // conveyor crates march toward the hall, recycle at the end
      for (const c of crates) {
        c.position.x -= dt * 1.6;
        if (c.position.x < -3.5) c.position.x += 14.4;
      }
      // robot arm sorts in a slow cycle
      seg1.rotation.z = 0.2 + Math.sin(t * 0.8) * 0.35;
      seg2.rotation.z = Math.sin(t * 0.9 + 1) * 0.5;
      seg1.rotation.y = Math.sin(t * 0.5) * 0.6;
      beacon.material.emissiveIntensity = 1.5 + Math.max(0, Math.sin(t * 3)) * 2.5;
      for (const s of steam) {
        s.t += dt * 0.16; if (s.t > 1) s.t -= 1;
        const h = s.t;
        s.m.position.set(s.x + Math.sin(s.sway + h * 4) * (0.4 + h * 1.6), 10 + h * 7, s.z + Math.cos(s.sway + h * 3) * h);
        s.m.scale.setScalar(0.5 + h * 1.5); s.m.material.opacity = 0.55 * (1 - h);
      }
    },
  };
}
