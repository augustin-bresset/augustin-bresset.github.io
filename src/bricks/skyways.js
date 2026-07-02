// skyways.js (brick) — what LINKS the cities: elevated hyperloop-like tubes riding
// pylons over the terrain, with luminous data-pulses travelling inside (the cities
// literally exchange data), plus a couple of quiet wood-and-canvas aircraft drifting
// high above — a nod to the croquis sky. Deliberately sparse: a seeded RANDOM SUBSET
// of city pairs is linked (never the full graph), and only TWO aircraft fly.
import * as THREE from 'three';
import { mulberry32 } from '../gen/noise.js';

const TUBE = 0x9fb2c4, PULSE = 0xffd98a, PYLON = 0x6b7a88;
const CLEAR = 22;                 // tube clearance above the terrain profile

export function buildSkyways(field, pads, seed, opts = {}) {
  const islands = opts.islands || null;   // floating mode: land test for pylons/heights
  const group = new THREE.Group();
  group.name = 'skyways';
  const rand = mulberry32((seed ^ 0x51c1e5) >>> 0);
  const pulses = [];

  // ---- choose a sparse random subset of links (not the complete graph) --------
  // Origin (the wind-inventor village) is NEVER piped: hyperloop tubes belong to
  // the software cities' world, not to a hamlet of wood and canvas.
  const tubePads = pads.filter((p) => p.city && p.city.id !== 'about');
  const pairs = [];
  for (let i = 0; i < tubePads.length; i++) {
    for (let j = i + 1; j < tubePads.length; j++) pairs.push([tubePads[i], tubePads[j]]);
  }
  for (let i = pairs.length - 1; i > 0; i--) {   // seeded shuffle
    const k = (rand() * (i + 1)) | 0;
    [pairs[i], pairs[k]] = [pairs[k], pairs[i]];
  }
  const nLinks = Math.min(pairs.length, tubePads.length >= 3 ? 2 : 1);

  for (let li = 0; li < nLinks; li++) {
    const [A, B] = pairs[li];
    // start/end just inside each city's rim, up at skyway height
    const dx = B.x - A.x, dz = B.z - A.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    const ax = A.x + ux * (A.city.radius * 0.55), az = A.z + uz * (A.city.radius * 0.55);
    const bx = B.x - ux * (B.city.radius * 0.55), bz = B.z - uz * (B.city.radius * 0.55);

    // sample the path; ride above the terrain profile with a gentle sag between highs
    const NPTS = 22;
    const raw = [];
    for (let s = 0; s <= NPTS; s++) {
      const t = s / NPTS;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      // on floating worlds the hidden continent's heights are meaningless over the
      // void — only count terrain where island land actually exists
      const land = !islands || islands.atWorld(x, z);
      let h = land ? field.heightAt(x, z) : 4;
      if (land) {
        h = Math.max(h, field.heightAt(x + ux * 8, z + uz * 8), field.heightAt(x - ux * 8, z - uz * 8));
      }
      raw.push({ x, z, y: Math.max(6, h) + CLEAR });
    }
    // two smoothing passes → a calm, believable elevated line
    for (let pass = 0; pass < 2; pass++) {
      for (let s = 1; s < NPTS; s++) {
        raw[s].y = (raw[s - 1].y + raw[s].y * 2 + raw[s + 1].y) / 4;
      }
    }
    const pts = raw.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    const curve = new THREE.CatmullRomCurve3(pts);

    // the translucent tube + a slim solid spine so it reads at distance
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, 1.0, 8),
      new THREE.MeshStandardMaterial({
        color: TUBE, transparent: true, opacity: 0.34, roughness: 0.3, metalness: 0.2,
        emissive: TUBE, emissiveIntensity: 0.12, depthWrite: false,
      }));
    tube.castShadow = false;
    group.add(tube);
    const spine = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, 0.16, 6),
      new THREE.MeshStandardMaterial({ color: PYLON, roughness: 0.5, metalness: 0.3 }));
    spine.castShadow = false;
    group.add(spine);

    // pylons down to the ground every few samples
    for (let s = 2; s < NPTS - 1; s += 4) {
      const p = raw[s];
      if (islands && !islands.atWorld(p.x, p.z)) continue;   // no pylons over the void
      const groundY = Math.max(-1, field.heightAt(p.x, p.z));
      const h = p.y - groundY;
      if (h < 6) continue;
      const py = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.5, h, 6),
        new THREE.MeshStandardMaterial({ color: PYLON, flatShading: true, roughness: 0.8 }));
      py.position.set(p.x, groundY + h / 2, p.z);
      group.add(py);
    }

    // luminous data-pulses gliding through the tube (both directions)
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6),
        new THREE.MeshBasicMaterial({ color: PULSE }));
      group.add(m);
      pulses.push({ m, curve, off: k / 3 + rand() * 0.1, speed: 0.03 + rand() * 0.015, dir: k % 2 ? 1 : -1 });
    }
  }

  // ---- TWO quiet aircraft with PURPOSE: each flies toward a city, and once it
  // arrives overhead it picks a new destination — a tiny air service between the
  // settlements (the croquis nod, never a swarm).
  const craft = [];
  const pickTarget = (c) => {
    if (pads.length < 2) { c.target = pads[0] || { x: 0, z: 0 }; return; }
    let tgt;
    do { tgt = pads[(rand() * pads.length) | 0]; } while (tgt === c.target);
    c.target = tgt;
  };
  const spawnCraft = (o, speed, alt, turn) => {
    const from = pads[(rand() * pads.length) | 0] || { x: 0, z: 0 };
    const c = {
      o, speed, alt, turn,
      x: from.x + (rand() - 0.5) * 80, z: from.z + (rand() - 0.5) * 80,
      heading: rand() * Math.PI * 2, target: null, ph: rand() * 6.28, roll: 0,
    };
    pickTarget(c);
    group.add(o);
    craft.push(c);
  };
  spawnCraft(makeDirigible(), 4.5, 112 + rand() * 15, 0.22);
  spawnCraft(makeGlider(), 7.5, 90 + rand() * 20, 0.4);

  return {
    group,
    update(t, dt = 0.016) {
      for (const p of pulses) {
        const f = ((t * p.speed * p.dir + p.off) % 1 + 1) % 1;
        p.curve.getPointAt(f, p.m.position);
      }
      for (const c of craft) {
        const dx = c.target.x - c.x, dz = c.target.z - c.z;
        if (Math.hypot(dx, dz) < 32) pickTarget(c);           // arrived overhead → next stop
        const want = Math.atan2(dz, dx);
        let dh = want - c.heading;
        dh = ((dh + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        const applied = Math.max(-c.turn * dt, Math.min(c.turn * dt, dh));
        c.heading += applied;
        c.x += Math.cos(c.heading) * c.speed * dt;
        c.z += Math.sin(c.heading) * c.speed * dt;
        c.o.position.set(c.x, c.alt + Math.sin(t * 0.4 + c.ph) * 2.2, c.z);
        c.o.rotation.y = Math.PI / 2 - c.heading;             // nose along the course
        c.roll += (Math.max(-0.3, Math.min(0.3, dh * 0.5)) - c.roll) * Math.min(1, dt * 2);
        c.o.rotation.z = c.roll;                              // gentle bank into turns
      }
    },
  };
}

// ---- the aircraft: same wood-and-canvas language as Origin's flyers -----------
const WOOD = 0x7a5230, DWOOD = 0x5c3d20, CANVAS = 0xeadfc6, CANVAS2 = 0xe4cfa0, RUST = 0xc4763a;

function makeDirigible() {
  const a = new THREE.Group();
  const env = new THREE.Mesh(new THREE.SphereGeometry(4.4, 14, 10),
    new THREE.MeshStandardMaterial({ color: CANVAS, flatShading: true, roughness: 1 }));
  env.scale.set(1, 0.82, 1.95); env.position.y = 1.4; env.castShadow = true; a.add(env);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(4.36, 0.24, 6, 18),
    new THREE.MeshStandardMaterial({ color: RUST, flatShading: true, roughness: 1 }));
  stripe.rotation.y = Math.PI / 2; stripe.scale.set(1, 1.95, 0.82); stripe.position.y = 1.4; a.add(stripe);
  const gond = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 4.8),
    new THREE.MeshStandardMaterial({ color: WOOD, flatShading: true, roughness: 0.9 }));
  gond.position.y = -3; a.add(gond);
  const finV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.8, 2.4),
    new THREE.MeshStandardMaterial({ color: CANVAS2, flatShading: true, roughness: 1 }));
  finV.position.set(0, 1.4, -7.2); a.add(finV);
  return a;
}

function makeGlider() {
  const f = new THREE.Group();
  const mk = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 }));
  const fus = mk(0.9, 0.8, 6, DWOOD); f.add(fus);
  const wl = mk(10.8, 0.24, 3.4, CANVAS); wl.position.set(-5.4, 0.7, 0.4); wl.rotation.z = 0.14; f.add(wl);
  const wr = mk(10.8, 0.24, 3.4, CANVAS); wr.position.set(5.4, 0.7, 0.4); wr.rotation.z = -0.14; f.add(wr);
  const tail = mk(3.8, 0.2, 1.8, CANVAS2); tail.position.set(0, 0.4, -2.9); f.add(tail);
  return f;
}
