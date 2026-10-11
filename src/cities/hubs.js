// hubs.js — Hubs: the same music, in sync, on several devices, each on its own speaker.
// "THE ODEON": an open-air theatre built the wrong way round — the audience seats are
// empty and the SPEAKERS stand on the steps, all playing toward one microphone in the
// orchestra. That microphone is the whole idea of the tool: a Bluetooth speaker adds a
// delay nobody can read off a clock, so Hubs measures what is actually HEARD, at one
// spot. Every landmark is a real mechanism:
//  - the MICROPHONE (hero) with four arrival lamps and, on the floor around it, the
//    "gap between devices" gauge — one bar per device, collapsing to nothing once it
//    is compensated.
//  - four DEVICES on the steps (the tool's limit), each with its own speaker and its
//    own colour. Their wave packets leave at different moments so as to ARRIVE together.
//  - the SPECTRUM COLONNADE crowning the steps: the music's spectrum, where each device
//    owns one narrow band (PROBE.bands, 3.4–6.9 kHz) the others leave silent.
//  - the HOST: the computer on the steps is also the server. The station clock on its
//    mast is the one every device reads, spokes running out to the other three.
//  - the TURNTABLE and its delay line, climbing to the colonnade: ten 100 ms slices in
//    flight = the one-second delay between capture and playback.
//  - the GATE on the way in, carrying the room's address: a room is just a link (and
//    its doorway is the portal out).
// One master cycle tells the story the page tells: out of step → calibrate, one device
// at a time → in step, tracked while the music plays.
import * as THREE from 'three';
import { box, cyl, makeLabel, makeWallPortal, poiBeacon, tagPOI, tagPickable } from './kit.js';
import { smoothstep } from '../gen/noise.js';

const STONE = 0xd9cfba, STONE_LO = 0xbdb19a, STONE_HI = 0xece5d6;
const PAPER = 0xf5f4f0, INK = 0x1c1b19, GRAPHITE = 0x2a2b2e, SILVER = 0xb9bdc2, STEEL = 0x8f959c;
const GREEN = 0x1f6f5c, MINT = 0x5fc2a8, WALNUT = 0x6b4a33;
const CYPRESS = 0x2f4f3a, TRUNK = 0x5a4632;
// one colour per device slot, low band → high band
const BANDS = [0x2fa487, 0xe0a23a, 0xd9634f, 0x5b8fd6];

// The odeon opens toward the dive camera (frame.azimuth below). `at(u, v)` places
// things in that view's own axes: u = screen-right, v = depth away from the camera.
const AZ = 0.45;
const at = (u, v) => [u * Math.cos(AZ) - v * Math.sin(AZ), -u * Math.sin(AZ) - v * Math.cos(AZ)];
const at3 = (u, v, y) => { const [x, z] = at(u, v); return new THREE.Vector3(x, y, z); };

// The whole site stands LIFT above the city origin (which world.js sinks half a unit),
// and everything that meets the ground runs SKIRT below it, so the residual relief the
// terrain keeps under a city never swallows a floor or leaves a wall hanging.
const LIFT = 0.5, SKIRT = 2;

// the steps: TIERS rings, each STEP deep and RISE high
const TIERS = 6, R0 = 9, STEP = 3.2, H0 = 1.0, RISE = 1.15, SPAN = 3.85;   // SPAN ≈ 220°
const PHI0 = AZ + Math.PI - SPAN / 2;
const tierY = (k) => H0 + k * RISE;
const RIM = R0 + TIERS * STEP;
const FLOOR = 0.5;                       // orchestra floor and avenue level

// the story's clock. Timing errors are in seconds of ARRIVAL at the microphone.
const PERIOD = 26, BEAT = 1.3, SPEED = 12, PACKETS = 4;
const OFFSETS = [0, 0.5, -0.35, 0.7];
const T_CAL = 6, SLOT = 1.25, T_TRACK = T_CAL + 4 * SLOT, T_DRIFT = 24.5;

// spectrum colonnade: COLS columns over 0–8 kHz; each device's band falls on two of them
const COLS = 28, HZ_PER_COL = 8000 / COLS, COL_W = 1.55;
const BAND_HZ = [[3400, 4000], [4300, 4900], [5300, 5900], [6300, 6900]];   // dsp.js PROBE.bands
const colBand = (j) => BAND_HZ.findIndex(([a, b]) => (j + 0.5) * HZ_PER_COL > a && (j + 0.5) * HZ_PER_COL < b);

const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);   // grows upward from its base

function lit(color, intensity = 1.4) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, flatShading: true, roughness: 0.5 });
}


// a loudspeaker driver facing local +Z: dark cone, silver surround. Returns the cone
// (the part that pumps).
function driver(parent, x, y, z, r) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 6, 16),
    new THREE.MeshStandardMaterial({ color: SILVER, flatShading: true, roughness: 0.4, metalness: 0.5 }));
  ring.position.set(x, y, z); parent.add(ring);
  const cone = cyl(r * 0.5, r * 0.92, r * 0.5, GRAPHITE, 14, { roughness: 0.7 });
  cone.rotation.x = Math.PI / 2; cone.position.set(x, y, z - r * 0.12);
  cone.castShadow = false; parent.add(cone);
  return cone;
}

// a slab phone standing on its short edge, screen toward local +Z
function phone(parent, x, z, screenColor, screenGlow) {
  parent.add(box(1.5, 3.0, 0.22, INK, { pos: [x, 1.7, z], roughness: 0.35, metalness: 0.3 }));
  parent.add(box(0.5, 0.25, 0.9, GRAPHITE, { pos: [x, 0.12, z - 0.1], roughness: 0.6 }));   // dock
  const screen = box(1.26, 2.6, 0.04, screenColor, {
    pos: [x, 1.72, z + 0.13], emissive: screenColor, emissiveIntensity: screenGlow, cast: false, receive: false,
  });
  parent.add(screen);
  return screen;
}

function cypress(x, z, h) {
  const tree = new THREE.Group(); tree.position.set(x, 0, z);
  tree.add(cyl(0.16, 0.22, h * 0.22 + SKIRT, TRUNK, 5, { pos: [0, (h * 0.22 - SKIRT) / 2, 0] }));
  const crown = new THREE.Mesh(new THREE.ConeGeometry(h * 0.16, h * 0.86, 7),
    new THREE.MeshStandardMaterial({ color: CYPRESS, flatShading: true, roughness: 0.95 }));
  crown.position.y = h * 0.6; crown.castShadow = true; tree.add(crown);
  return tree;
}

// the room's address, lettered on a board (unlit, so it stays legible in shade)
function signBoard(text, w, h) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f5f4f0'; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#1f6f5c'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = '#1c1b19'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 76px ui-monospace, "DejaVu Sans Mono", Menlo, monospace';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

export function build() {
  const g = new THREE.Group();
  const site = new THREE.Group(); site.position.y = LIFT; g.add(site);

  // ===== THE STEPS — one lathed profile, every tread a ring of equal delay ======
  const cavea = new THREE.Group(); site.add(cavea); tagPOI(cavea, 'mic');
  const profile = [new THREE.Vector2(R0, -SKIRT)];
  for (let k = 0; k < TIERS; k++) {
    profile.push(new THREE.Vector2(R0 + k * STEP, tierY(k)), new THREE.Vector2(R0 + (k + 1) * STEP, tierY(k)));
  }
  profile.push(new THREE.Vector2(RIM, -SKIRT));
  const steps = new THREE.Mesh(new THREE.LatheGeometry(profile, 44, PHI0, SPAN),
    new THREE.MeshStandardMaterial({ color: STONE, flatShading: true, roughness: 0.92, side: THREE.DoubleSide }));
  steps.castShadow = true; steps.receiveShadow = true; cavea.add(steps);
  // the two cut ends of the arc, closed with the same stepped profile
  const endShape = new THREE.Shape(profile);
  for (const phi of [PHI0, PHI0 + SPAN]) {
    const wall = new THREE.Mesh(new THREE.ShapeGeometry(endShape),
      new THREE.MeshStandardMaterial({ color: STONE_LO, flatShading: true, roughness: 0.92, side: THREE.DoubleSide }));
    wall.rotation.y = phi - Math.PI / 2; wall.castShadow = true; cavea.add(wall);
  }
  // a green inlay along every tread
  const inlayMat = new THREE.MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 0.25, roughness: 0.7 });
  for (let k = 0; k < TIERS; k++) {
    const r = R0 + (k + 0.5) * STEP;
    const inlay = new THREE.Mesh(new THREE.RingGeometry(r - 0.13, r + 0.13, 56, 1, PHI0 - Math.PI / 2, SPAN), inlayMat);
    inlay.rotation.x = -Math.PI / 2; inlay.position.y = tierY(k) + 0.04; inlay.receiveShadow = true;
    cavea.add(inlay);
  }
  // the orchestra floor
  cavea.add(cyl(R0, R0, FLOOR + SKIRT, STONE_HI, 40, { pos: [0, (FLOOR - SKIRT) / 2, 0], roughness: 0.9 }));
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(R0 - 0.9, R0 - 0.6, 48), inlayMat);
  floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = FLOOR + 0.03; cavea.add(floorRing);

  // ===== THE MICROPHONE — the one place where everything is measured ============
  const mic = new THREE.Group(); mic.position.y = FLOOR; site.add(mic); tagPOI(mic, 'mic');
  mic.add(cyl(2.3, 2.8, 0.9, GREEN, 20, { pos: [0, 0.45, 0], roughness: 0.55, metalness: 0.2 }));
  mic.add(cyl(1.0, 1.5, 0.7, STEEL, 14, { pos: [0, 1.2, 0], roughness: 0.4, metalness: 0.5 }));
  mic.add(cyl(0.34, 0.44, 10.6, STEEL, 10, { pos: [0, 6.6, 0], roughness: 0.4, metalness: 0.5 }));
  const HEAD = 16.1;                                           // capsule centre, above the floor
  mic.add(cyl(1.3, 1.1, 3.6, GREEN, 14, { pos: [0, 13.3, 0], roughness: 0.45, metalness: 0.3 }));     // body
  const led = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.14, 6, 24), lit(MINT, 1.6));
  led.rotation.x = Math.PI / 2; led.position.y = 15.1; mic.add(led);
  mic.add(cyl(1.6, 1.6, 2.4, SILVER, 14, { pos: [0, 16.4, 0], roughness: 0.35, metalness: 0.55 }));   // basket
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: SILVER, flatShading: true, roughness: 0.35, metalness: 0.55 }));
  dome.position.y = 17.6; dome.castShadow = true; mic.add(dome);
  for (const y of [15.6, 16.4, 17.2]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.06, 5, 24),
      new THREE.MeshStandardMaterial({ color: GRAPHITE, flatShading: true, roughness: 0.5 }));
    band.rotation.x = Math.PI / 2; band.position.y = y; mic.add(band);
  }
  // shock mount: a ring around the body, held by four elastics
  const mount = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.13, 6, 28),
    new THREE.MeshStandardMaterial({ color: STEEL, flatShading: true, roughness: 0.4, metalness: 0.5 }));
  mount.rotation.x = Math.PI / 2; mount.position.y = 13.1; mic.add(mount);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const strap = box(1.15, 0.07, 0.07, STONE_HI, { pos: [Math.cos(a) * 1.9, 13.1, Math.sin(a) * 1.9], cast: false });
    strap.rotation.y = -a; mic.add(strap);
  }
  // the beat landing at the microphone, once everything arrives together
  const syncRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 5, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  syncRing.rotation.x = Math.PI / 2; syncRing.position.y = HEAD; mic.add(syncRing);
  const micHead = new THREE.Vector3(0, FLOOR + HEAD, 0);       // where the waves land (site space)

  // ===== THE FOUR DEVICES ========================================================
  // tier: which step it stands on (-1 = its own plinth beyond the rim); beta: angle
  // along the arc from its centre. Different distances on purpose: each one has to
  // start at a different moment for all of them to land together.
  const DEV_SCALE = 1.4;
  const SPECS = [
    { kind: 'computer', tier: 1, beta: -0.45 },
    { kind: 'bluetooth', tier: 3, beta: 0.75 },
    { kind: 'android', tier: 4, beta: -0.95 },
    { kind: 'far', tier: -1, beta: 1.02, r: 38 },
  ];
  // one wavefront: a short arc lying flat, bulging toward +X, its crest at the origin
  const WAVE_R = 3.8;
  const waveGeo = new THREE.TorusGeometry(WAVE_R, 0.26, 5, 14, 1.0);
  waveGeo.rotateZ(-0.5); waveGeo.rotateX(Math.PI / 2); waveGeo.translate(-WAVE_R, 0, 0);
  const devices = SPECS.map((sp, i) => {
    const color = BANDS[i];
    const r = sp.r ?? R0 + (sp.tier + 0.5) * STEP;
    const phi = AZ + Math.PI + sp.beta;
    const x = Math.sin(phi) * r, z = Math.cos(phi) * r;
    const y = sp.tier < 0 ? 5.2 : tierY(sp.tier);
    const stand = new THREE.Group();
    stand.position.set(x, y, z);
    stand.rotation.y = Math.atan2(-x, -z);                     // local +Z looks at the microphone
    site.add(stand); tagPOI(stand, 'calibration');
    // a level stand reaching down through the lower steps (to the ground, beyond the rim)
    const foot = y + (sp.tier < 0 ? SKIRT : 0);
    stand.add(box(7.6, foot + 0.4, 6.2, sp.tier < 0 ? STONE_LO : STONE_HI, { pos: [0, 0.4 - (foot + 0.4) / 2, 0], roughness: 0.9 }));
    stand.add(box(7.6, 0.18, 0.24, color, { pos: [0, 0.4, 3.0], emissive: color, emissiveIntensity: 0.9, cast: false }));
    const dev = new THREE.Group(); dev.position.y = 0.4; dev.scale.setScalar(DEV_SCALE); stand.add(dev);

    const cones = [];
    let screen = null, srcY = 2.6;
    if (sp.kind === 'computer') {
      // the living-room computer (it also hosts the server) and a bookshelf speaker
      dev.add(box(3.0, 0.22, 2.0, GRAPHITE, { pos: [-1.2, 0.12, 0.5], roughness: 0.5, metalness: 0.3 }));
      const lid = new THREE.Group(); lid.position.set(-1.2, 0.2, -0.5); lid.rotation.x = -0.22; dev.add(lid);
      lid.add(box(3.0, 2.0, 0.14, GRAPHITE, { pos: [0, 1.0, 0], roughness: 0.5, metalness: 0.3 }));
      screen = box(2.7, 1.72, 0.04, PAPER, { pos: [0, 1.02, 0.09], emissive: PAPER, emissiveIntensity: 0.7, cast: false, receive: false });
      lid.add(screen);
      lid.add(box(0.9, 0.3, 0.05, GREEN, { pos: [-0.7, 0.55, 0.12], emissive: GREEN, emissiveIntensity: 0.8, cast: false, receive: false }));
      dev.add(box(1.7, 3.3, 1.6, WALNUT, { pos: [1.6, 1.65, 0], roughness: 0.75 }));
      cones.push(driver(dev, 1.6, 2.45, 0.84, 0.36), driver(dev, 1.6, 1.15, 0.84, 0.62));
      srcY = 2.0;
    } else if (sp.kind === 'bluetooth') {
      // a phone, and the Bluetooth cylinder it plays through — the slow link
      screen = phone(dev, -1.6, 0.2, 0x1f3a33, 0.9);
      const body = cyl(0.95, 0.95, 3.2, 0x8c3a2e, 16, { roughness: 0.8 });
      body.rotation.z = Math.PI / 2; body.position.set(1.0, 1.25, 0.2); dev.add(body);
      for (const dx of [-0.2, 2.2]) dev.add(box(0.2, 0.7, 1.0, GRAPHITE, { pos: [dx, 0.35, 0.2], roughness: 0.6 }));
      cones.push(driver(dev, 0.4, 1.25, 1.12, 0.52), driver(dev, 1.6, 1.25, 1.12, 0.52));
      srcY = 1.3;
    } else if (sp.kind === 'android') {
      // the phone running the Android app: screen OFF, still playing
      screen = phone(dev, -1.5, 0.2, 0x0c0d0f, 0.15);
      dev.add(box(0.18, 0.18, 0.05, MINT, { pos: [-1.5, 3.0, 0.34], emissive: MINT, emissiveIntensity: 2.2, cast: false, receive: false }));
      dev.add(box(2.2, 2.2, 1.9, 0x35506b, { pos: [1.1, 1.1, 0], roughness: 0.7 }));
      cones.push(driver(dev, 1.1, 1.15, 0.98, 0.74));
      srcY = 1.2;
    } else {
      // the far speaker: a floor-stander beyond the rim, heard mostly through the room
      dev.add(box(1.7, 5.6, 1.9, 0x3a3340, { pos: [0, 2.8, 0], roughness: 0.7 }));
      cones.push(driver(dev, 0, 4.7, 0.98, 0.34), driver(dev, 0, 3.4, 0.98, 0.6), driver(dev, 0, 1.9, 0.98, 0.6));
      srcY = 3.3;
    }

    // its place in the spectrum: four cells, only its own one sounding
    const cells = BANDS.map((c, b) => {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.12),
        b === i ? lit(c, 0.2) : new THREE.MeshStandardMaterial({ color: STONE_LO, flatShading: true, roughness: 0.9 }));
      cell.position.set((b - 1.5) * 0.78, 0.32, 1.95); dev.add(cell);
      return cell;
    });

    // the waves it sends to the microphone: packets of three wavefronts in flight
    stand.updateMatrix();
    const src = new THREE.Vector3(0, 0.4 + srcY * DEV_SCALE, 1.6 * DEV_SCALE).applyMatrix4(stand.matrix);
    const dir = new THREE.Vector3().subVectors(micHead, src);
    const dist = dir.length();
    const fan = new THREE.Group(); fan.position.copy(src);
    fan.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
    site.add(fan);
    const waves = [];
    for (let n = 0; n < PACKETS * 3; n++) {
      const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
      fan.add(m); waves.push(m);
    }
    // the calibration sweep, when its turn comes
    const chirp = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    fan.add(chirp);

    // its arrival lamp on the microphone, on the side it plays from
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), lit(color, 0.4));
    lamp.position.set(-dir.x * 1.78, HEAD + 0.3, -dir.z * 1.78); mic.add(lamp);
    // its bar in the gap gauge on the orchestra floor
    const gauge = new THREE.Mesh(unitBox, lit(color, 0.9));
    gauge.rotation.y = Math.atan2(x, z);                       // local +Z points at the device
    gauge.userData.dir = new THREE.Vector2(x, z).normalize();
    cavea.add(gauge);

    // an aerial behind it: where the clock's spoke lands
    const aerialH = sp.kind === 'far' ? 11 : 8.4;
    stand.add(cyl(0.1, 0.1, aerialH, GRAPHITE, 5, { pos: [0, 0.4 + aerialH / 2, -2.75], roughness: 0.6 }));
    const top = new THREE.Vector3(0, 0.4 + aerialH, -2.75).applyMatrix4(stand.matrix);

    return { stand, cones, screen, cells, waves, chirp, lamp, gauge, dist, top, x, y, z };
  });
  const coneRest = devices.map((d) => d.cones.map((c) => c.position.z));

  // ===== THE SPECTRUM COLONNADE — the music, band by band, crowning the steps ===
  const colonnade = new THREE.Group(); site.add(colonnade); tagPOI(colonnade, 'spectrum');
  const COL_SPAN = 2.5, colR = RIM - 1.1, colBase = tierY(TIERS - 1);
  const columns = [];
  for (let j = 0; j < COLS; j++) {
    const phi = AZ + Math.PI - COL_SPAN / 2 + (j / (COLS - 1)) * COL_SPAN;
    const b = colBand(j);
    const mat = new THREE.MeshStandardMaterial({ color: STONE_HI, emissive: 0xffffff, emissiveIntensity: 0, flatShading: true, roughness: 0.85 });
    const col = new THREE.Mesh(unitBox, mat);
    col.position.set(Math.sin(phi) * colR, colBase, Math.cos(phi) * colR);
    col.rotation.y = phi; col.castShadow = true;
    colonnade.add(col);
    // a device's band: a sleeve in its colour, drawn over the stone once tracking is on
    let sleeve = null;
    if (b >= 0) {
      sleeve = new THREE.Mesh(unitBox, lit(BANDS[b], 0.9));
      sleeve.material.transparent = true; sleeve.material.opacity = 0;
      sleeve.position.copy(col.position); sleeve.rotation.y = phi; sleeve.castShadow = false;
      colonnade.add(sleeve);
    }
    const foot = box(COL_W + 0.4, 0.34, COL_W + 0.4, STONE_LO, { pos: [col.position.x, colBase + 0.17, col.position.z], roughness: 0.9 });
    foot.rotation.y = phi; colonnade.add(foot);
    columns.push({ m: col, mat, sleeve, rest: 2.6 + 8.2 * Math.exp(-j / 10) });
  }

  // ===== THE HOST — the living-room computer is also the server =================
  // Its clock is the one every device reads: a station clock on the mast behind it,
  // spokes running out to the other three, a tick going out and coming back.
  const host = devices[0];
  tagPOI(host.stand, 'clock');
  host.stand.add(cyl(0.2, 0.26, 8.6, GRAPHITE, 6, { pos: [0, 4.7, -2.75], roughness: 0.6 }));
  const clock = new THREE.Group(); clock.position.set(0, 10.4, -2.75); host.stand.add(clock);
  const drum = cyl(1.5, 1.5, 0.5, GREEN, 24, { roughness: 0.5 });
  drum.rotation.x = Math.PI / 2; clock.add(drum);
  const hands = [];
  for (const side of [1, -1]) {            // one face toward the steps, one toward the hills
    const face = new THREE.Group(); face.position.z = side * 0.27; face.rotation.y = side > 0 ? 0 : Math.PI; clock.add(face);
    const dial = cyl(1.28, 1.28, 0.06, PAPER, 24, { roughness: 0.6, emissive: PAPER, emissiveIntensity: 0.35 });
    dial.rotation.x = Math.PI / 2; face.add(dial);
    for (let h = 0; h < 12; h += 3) {
      const a = h * Math.PI / 6;
      const mark = box(0.1, 0.3, 0.04, INK, { pos: [Math.sin(a) * 1.0, Math.cos(a) * 1.0, 0.05], cast: false });
      mark.rotation.z = -a; face.add(mark);
    }
    const minute = new THREE.Group(); minute.position.z = 0.06; face.add(minute);
    minute.add(box(0.11, 1.0, 0.04, INK, { pos: [0, 0.45, 0], cast: false }));
    const hour = new THREE.Group(); hour.position.z = 0.08; face.add(hour);
    hour.add(box(0.15, 0.66, 0.04, INK, { pos: [0, 0.3, 0], cast: false }));
    hands.push({ minute, hour });
  }
  const hub = new THREE.Vector3(0, 11.9, -2.75).applyMatrix4(host.stand.matrix);
  const others = devices.slice(1);
  const spokePts = [];
  for (const d of others) spokePts.push(hub.x, hub.y, hub.z, d.top.x, d.top.y, d.top.z);
  const spokeGeo = new THREE.BufferGeometry();
  spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(spokePts, 3));
  site.add(new THREE.LineSegments(spokeGeo, new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.45, depthWrite: false })));
  const ticks = others.map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: MINT }));
    site.add(m);
    return m;
  });

  // ===== THE TURNTABLE & THE DELAY LINE — what plays here comes out everywhere ==
  const [tx, tz] = at(35, -19);
  const live = new THREE.Group(); site.add(live); tagPOI(live, 'live');
  const deck = new THREE.Group(); deck.position.set(tx, 0, tz); deck.rotation.y = AZ; live.add(deck);
  deck.add(box(6.4, 1.6 + SKIRT, 6.0, WALNUT, { pos: [0, (1.6 - SKIRT) / 2, 0], roughness: 0.75 }));
  deck.add(box(6.6, 0.2, 6.2, GRAPHITE, { pos: [0, 1.7, 0], roughness: 0.5, metalness: 0.3 }));
  const platter = new THREE.Group(); platter.position.set(-0.5, 1.8, 0.2); deck.add(platter);
  platter.add(cyl(2.4, 2.4, 0.22, SILVER, 28, { pos: [0, 0.11, 0], roughness: 0.4, metalness: 0.5 }));
  platter.add(cyl(2.25, 2.25, 0.1, INK, 28, { pos: [0, 0.27, 0], roughness: 0.3 }));
  platter.add(cyl(0.78, 0.78, 0.12, GREEN, 18, { pos: [0, 0.29, 0], roughness: 0.6, emissive: GREEN, emissiveIntensity: 0.4 }));
  platter.add(box(0.5, 0.06, 0.16, PAPER, { pos: [0.45, 0.37, 0], cast: false }));          // so the spin shows
  for (const r of [1.25, 1.75]) {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 4, 28),
      new THREE.MeshStandardMaterial({ color: 0x3a3b40, roughness: 0.4 }));
    groove.rotation.x = Math.PI / 2; groove.position.y = 0.33; platter.add(groove);
  }
  deck.add(cyl(0.28, 0.28, 0.9, SILVER, 10, { pos: [2.5, 2.25, -2.1], roughness: 0.4, metalness: 0.5 }));
  const arm = box(0.14, 0.14, 3.3, SILVER, { pos: [1.75, 2.6, -0.75], roughness: 0.4, metalness: 0.5 });
  arm.rotation.y = 0.5; deck.add(arm);

  // the rail from the deck up to the colonnade's bass end — the music arriving at the
  // theatre: ten slices in flight = one second between capture and playback
  const railPhi = AZ + Math.PI - COL_SPAN / 2;                 // the first column's angle
  const railA = at3(34.6, -15.4, 3.2);
  const railB = new THREE.Vector3(Math.sin(railPhi) * (RIM - 0.1), colBase + 1.3, Math.cos(railPhi) * (RIM - 0.1));
  const railDir = new THREE.Vector3().subVectors(railB, railA);
  const railLen = railDir.length();
  const railYaw = Math.atan2(railDir.x, railDir.z);
  const railQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), railDir.clone().normalize());
  const railMid = railA.clone().add(railB).multiplyScalar(0.5);
  for (const dx of [-0.75, 0.75]) {
    const beam = box(0.16, 0.16, railLen, GRAPHITE, { roughness: 0.5, metalness: 0.3, cast: false });
    beam.position.set(railMid.x + Math.cos(railYaw) * dx, railMid.y - 0.75, railMid.z - Math.sin(railYaw) * dx);
    beam.quaternion.copy(railQuat); live.add(beam);
  }
  for (let s = 0; s < 5; s++) {                                // trestles; the far end rests on the rim
    const p = railA.clone().lerp(railB, s / 5);
    const h = p.y - 0.8 + SKIRT;
    live.add(cyl(0.16, 0.22, h, GRAPHITE, 6, { pos: [p.x, p.y - 0.8 - h / 2, p.z], roughness: 0.6 }));
  }
  const SLICES = 10;
  const slices = [];
  for (let s = 0; s < SLICES; s++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.5),
      new THREE.MeshStandardMaterial({ color: MINT, emissive: MINT, emissiveIntensity: 0.7, flatShading: true, transparent: true, opacity: 0.85 }));
    m.rotation.y = railYaw; m.castShadow = false; live.add(m); slices.push(m);
  }

  // ===== THE WAY IN — a room is an address: /r/CODE, joined by a link ===========
  const avenue = new THREE.Group(); avenue.rotation.y = AZ; site.add(avenue);   // local +Z = toward the camera
  avenue.add(box(5.2, FLOOR + SKIRT, 27.5, STONE_HI, { pos: [0, (FLOOR - SKIRT) / 2, 23.25], roughness: 0.9 }));
  for (const dx of [-2.75, 2.75]) {
    avenue.add(box(0.34, 0.2, 27.5, GREEN, { pos: [dx, FLOOR, 23.25], roughness: 0.7, emissive: GREEN, emissiveIntensity: 0.25, cast: false }));
  }
  const GATE_Z = 34;
  for (const dx of [-4.4, 4.4]) {
    avenue.add(box(1.5, 8.4 + SKIRT, 1.5, STONE, { pos: [dx, (8.4 - SKIRT) / 2, GATE_Z], roughness: 0.9 }));
    avenue.add(box(1.9, 0.5, 1.9, STONE_HI, { pos: [dx, 8.65, GATE_Z], roughness: 0.85 }));
    avenue.add(box(0.5, 0.5, 0.5, MINT, { pos: [dx, 9.2, GATE_Z], emissive: MINT, emissiveIntensity: 1.5, cast: false }));
  }
  avenue.add(box(10.6, 0.6, 1.1, STONE_LO, { pos: [0, 8.1, GATE_Z], roughness: 0.9 }));
  avenue.add(box(7.3, 2.05, 0.2, GREEN, { pos: [0, 6.7, GATE_Z + 0.45], roughness: 0.6 }));
  const sign = signBoard('/r/SALON', 7.0, 1.75); sign.position.set(0, 6.7, GATE_Z + 0.62); avenue.add(sign);
  // the way out is the way in: the gate's own doorway
  const portal = makeWallPortal('#5fc2a8', 5.2, 4.4);
  portal.group.position.set(0, FLOOR, GATE_Z + 0.15);
  avenue.add(portal.group);

  // ===== cypresses around the theatre, and lining the way in ====================
  const TREES = [
    [-41, -4, 7.5], [-43, 9, 9], [-37, 32, 7], [-22, 38, 8.5], [-8, 40, 7.5], [8, 41, 9],
    [20, 37, 7], [33, 26, 8.5], [41, 14, 7], [43, 1, 8], [24, -32, 7.5], [-26, -26, 8.5], [-33, -15, 7],
    [-6.5, -15, 6.5], [6.5, -15, 6.5], [-6.5, -23, 7], [6.5, -23, 7], [-6.5, -31, 6.5], [6.5, -31, 6.5],
  ];
  for (const [u, v, h] of TREES) { const [x, z] = at(u, v); site.add(cypress(x, z, h)); }

  // ===== POI beacons ============================================================
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); site.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('mic', '#5fc2a8', 0, 22.5, 0);
  addBeacon('calibration', '#e0a23a', devices[1].x, devices[1].y + 9.5, devices[1].z);   // over the Bluetooth pair
  { const [x, z] = at(0, RIM - 1.1); addBeacon('spectrum', '#5b8fd6', x, colBase + 14, z); }
  addBeacon('clock', '#5fc2a8', hub.x, hub.y + 2.8, hub.z);
  addBeacon('live', '#5fc2a8', tx, 7.5, tz);

  const label = makeLabel('Hubs', 'Synchronized Audio', '#1f6f5c');
  label.sprite.position.set(0, 31, 0); site.add(label.sprite);

  tagPickable(g, 'hubs');

  // timing error of device i at story time tau (seconds of arrival at the microphone)
  const errorAt = (i, tau) => {
    if (tau < T_CAL) return OFFSETS[i];
    if (tau < T_TRACK) return OFFSETS[i] * (1 - smoothstep(T_CAL + i * SLOT + 0.3, T_CAL + (i + 1) * SLOT - 0.1, tau));
    if (tau < T_DRIFT) return 0.03 * Math.sin(tau * 1.3 + i * 2.1) * Math.exp(-(tau - T_TRACK) * 0.5);
    return OFFSETS[i] * smoothstep(T_DRIFT, PERIOD, tau);
  };

  return {
    group: g, label,
    frame: { target: [0.5, 8, 5], azimuth: AZ, polar: 56, radius: 92 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);

      const tau = t % PERIOD;
      const trackGlow = smoothstep(T_TRACK, T_TRACK + 0.8, tau) * (1 - smoothstep(T_DRIFT, T_DRIFT + 0.8, tau));
      const calIdx = tau >= T_CAL && tau < T_TRACK ? Math.floor((tau - T_CAL) / SLOT) : -1;
      const calF = calIdx >= 0 ? (tau - T_CAL - calIdx * SLOT) / SLOT : 0;

      let worst = 0;
      devices.forEach((d, i) => {
        const e = errorAt(i, tau);
        worst = Math.max(worst, Math.abs(e));
        // phase since this device's last arrival at the microphone: 0 = it lands now
        const ph = (((t - e) / BEAT) % 1 + 1) % 1;
        const since = ph * BEAT;

        // wave packets: each beat sends three fronts, timed to land on the beat (+ error)
        for (let p = 0; p < PACKETS; p++) {
          const lead = (p - ph) * BEAT;                         // seconds until this packet lands
          for (let a = 0; a < 3; a++) {
            const w = d.waves[p * 3 + a];
            const R = d.dist - lead * SPEED - a * 2.1;         // how far this front has travelled
            const on = R > 1 && R < d.dist - 0.6;
            w.visible = on;
            if (on) {
              w.position.x = R;
              w.scale.setScalar(0.7 + 0.6 * R / d.dist);
              w.material.opacity = 0.95 * smoothstep(1, 3.5, R) * (1 - smoothstep(d.dist - 3, d.dist - 0.6, R)) * (1 - a * 0.25);
            }
          }
        }
        // the cones kick as each packet leaves
        const sentAgo = (((t - e + d.dist / SPEED) / BEAT) % 1 + 1) % 1 * BEAT;
        const kick = Math.exp(-sentAgo * 5);
        d.cones.forEach((c, ci) => { c.position.z = coneRest[i][ci] + kick * 0.16; });

        // calibration: its turn → a white sweep to the microphone
        const cal = calIdx === i;
        d.chirp.visible = cal && calF < 0.55;
        if (d.chirp.visible) {
          d.chirp.position.x = 1.5 + (calF / 0.55) * (d.dist - 2.5);
          d.chirp.scale.setScalar(1.5);
          d.chirp.material.opacity = 0.95;
        }
        if (i < 2) d.screen.material.emissiveIntensity = (i === 0 ? 0.7 : 0.9) + (cal ? 0.9 : 0);

        // its lamp fires when it lands; its bar in the gauge is how far off it is
        d.lamp.material.emissiveIntensity = 0.35 + 3.2 * Math.exp(-since * 6);
        const len = 0.5 + Math.abs(e) * 6.4;
        const gd = d.gauge.userData.dir;
        d.gauge.scale.set(0.6, 0.2, len);
        d.gauge.position.set(gd.x * (3.3 + len / 2), FLOOR, gd.y * (3.3 + len / 2));
        // only its own band sounds once tracking is on
        d.cells[i].material.emissiveIntensity = 0.2 + trackGlow * (1.3 + kick);
      });

      // the microphone: listening hard while calibrating, a ring on every true beat
      led.material.emissiveIntensity = calIdx >= 0 ? 2.8 : 1.3 + Math.sin(t * 2) * 0.3;
      const beatPh = ((t / BEAT) % 1 + 1) % 1;
      const inStep = worst < 0.08;
      syncRing.visible = inStep;
      if (inStep) {
        syncRing.scale.setScalar(1.8 + beatPh * 9);
        syncRing.material.opacity = 0.85 * (1 - beatPh) * (1 - beatPh);
      }

      // the colonnade: the music's spectrum; the sweep runs up it during calibration,
      // and once tracking is on each device's own band lights in its colour
      const beatKick = Math.exp(-beatPh * BEAT * 4);
      const sweepCol = calIdx >= 0 && calF < 0.55 ? (1000 + (calF / 0.55) * 5000) / HZ_PER_COL : -9;
      columns.forEach((c, j) => {
        const wob = 0.5 + 0.5 * Math.sin(t * (1.9 + (j % 7) * 0.33) + j * 1.7);
        const h = c.rest * (0.45 + 0.55 * wob) + (j < 6 ? beatKick * 2.6 : 0);
        c.m.scale.set(COL_W, h, COL_W);
        c.mat.emissiveIntensity = Math.max(0, 1 - Math.abs(j - sweepCol) / 1.6) * 0.9;
        if (c.sleeve) {
          c.sleeve.visible = trackGlow > 0.01;
          c.sleeve.scale.set(COL_W + 0.08, h + 0.04, COL_W + 0.08);
          c.sleeve.material.opacity = trackGlow;
          c.sleeve.material.emissiveIntensity = 0.7 + wob * 0.6;
        }
      });

      // the host's clock, and a tick out to each other device and back
      for (const h of hands) { h.minute.rotation.z = -t * 0.5; h.hour.rotation.z = -t * 0.5 / 12; }
      ticks.forEach((m, i) => {
        const f = ((t * 0.5 + i * 0.33) % 1);
        m.position.lerpVectors(hub, others[i].top, f < 0.5 ? f * 2 : 2 - f * 2);
      });

      // the deck turns; ten slices ride the rail, one second from capture to playback
      platter.rotation.y = -t * 2.1;
      for (let s = 0; s < SLICES; s++) {
        const f = ((t * 0.1 + s / SLICES) % 1);
        slices[s].position.lerpVectors(railA, railB, f);
        slices[s].material.opacity = 0.85 * smoothstep(0, 0.06, f) * (1 - smoothstep(0.94, 1, f));
      }
    },
  };
}
