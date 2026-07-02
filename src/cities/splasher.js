// splasher.js — Splasher: synchronized multi-sensor BEV labeling.
// "HEIGHTFIELD ZERO": the city literally IS the tool's output — a rigid BEV cell
// grid where every column's HEIGHT is a lidar cell's max-z and its COLOUR is that
// same height on the viridis ramp (purple lowlands → yellow peaks), quantised into
// terrace steps. A black brutalist ego-origin dais (the logo's axis marker) crowns
// the central massif and emits concentric cyan splash-rings that re-tint the cells
// they cross to class-blue and release them — idling = watching an annotation pass.
// A flat electric-blue traversability corridor threads forward in +x between the
// peaks (the flagship labeling task made a street). Zero random position, zero
// random yaw: one coherent heightfield, one lattice.
import * as THREE from 'three';
import { box, cyl, glow, wireBox, pointCloud, makeLabel, makeWallPortal, poiBeacon, tagPOI, tagPickable } from './kit.js';
import { Simplex, clamp, smoothstep } from '../gen/noise.js';

const N = 32, PITCH = 1.5, RMAX = 24;
const BLUE = 0x3b82f6, BLUE_HI = 0x5b9bff, CYAN = 0x2ad4ff;

// height ramp in SHADES OF BLUE ONLY (the tool's dark-aqua identity): deep navy
// lowlands → blue → pale cyan crests. One hue family, value = height — reads as a
// bathymetric relief instead of a disco ball.
const RAMP = [
  new THREE.Color(0x22305e), new THREE.Color(0x2b4a8f), new THREE.Color(0x3b6fc4),
  new THREE.Color(0x57a8d9), new THREE.Color(0xa8e0f0),
];
function viridis(out, t) {
  const f = clamp(t, 0, 1) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(f));
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], f - i);
}

// flat glowing grid-line overlay (the BEV raster)
function bevGrid(size, step, color) {
  const pts = [];
  const h = size / 2;
  for (let x = -h; x <= h + 0.001; x += step) pts.push(x, 0, -h, x, 0, h);
  for (let z = -h; z <= h + 0.001; z += step) pts.push(-h, 0, z, h, 0, z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
}

export function build() {
  const g = new THREE.Group();
  const sim = new Simplex(33);

  // no platform: the terrain is tinted deep-navy under the city (terrain.js
  // fusion zone) and lightly flattened — the BEV lattice grows from the land.

  const mastPos = { x: -16, z: 14 }, camPos = { x: 18, z: 6 };

  // ===== the BEV heightfield: one instanced lattice of viridis columns ==========
  const cells = [];
  const _v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = (i - N / 2 + 0.5) * PITCH, z = (j - N / 2 + 0.5) * PITCH;
      const r = Math.hypot(x, z);
      if (r < 3) continue;                                    // ego plaza at centre
      if (Math.hypot(x - mastPos.x, z - mastPos.z) < 3) continue;   // sensor footprints
      if (Math.hypot(x - camPos.x, z - camPos.z) < 3.2) continue;
      const corridor = x > 2 && Math.abs(z) < 1.7;            // drivable channel (+x)
      const rc = Math.max(Math.abs(x), Math.abs(z));          // Chebyshev: SQUARE metric
      if (!corridor) {
        if (Math.abs(x) < 0.8 || Math.abs(z) < 0.8) continue;       // N/E/S/W spoke streets
        if (Math.abs(rc - 10) < 0.8 || Math.abs(rc - 18) < 0.8) continue; // SQUARE avenues
      }
      // one coherent field, deliberately NOT round: a SQUARE envelope (the BEV frame
      // is a rectangle, not a dome) + anisotropic noise so the skyline forms straight
      // block-ridges instead of a circular mound.
      const env = 1 - smoothstep(0.12, 1.0, rc / RMAX);
      const detail = 0.5 + 0.5 * sim.fbm(x * 0.055, z * 0.12, { octaves: 4 });
      const ridge = sim.ridged(x * 0.045, z * 0.1, { octaves: 3 });
      if (rc > RMAX * 0.97 && detail < 0.3) continue;         // barely-thinned rim (fill the pad)
      let hN = clamp(env * (0.28 + 0.48 * detail + 0.62 * ridge), 0, 1);
      hN = Math.round(hN * 6) / 6;                            // 6 terrace steps
      let h = 0.6 + hN * 22;
      if (corridor) { h = 0.5; hN = -1; }                     // flat, class-blue
      cells.push({ x, z, h, hN, r, corridor });
    }
  }

  // column bodies: ONE InstancedMesh, per-instance viridis colour
  const bodyGeo = new THREE.BoxGeometry(1.25, 1, 1.25);
  const bodies = new THREE.InstancedMesh(bodyGeo,
    new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.55, metalness: 0.05 }),
    cells.length);
  // unlit brighter top-caps: light-from-within so lowlands glow instead of crushing
  const capGeo = new THREE.BoxGeometry(1.27, 0.16, 1.27);
  const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshBasicMaterial(), cells.length);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const _col = new THREE.Color(), _white = new THREE.Color(0xffffff);
  const baseCols = new Float32Array(cells.length * 3);        // for the splash re-tint
  cells.forEach((c, ci) => {
    _m.compose(_v.set(c.x, c.h / 2, c.z), _q, _s.set(1, c.h, 1));
    bodies.setMatrixAt(ci, _m);
    _m.compose(_v.set(c.x, c.h + 0.08, c.z), _q, _s.set(1, 1, 1));
    caps.setMatrixAt(ci, _m);
    if (c.corridor) _col.set(0x8fd8f4);   // the drivable channel glows pale against the deep blues
    else viridis(_col, c.hN);
    bodies.setColorAt(ci, _col);
    baseCols[ci * 3] = _col.r; baseCols[ci * 3 + 1] = _col.g; baseCols[ci * 3 + 2] = _col.b;
    // caps barely brighter than the body: unlit means they already render at full
    // value — any strong white lift washes the viridis to lavender from above.
    caps.setColorAt(ci, _col.clone().lerp(_white, 0.08));
  });
  bodies.castShadow = true; bodies.receiveShadow = true;
  g.add(bodies); g.add(caps);

  // the BEV raster overlay + a faint ground-haze glow for the control-room mood
  const grid = bevGrid(N * PITCH, PITCH, BLUE); grid.position.y = 0.06; g.add(grid);
  const haze = glow(49, 49, 0x0d2030, 0.35);
  haze.rotation.x = -Math.PI / 2; haze.position.y = 0.02;
  haze.material.transparent = true; haze.material.opacity = 0.5; g.add(haze);

  // ===== THE EGO SPLASH ORIGIN — the logo stood up at world (0,0) ===============
  const dais = new THREE.Group(); g.add(dais); tagPOI(dais, 'table');
  dais.add(box(4.2, 1.3, 4.2, 0x0e1117, { pos: [0, 0.65, 0], roughness: 0.4, metalness: 0.3 }));
  dais.add(box(2.6, 0.9, 2.6, 0x14181f, { pos: [0, 1.75, 0], roughness: 0.5 }));
  // axis monument: +X forward arm (red), +Y left arm (green), pulsing centre dot
  dais.add(box(3.4, 0.28, 0.28, 0xff5a52, { pos: [2.2, 2.3, 0], emissive: 0xff5a52, emissiveIntensity: 1.6, cast: false }));
  dais.add(box(0.28, 0.28, 3.4, 0x37d67a, { pos: [0, 2.3, 2.2], emissive: 0x37d67a, emissiveIntensity: 1.6, cast: false }));
  const dot = box(0.7, 0.7, 0.7, BLUE_HI, { pos: [0, 2.5, 0], emissive: BLUE_HI, emissiveIntensity: 2.4, cast: false });
  dais.add(dot);

  // ===== splash rings — the annotation pass, emitted from the ego dot ===========
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.14, 6, 64),
      new THREE.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 1.8, transparent: true }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.5;
    g.add(ring); rings.push({ ring, ph: i / 3 });
  }

  // ===== the corridor's scrolling dashed lane markers ===========================
  const lanes = [];
  for (let s = 0; s < 9; s++) {
    const ln = box(1.1, 0.06, 0.22, 0xbfe9ff, { emissive: 0xbfe9ff, emissiveIntensity: 1.2, cast: false, receive: false });
    ln.position.set(4 + s * 2.4, 0.62, 0); g.add(ln); lanes.push(ln);
  }

  // ===== a slow radial scan-wedge dragging a bright band across the relief ======
  const scanPivot = new THREE.Group(); scanPivot.position.y = 0.4; g.add(scanPivot);
  const scanW = glow(22, 0.5, CYAN, 1.6);
  scanW.rotation.x = -Math.PI / 2; scanW.position.set(11, 0.5, 0);
  scanW.material.transparent = true; scanW.material.opacity = 0.4;
  scanPivot.add(scanW);

  // ===== edge sensor 1: LiDAR mast + floating annotation cage → 'mast' ==========
  const mastG = new THREE.Group(); mastG.position.set(mastPos.x, 0, mastPos.z);
  g.add(mastG); tagPOI(mastG, 'mast');
  mastG.add(cyl(0.24, 0.34, 7.5, 0x223038, 8, { pos: [0, 3.75, 0] }));
  const scanner = new THREE.Group(); scanner.position.y = 7.9; mastG.add(scanner);
  scanner.add(cyl(1.3, 1.5, 1.1, 0x172430, 16, {}));
  const beam = glow(11, 0.9, 0x57e8ff, 1.6); beam.position.set(5.5, 0.2, 0); scanner.add(beam);
  const cage = wireBox(3.2, 2.6, 3.2, 0x57e8ff, { opacity: 0.8, fillOpacity: 0.05 });
  cage.position.set(0, 11.5, 0); mastG.add(cage);
  const swarm = pointCloud([{ cx: 0, cz: 0, color: 0x57e8ff, n: 26, spread: 1.1, y: 0 }], { size: 0.16 });
  swarm.position.set(0, 11.3, 0); mastG.add(swarm);

  // ===== edge sensor 2: camera-feed bank watching the corridor → 'towers' =======
  const camG = new THREE.Group(); camG.position.set(camPos.x, 0, camPos.z);
  g.add(camG); tagPOI(camG, 'towers');
  const feeds = [];
  [[-2.6, 0x2ad4ff], [0, 0x8a5cff], [2.6, 0x2ad4ff]].forEach(([dx, col]) => {
    camG.add(cyl(0.16, 0.22, 4.6, 0x223038, 6, { pos: [dx, 2.3, 0] }));
    const scr = glow(2.2, 1.5, col, 1.2);
    scr.position.set(dx, 5.1, 0); scr.rotation.y = Math.PI + 0.5;   // faces the corridor
    scr.material.transparent = true; scr.material.opacity = 0.85;
    camG.add(scr); feeds.push(scr);
    camG.add(box(2.5, 1.8, 0.16, 0x2a3a44, { pos: [dx, 5.1, 0.12], roughness: 0.6 }));
  });
  camG.rotation.y = 0.5;

  // ===== POI beacons (existing content ids stay wired) ==========================
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); g.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('table', '#5b9bff', 0, 12, 0);
  addBeacon('mast', '#57e8ff', mastPos.x, 15, mastPos.z);
  addBeacon('towers', '#2ad4ff', camPos.x, 10, camPos.z);   // traversability corridor + cams

  // ===== portal in the pad's cleared corner =====================================
  // ===== THE END OF THE ROAD — the portal stands at the corridor's terminus: the
  // one drivable channel across the BEV leads straight through the gate and out of
  // the world. Two checkpoint pylons + gantry frame it like a finish line.
  const gate = new THREE.Group();
  gate.position.set(24.6, 0, 0);
  gate.rotation.y = -Math.PI / 2;               // the doorway faces back down the corridor
  for (const dz of [-3.6, 3.6]) {
    gate.add(box(1.1, 7, 1.1, 0x151a22, { pos: [dz, 3.5, -0.9], roughness: 0.6, metalness: 0.2, emissive: 0x151a22, emissiveIntensity: 0.2 }));
    gate.add(box(0.5, 0.5, 0.5, CYAN, { pos: [dz, 7.3, -0.9], emissive: CYAN, emissiveIntensity: 1.6, cast: false }));
  }
  gate.add(box(8.4, 0.9, 1.1, 0x151a22, { pos: [0, 7, -0.9], roughness: 0.6, emissive: 0x151a22, emissiveIntensity: 0.2 }));
  gate.add(box(7.4, 0.22, 0.3, BLUE, { pos: [0, 6.4, -0.35], emissive: BLUE, emissiveIntensity: 1.2, cast: false }));
  const portal = makeWallPortal('#3b82f6');
  portal.group.position.set(0, 0, -0.2);
  gate.add(portal.group);
  g.add(gate);

  const label = makeLabel('Splasher', 'BEV Labeling', '#3b82f6');
  label.sprite.position.set(0, 40, 0); g.add(label.sprite);

  tagPickable(g, 'splasher');

  const _base = new THREE.Color(), _tint = new THREE.Color(BLUE_HI);
  return {
    group: g, label,
    frame: { target: [0, 7, 0], azimuth: 0.5, polar: 55, radius: 62 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);

      // splash rings expand from the ego dot; cells inside a ring's annulus flip
      // toward class-blue, then decay back to their stored viridis behind it
      let needsColor = false;
      const radii = [];
      for (const o of rings) {
        const f = (t * 0.2 + o.ph) % 1;
        const R = 1 + f * (RMAX + 2);
        o.ring.scale.set(R, R, 1);
        o.ring.material.opacity = Math.max(0, 0.9 - f);
        radii.push(R);
      }
      for (let ci = 0; ci < cells.length; ci++) {
        const c = cells[ci];
        let hit = 0;
        for (const R of radii) {
          const d = Math.abs(c.r - R);
          if (d < 1.6) hit = Math.max(hit, 1 - d / 1.6);
        }
        _base.setRGB(baseCols[ci * 3], baseCols[ci * 3 + 1], baseCols[ci * 3 + 2]);
        if (hit > 0.02) { _base.lerp(_tint, hit * 0.85); needsColor = true; }
        bodies.setColorAt(ci, _base);
      }
      if (needsColor && bodies.instanceColor) bodies.instanceColor.needsUpdate = true;

      // ego drift: dashed lanes scroll down the corridor (obstacles stream past)
      for (const ln of lanes) {
        ln.position.x -= 0.06;
        if (ln.position.x < 3) ln.position.x += 9 * 2.4;
      }
      scanPivot.rotation.y = t * 0.5;          // the lidar scan line re-reducing points
      scanner.rotation.y = t * 1.2;
      cage.rotation.y = t * 0.4;
      swarm.rotation.y = -t * 0.5;
      dot.material.emissiveIntensity = 1.8 + Math.sin(t * (Math.PI * 2) * 0.2 * 2) * 0.9;
      for (let i = 0; i < feeds.length; i++) {
        feeds[i].material.emissiveIntensity = 0.9 + Math.abs(Math.sin(t * (3 + i) + i)) * 0.8;
      }
    },
  };
}

