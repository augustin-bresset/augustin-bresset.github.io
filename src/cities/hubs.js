// hubs.js — Hubs: the same music, in sync, on several devices, each on its own speaker.
// "LA FÊTE": a town on the night of its street party. The whole town plays one music
// from four sound towers, and it only works because of the one MICROPHONE standing in
// the middle of the square: a Bluetooth speaker adds a delay nobody can read off a
// clock, so Hubs measures what is actually HEARD, at one spot. Every landmark is a
// real mechanism:
//  - the MICROPHONE (hero) on the square, four arrival lamps on its head and, on the
//    paving around it, the "gap between devices" gauge — one bar per device.
//  - four SOUND TOWERS (the tool's limit), one colour each. Their wave packets leave
//    at different moments so as to ARRIVE together — and the dancers near each tower
//    jump to what THEY hear: out of step at first, all together once calibrated.
//  - the row of narrow HOUSES behind the square is the music's spectrum: each house a
//    slice of frequency, its lit windows the level; four pairs of houses are the bands
//    each device keeps to itself (dsp.js PROBE.bands, 3.4–6.9 kHz).
//  - the TOWN HALL keeps the one clock everybody reads (the server), spokes running out
//    to every tower.
//  - the DJ BOOTH is what plays; ten lanterns in flight on its cable = the one-second
//    delay between capture and playback, in 100 ms slices.
//  - the GATE on the way in carries the room's address — a room is just a link — and
//    its doorway is the portal out.
// One master cycle tells the story the page tells: out of step → calibrate, one tower
// at a time → in step, tracked while the music plays.
import * as THREE from 'three';
import { box, cyl, makeLabel, makeWallPortal, poiBeacon, tagPOI, tagPickable } from './kit.js';
import { Fabric, district, GROUND } from './urban.js';
import { smoothstep } from '../gen/noise.js';

const STONE = 0xd9cfba, STONE_LO = 0xbdb19a, STONE_HI = 0xece5d6, COBBLE = 0xcbc2b0;
const PAPER = 0xf5f4f0, INK = 0x1c1b19, GRAPHITE = 0x2a2b2e, SILVER = 0xb9bdc2, STEEL = 0x8f959c;
const GREEN = 0x1f6f5c, MINT = 0x5fc2a8, WALNUT = 0x6b4a33, CREAM = 0xf1e8d6;
// one colour per device slot, low band → high band
const BANDS = [0x2fa487, 0xe0a23a, 0xd9634f, 0x5b8fd6];
// plaster and tiles of an old town
const WALLS = [0xe9dcc3, 0xe2c9a6, 0xd9b99a, 0xecd9b8, 0xd7c7ae, 0xe6cfc0];
const ROOFS = [0x9a5a44, 0x8a4f3d, 0xa86a4c, 0x6f6a66];

// The town is squared to the dive camera (frame.azimuth): inside `town`, +X is
// screen-right and +Z comes toward the viewer.
const AZ = 0.45;
// polar placement inside the town: angle 0 = toward the viewer, π = the back of the square
const polar = (a, r) => [Math.sin(a) * r, Math.cos(a) * r];

const SQUARE_R = 13.5, ROW_R = 19, BOULEVARD_R = 24.2, TOWN_R = 46.5;
const FLOOR = GROUND + 0.12;             // the square's paving

// the story's clock. Timing errors are in seconds of ARRIVAL at the microphone.
const PERIOD = 26, BEAT = 1.3, SPEED = 12, PACKETS = 4;
const OFFSETS = [0, 0.5, -0.35, 0.7];
const T_CAL = 6, SLOT = 1.25, T_TRACK = T_CAL + 4 * SLOT, T_DRIFT = 24.5;

// the spectrum row: COLS houses over 0–8 kHz, ROWS floors of level; each device's band
// falls on two of them
const COLS = 28, ROWS = 6, HZ_PER_COL = 8000 / COLS, ROW_SPAN = 2.72, FLOOR_H = 1.55;
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

// a lettered board (unlit, so it stays legible in shade)
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
  const town = new THREE.Group(); town.rotation.y = AZ; g.add(town);
  const fab = new Fabric({
    seed: 404, walls: WALLS, roof: 'gable', roofs: ROOFS, trim: STONE_LO, pavement: COBBLE,
    windowLit: [0xffd9a0, 0xffe8c4, 0xf7c97a], windowOff: 0x4a4038, litP: 0.5,
    floorH: 1.7, bay: 1.6, awnings: [0x1f6f5c, 0xd9634f, 0xe0a23a, 0xf1e8d6],
    people: [0xe76f51, 0x2a9d8f, 0xe9c46a, 0xf1faee, 0xd9634f, 0x5b8fd6, 0xf4a261],
  });

  // ===== THE SQUARE — paving, and rings of equal delay around the microphone ====
  const square = new THREE.Group(); town.add(square); tagPOI(square, 'mic');
  square.add(cyl(SQUARE_R + 1, SQUARE_R + 1, 1.4, STONE_HI, 48, { pos: [0, FLOOR - 0.7, 0], roughness: 0.92 }));
  const inlayMat = new THREE.MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 0.25, roughness: 0.7 });
  for (const r of [5.2, 8.6, 12]) {
    const inlay = new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r + 0.12, 64), inlayMat);
    inlay.rotation.x = -Math.PI / 2; inlay.position.y = FLOOR + 0.02; inlay.receiveShadow = true;
    square.add(inlay);
  }

  // ===== THE MICROPHONE — the one place where everything is measured ============
  const mic = new THREE.Group(); mic.position.y = FLOOR; town.add(mic); tagPOI(mic, 'mic');
  mic.add(cyl(3.6, 4.0, 0.5, STONE, 24, { pos: [0, 0.25, 0], roughness: 0.9 }));
  mic.add(cyl(2.9, 3.2, 0.5, STONE_HI, 24, { pos: [0, 0.75, 0], roughness: 0.9 }));
  mic.add(cyl(2.3, 2.6, 0.7, GREEN, 20, { pos: [0, 1.35, 0], roughness: 0.55, metalness: 0.2 }));
  mic.add(cyl(1.0, 1.5, 0.7, STEEL, 14, { pos: [0, 2.05, 0], roughness: 0.4, metalness: 0.5 }));
  mic.add(cyl(0.34, 0.44, 10.6, STEEL, 10, { pos: [0, 7.5, 0], roughness: 0.4, metalness: 0.5 }));
  const HEAD = 17;                                             // capsule centre, above the paving
  mic.add(cyl(1.3, 1.1, 3.6, GREEN, 14, { pos: [0, 14.2, 0], roughness: 0.45, metalness: 0.3 }));     // body
  const led = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.14, 6, 24), lit(MINT, 1.6));
  led.rotation.x = Math.PI / 2; led.position.y = 16; mic.add(led);
  mic.add(cyl(1.6, 1.6, 2.4, SILVER, 14, { pos: [0, 17.3, 0], roughness: 0.35, metalness: 0.55 }));   // basket
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: SILVER, flatShading: true, roughness: 0.35, metalness: 0.55 }));
  dome.position.y = 18.5; dome.castShadow = true; mic.add(dome);
  for (const y of [16.5, 17.3, 18.1]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.06, 5, 24),
      new THREE.MeshStandardMaterial({ color: GRAPHITE, flatShading: true, roughness: 0.5 }));
    hoop.rotation.x = Math.PI / 2; hoop.position.y = y; mic.add(hoop);
  }
  // shock mount: a ring around the body, held by four elastics
  const mount = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.13, 6, 28),
    new THREE.MeshStandardMaterial({ color: STEEL, flatShading: true, roughness: 0.4, metalness: 0.5 }));
  mount.rotation.x = Math.PI / 2; mount.position.y = 14; mic.add(mount);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const strap = box(1.15, 0.07, 0.07, STONE_HI, { pos: [Math.cos(a) * 1.9, 14, Math.sin(a) * 1.9], cast: false });
    strap.rotation.y = -a; mic.add(strap);
  }
  // the beat landing at the microphone, once everything arrives together
  const syncRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 5, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  syncRing.rotation.x = Math.PI / 2; syncRing.position.y = HEAD; mic.add(syncRing);
  const micHead = new THREE.Vector3(0, FLOOR + HEAD, 0);       // where the waves land (town space)

  // ===== THE FOUR SOUND TOWERS ===================================================
  // a: where it stands around the square (0 = toward the viewer), r: how far from the
  // microphone — different on purpose: each one has to start at a different moment
  // for all of them to land together. The last one is out in the street.
  const SPECS = [
    { a: 1.25, r: 10.6, h: 6.2 },        // by the DJ booth: the host's own speakers
    { a: -1.55, r: 11.2, h: 5.4 },       // a phone and its Bluetooth link — the slow one
    { a: 2.45, r: 11.6, h: 5.0 },        // a phone, screen off, still playing
    { a: -0.52, r: 30.5, h: 7.4 },       // the far one, down the street
  ];
  // one wavefront: a short arc lying flat, bulging toward +X, its crest at the origin
  const WAVE_R = 3.8;
  const waveGeo = new THREE.TorusGeometry(WAVE_R, 0.26, 5, 14, 1.0);
  waveGeo.rotateZ(-0.5); waveGeo.rotateX(Math.PI / 2); waveGeo.translate(-WAVE_R, 0, 0);
  const devices = SPECS.map((sp, i) => {
    const color = BANDS[i], H = sp.h;
    const [x, z] = polar(sp.a, sp.r);
    const stand = new THREE.Group();
    stand.position.set(x, FLOOR, z);
    stand.rotation.y = Math.atan2(-x, -z);                     // local +Z looks at the microphone
    town.add(stand); tagPOI(stand, 'calibration');
    // a scaffold tower: four legs, a deck, two cabinets, banners in its colour
    for (const [dx, dz] of [[-1.25, -0.9], [1.25, -0.9], [-1.25, 0.9], [1.25, 0.9]]) {
      stand.add(box(0.16, H, 0.16, STEEL, { pos: [dx, H / 2, dz], roughness: 0.5, metalness: 0.4 }));
    }
    for (const y of [H * 0.33, H * 0.66]) {
      for (const dz of [-0.9, 0.9]) stand.add(box(2.66, 0.1, 0.1, STEEL, { pos: [0, y, dz], cast: false }));
      for (const dx of [-1.25, 1.25]) stand.add(box(0.1, 0.1, 1.96, STEEL, { pos: [dx, y, 0], cast: false }));
    }
    stand.add(box(3.0, 0.2, 2.3, GRAPHITE, { pos: [0, H, 0], roughness: 0.6 }));
    stand.add(box(2.7, 1.9, 1.9, 0x1d1e21, { pos: [0, H + 1.05, 0], roughness: 0.7 }));
    stand.add(box(2.7, 1.9, 1.9, 0x26272b, { pos: [0, H + 3.0, 0], roughness: 0.7 }));
    const cones = [];
    for (const y of [H + 1.05, H + 3.0]) for (const dx of [-0.62, 0.62]) cones.push(driver(stand, dx, y, 0.98, 0.56));
    for (const dx of [-1.25, 1.25]) {
      stand.add(box(0.5, H * 0.8, 0.06, color, { pos: [dx, H * 0.5, 0.98], emissive: color, emissiveIntensity: 0.8, cast: false }));
    }
    // its place in the spectrum: four cells on the deck's edge, only its own one sounding
    const cells = BANDS.map((c, b) => {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.12),
        b === i ? lit(c, 0.2) : new THREE.MeshStandardMaterial({ color: STONE_LO, flatShading: true, roughness: 0.9 }));
      cell.position.set((b - 1.5) * 0.7, H - 0.2, 1.2); stand.add(cell);
      return cell;
    });
    // the phone that plays through it, on a stand at its foot
    let screen = null;
    if (i === 1 || i === 2) {
      const dark = i === 2;                                    // the Android app: screen OFF, still playing
      stand.add(box(1.5, 1.0, 0.9, WALNUT, { pos: [0, 0.5, 1.7], roughness: 0.8 }));
      stand.add(box(0.7, 1.3, 0.12, INK, { pos: [0, 1.65, 1.7], roughness: 0.35, metalness: 0.3 }));
      screen = box(0.56, 1.1, 0.03, dark ? 0x0c0d0f : 0x1f3a33, {
        pos: [0, 1.66, 1.77], emissive: dark ? 0x0c0d0f : 0x1f3a33, emissiveIntensity: dark ? 0.15 : 0.9, cast: false, receive: false,
      });
      stand.add(screen);
      if (dark) stand.add(box(0.1, 0.1, 0.04, MINT, { pos: [0, 2.2, 1.78], emissive: MINT, emissiveIntensity: 2.2, cast: false, receive: false }));
    }

    // the waves it sends to the microphone: packets of three wavefronts in flight
    stand.updateMatrix();
    const src = new THREE.Vector3(0, H + 2.0, 1.4).applyMatrix4(stand.matrix);
    const dir = new THREE.Vector3().subVectors(micHead, src);
    const dist = dir.length();
    const fan = new THREE.Group(); fan.position.copy(src);
    fan.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
    town.add(fan);
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
    // its bar in the gap gauge on the paving
    const gauge = new THREE.Mesh(unitBox, lit(color, 0.9));
    gauge.rotation.y = Math.atan2(x, z);                       // local +Z points at the tower
    gauge.userData.dir = new THREE.Vector2(x, z).normalize();
    square.add(gauge);

    const top = new THREE.Vector3(0, H + 4.1, 0).applyMatrix4(stand.matrix);
    return { cones, screen, cells, waves, chirp, lamp, gauge, dist, top, x, z, H };
  });
  const coneRest = devices.map((d) => d.cones.map((c) => c.position.z));

  // ===== THE SPECTRUM ROW — narrow houses behind the square, windows for level ==
  // Bodies and roofs come from the town's fabric; the façade toward the square is
  // this city's own: ROWS panes per house, lit from the bottom up to the music's level.
  const row = new THREE.Group(); town.add(row); tagPOI(row, 'spectrum');
  const houses = [];
  const panes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), COLS * ROWS);
  panes.raycast = () => {}; panes.userData.detail = 0.6; row.add(panes);
  const rowPitch = ROW_SPAN * ROW_R / COLS, HOUSE_D = 4.6;
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3(), s = new THREE.Vector3(rowPitch * 0.56, FLOOR_H * 0.56, 1);
    for (let j = 0; j < COLS; j++) {
      const a = Math.PI - ROW_SPAN / 2 + ((j + 0.5) / COLS) * ROW_SPAN;
      const [x, z] = polar(a, ROW_R), rot = a + Math.PI;       // its front looks at the microphone
      const h = 2.5 + (ROWS + (j % 3 === 1 ? 1 : 0)) * FLOOR_H;
      fab.building(x, z, rowPitch - 0.12, HOUSE_D, h, {
        rot, windows: false, ridge: 'z', rise: 1.5 + (j % 2) * 0.5, shop: false,
        color: WALLS[(j * 5 + 2) % WALLS.length], roofColor: ROOFS[(j * 3) % ROOFS.length],
      });
      fab.windowsOn(x, GROUND - 0.3, z, rowPitch - 0.12, HOUSE_D, h, rot, { faces: [2], floorH: FLOOR_H, bay: 1.0 });   // its back, on the boulevard
      q.setFromAxisAngle(up, rot);
      for (let k = 0; k < ROWS; k++) {
        v.set(0, 2.2 + (k + 0.5) * FLOOR_H, HOUSE_D / 2 + 0.05).applyQuaternion(q);
        panes.setMatrixAt(j * ROWS + k, m4.compose(v.set(v.x + x, v.y + GROUND, v.z + z), q, s));
      }
      const door = box(0.62, 1.5, 0.08, GREEN, { cast: false });   // a door on the square
      v.set(0, 0.75, HOUSE_D / 2 + 0.04).applyQuaternion(q);
      door.position.set(x + v.x, GROUND + v.y, z + v.z); door.rotation.y = rot; row.add(door);
      houses.push({ band: colBand(j), rest: 0.34 + 0.6 * Math.exp(-j / 11) });
    }
  }
  const paneOff = new THREE.Color(0x4a4038), paneWarm = new THREE.Color(0xffd9a0), paneWhite = new THREE.Color(0xffffff);
  const bandCols = BANDS.map((c) => new THREE.Color(c));

  // ===== AROUND THE SQUARE — the town hall on one side, big houses on the others ==
  // The TOWN HALL keeps the one clock everybody reads: it is the server.
  const HALL_A = -1.12, hallAt = polar(HALL_A, 21.2);
  const hall = new THREE.Group(); hall.position.set(hallAt[0], GROUND - 0.3, hallAt[1]); hall.rotation.y = HALL_A + Math.PI;
  town.add(hall); tagPOI(hall, 'clock');
  hall.add(box(11, 7.4, 6.4, CREAM, { pos: [0, 3.7, 0], roughness: 0.9 }));
  hall.add(box(11.6, 0.5, 7.0, STONE_LO, { pos: [0, 7.6, 0], roughness: 0.9 }));
  const hallRoof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
    new THREE.MeshStandardMaterial({ color: 0x4f6f66, flatShading: true, roughness: 0.7 }));
  hallRoof.scale.set(11.8, 2.6, 7.2); hallRoof.position.y = 9.15; hallRoof.castShadow = true; hall.add(hallRoof);
  hall.add(box(4.2, 9.2, 0.7, CREAM, { pos: [0, 4.6, 3.3], roughness: 0.9 }));                 // the frontispiece
  const pediment = new THREE.Mesh(new THREE.CylinderGeometry(0, 2.5, 1.7, 3, 1).rotateY(Math.PI / 6),
    new THREE.MeshStandardMaterial({ color: STONE_LO, flatShading: true, roughness: 0.9 }));
  pediment.scale.z = 0.3; pediment.position.set(0, 10.05, 3.3); hall.add(pediment);
  hall.add(box(1.5, 2.6, 0.2, GREEN, { pos: [0, 1.6, 3.7], roughness: 0.6 }));                 // the door
  for (const dx of [-1.6, 1.6]) hall.add(cyl(0.22, 0.26, 5.6, STONE_HI, 8, { pos: [dx, 3.1, 3.85], roughness: 0.9 }));
  hall.add(box(6.4, 0.3, 2.4, STONE, { pos: [0, 0.45, 4.6], roughness: 0.9 }), box(5.4, 0.3, 1.6, STONE_HI, { pos: [0, 0.75, 4.4], roughness: 0.9 }));
  const clock = new THREE.Group(); clock.position.set(0, 7.4, 3.68); hall.add(clock);
  const dial = cyl(1.2, 1.2, 0.1, PAPER, 24, { roughness: 0.6, emissive: PAPER, emissiveIntensity: 0.35 });
  dial.rotation.x = Math.PI / 2; clock.add(dial);
  clock.add(new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 6, 24), new THREE.MeshStandardMaterial({ color: GREEN, flatShading: true, roughness: 0.5 })));
  for (let h = 0; h < 12; h += 3) {
    const a = h * Math.PI / 6;
    const mark = box(0.1, 0.28, 0.04, INK, { pos: [Math.sin(a) * 0.95, Math.cos(a) * 0.95, 0.07], cast: false });
    mark.rotation.z = -a; clock.add(mark);
  }
  const minute = new THREE.Group(); minute.position.z = 0.08; clock.add(minute);
  minute.add(box(0.1, 0.95, 0.04, INK, { pos: [0, 0.42, 0], cast: false }));
  const hour = new THREE.Group(); hour.position.z = 0.1; clock.add(hour);
  hour.add(box(0.14, 0.62, 0.04, INK, { pos: [0, 0.28, 0], cast: false }));
  hall.add(cyl(0.06, 0.06, 3.2, STEEL, 5, { pos: [0, 12.4, 3.3] }));
  const sideClock = clock.clone(); sideClock.position.set(-5.52, 5.6, 0); sideClock.rotation.y = -Math.PI / 2;   // seen from the way in
  hall.add(sideClock);
  const sideHands = [sideClock.children[sideClock.children.length - 2], sideClock.children[sideClock.children.length - 1]];
  const flag = box(1.5, 0.9, 0.05, GREEN, { cast: false }); flag.geometry.translate(0.75, 0, 0);
  flag.position.set(0, 13.5, 3.3); hall.add(flag);
  hall.updateMatrix();
  // its windows, lit and unlit like the rest of the town: two bays each side of the door
  for (const sx of [-3.6, 3.6]) {
    const p = new THREE.Vector3(sx, 0, 0).applyMatrix4(hall.matrix);
    fab.windowsOn(p.x, GROUND - 0.3, p.z, 3.4, 6.48, 7.4, hall.rotation.y, { faces: [0], floorH: 2.3, bay: 1.5, litP: 0.7 });
  }
  fab.slab(hallAt[0], hallAt[1], 13.5, 9, null, hall.rotation.y);
  // the big houses that close the square on its other sides
  for (const [a, h] of [[0.78, 8.6], [1.5, 9.8], [-0.42, 5.6], [-1.82, 9.2]]) {
    const [x, z] = polar(a, 21.4), wide = Math.abs(a) > 1 ? 8.8 : 7.6;
    fab.slab(x, z, wide + 1.4, 7.6, null, a + Math.PI);
    fab.building(x, z, wide, 6, h, { rot: a + Math.PI });
  }

  // spokes from the hall's clock to every tower, a tick travelling out and back
  const hub = new THREE.Vector3(0, 13.9, 3.3).applyMatrix4(hall.matrix);
  const spokePts = [];
  for (const d of devices) spokePts.push(hub.x, hub.y, hub.z, d.top.x, d.top.y, d.top.z);
  const spokeGeo = new THREE.BufferGeometry();
  spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(spokePts, 3));
  town.add(new THREE.LineSegments(spokeGeo, new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.45, depthWrite: false })));
  const ticks = devices.map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: MINT }));
    town.add(m);
    return m;
  });

  // ===== THE DJ BOOTH — what plays here comes out everywhere ====================
  const BOOTH_A = 0.72, boothAt = polar(BOOTH_A, 12.2);
  const booth = new THREE.Group(); booth.position.set(boothAt[0], FLOOR, boothAt[1]); booth.rotation.y = BOOTH_A + Math.PI;
  town.add(booth); tagPOI(booth, 'live');
  booth.add(box(4.4, 1.2, 1.8, WALNUT, { pos: [0, 0.6, 0], roughness: 0.75 }));
  booth.add(box(4.6, 0.14, 2.0, GRAPHITE, { pos: [0, 1.27, 0], roughness: 0.5, metalness: 0.3 }));
  const platter = new THREE.Group(); platter.position.set(-1.1, 1.36, 0); booth.add(platter);
  platter.add(cyl(0.85, 0.85, 0.1, INK, 20, { pos: [0, 0.05, 0], roughness: 0.3 }));
  platter.add(cyl(0.3, 0.3, 0.12, GREEN, 12, { pos: [0, 0.07, 0], emissive: GREEN, emissiveIntensity: 0.4 }));
  platter.add(box(0.3, 0.05, 0.1, PAPER, { pos: [0.5, 0.12, 0], cast: false }));              // so the spin shows
  booth.add(box(1.4, 0.1, 1.0, GRAPHITE, { pos: [1.1, 1.39, 0.1], roughness: 0.5, metalness: 0.3 }));   // the laptop
  const lid = new THREE.Group(); lid.position.set(1.1, 1.42, -0.4); lid.rotation.x = -0.25; booth.add(lid);
  lid.add(box(1.4, 0.95, 0.07, GRAPHITE, { pos: [0, 0.47, 0], roughness: 0.5, metalness: 0.3 }));
  const laptop = box(1.24, 0.8, 0.03, PAPER, { pos: [0, 0.48, 0.05], emissive: PAPER, emissiveIntensity: 0.7, cast: false, receive: false });
  lid.add(laptop);
  for (const [dx, dz] of [[-2.4, -1.2], [2.4, -1.2], [-2.4, 1.2], [2.4, 1.2]]) booth.add(cyl(0.07, 0.07, 3.6, STEEL, 5, { pos: [dx, 1.8, dz] }));
  for (let k = 0; k < 6; k++) {                                // a striped canopy
    booth.add(box(0.84, 0.12, 2.9, k % 2 ? CREAM : GREEN, { pos: [-2.1 + k * 0.84, 3.62, 0], roughness: 0.9 }));
  }
  // its cable up to the host's tower: ten lanterns in flight = one second of delay
  booth.updateMatrix();
  const railA = new THREE.Vector3(0, 3.9, 0).applyMatrix4(booth.matrix), railB = devices[0].top.clone();
  town.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([railA, railB]),
    new THREE.LineBasicMaterial({ color: GRAPHITE, transparent: true, opacity: 0.7 })));
  const SLICES = 10;
  const slices = [];
  for (let s = 0; s < SLICES; s++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.5),
      new THREE.MeshStandardMaterial({ color: MINT, emissive: MINT, emissiveIntensity: 1.1, flatShading: true, transparent: true, opacity: 0.9 }));
    m.castShadow = false; town.add(m); slices.push(m);
  }

  // ===== THE WAY IN — a room is an address: /r/CODE, joined by a link ===========
  const avenue = new THREE.Group(); town.add(avenue);
  fab.slab(0, 27.5, 5.4, 27, STONE_HI);
  for (const dx of [-2.85, 2.85]) fab.prop(dx, GROUND + 0.14, 27.5, 0.3, 0.06, 27, GREEN);
  const GATE_Z = 39.5;
  for (const dx of [-4.4, 4.4]) {
    avenue.add(box(1.5, 9.4, 1.5, STONE, { pos: [dx, 4.2, GATE_Z], roughness: 0.9 }));
    avenue.add(box(1.9, 0.5, 1.9, STONE_HI, { pos: [dx, 9.15, GATE_Z], roughness: 0.85 }));
    avenue.add(box(0.5, 0.5, 0.5, MINT, { pos: [dx, 9.7, GATE_Z], emissive: MINT, emissiveIntensity: 1.5, cast: false }));
  }
  avenue.add(box(10.6, 0.6, 1.1, STONE_LO, { pos: [0, 8.6, GATE_Z], roughness: 0.9 }));
  avenue.add(box(7.3, 2.05, 0.2, GREEN, { pos: [0, 7.2, GATE_Z + 0.45], roughness: 0.6 }));
  const sign = signBoard('/r/SALON', 7.0, 1.75); sign.position.set(0, 7.2, GATE_Z + 0.62); avenue.add(sign);
  // the way out is the way in: the gate's own doorway
  const portal = makeWallPortal('#5fc2a8', 5.2, 4.4);
  portal.group.position.set(0, GROUND + 0.14, GATE_Z + 0.15);
  avenue.add(portal.group);

  // ===== THE TOWN — streets of houses all around, a boulevard, the evening out ===
  fab.ring(BOULEVARD_R, 3.2, 0x55524c);
  fab.traffic({ ring: BOULEVARD_R }, { n: 7, speed: 4.2 });
  for (let k = 0; k < 14; k++) {
    const a = (k + 0.5) / 14 * Math.PI * 2;
    if (Math.min(a, Math.PI * 2 - a) > 0.25) fab.lamp(...polar(a, BOULEVARD_R + 2.2));
  }
  const farAt = polar(SPECS[3].a, SPECS[3].r);
  district(fab, {
    R: TOWN_R, angle: 0.14, block: 8.3, street: 2.5,
    keep: (x, z, r) => r > BOULEVARD_R + 5 && !(z > 4 && Math.abs(x) < 6.2)          // not on the way in
      && Math.hypot(x - farAt[0], z - farAt[1]) > 7.5 && !(z > 33 && Math.abs(x) < 11),
    // the skyline rises behind the square and stays low in front, where the view comes from
    height: (x, z) => (z < -6 ? 9.5 : z < 12 ? 7.2 : 4.6),
  });
  // market stalls and trees along the way in
  const AWNINGS = [0xd9634f, 0xe0a23a, 0x5b8fd6, 0xf1e8d6];
  for (let k = 0; k < 5; k++) for (const side of [-1, 1]) {
    const z = 17.5 + k * 4.2;
    if (k % 2 === (side > 0 ? 0 : 1)) {
      fab.prop(side * 5.2, GROUND, z, 1.8, 0.9, 1.3, WALNUT);
      fab.prop(side * 5.2, GROUND + 2.0, z, 2.3, 0.12, 1.8, AWNINGS[(k + (side > 0 ? 1 : 0)) % 4]);
      for (const c of [-1, 1]) fab.prop(side * 5.2 + c * 1.0, GROUND, z + 0.8, 0.08, 2.0, 0.08, 0x3a3d42);
    } else fab.tree(side * 5.4, z, 1.25);
  }
  for (const a of [0.45, -0.95, 2.05, -2.2, 3.05]) fab.tree(...polar(a, SQUARE_R - 0.4), 1.2);

  // the dancers on the square; each one hears — and follows — the nearest tower
  const dancers = fab.crowd(64, (i, rand) => {
    for (;;) {
      const [x, z] = polar(rand() * Math.PI * 2, 5.4 + Math.sqrt(rand()) * 7.2);
      if (devices.every((d) => Math.hypot(x - d.x, z - d.z) > 2.6) && Math.hypot(x - boothAt[0], z - boothAt[1]) > 3.4) return [x, z];
    }
  }, { roam: 0.45 });
  for (const p of dancers) {
    let best = 0;
    devices.forEach((d, i) => { if (Math.hypot(p.x - d.x, p.z - d.z) < Math.hypot(p.x - devices[best].x, p.z - devices[best].z)) best = i; });
    p.hears = best; p.spring = 0.5 + ((p.p1 * 7) % 1) * 0.5;
  }
  fab.walkers({ ring: BOULEVARD_R - 2.5 }, { n: 12, spread: 0.6 });
  fab.walkers({ pts: [[0, 15], [0, 37]] }, { n: 9, spread: 3.4 });
  fab.crowd(10, (i, rand) => [(rand() < 0.5 ? -1 : 1) * (3.5 + rand() * 0.6), 17 + rand() * 18], { roam: 0.5 });

  const fabric = fab.build();
  town.add(fabric.group);

  // garlands from the microphone's head out to the roofs around the square
  {
    const pts = [], start = new THREE.Vector3(0, FLOOR + 19.6, 0);
    for (let k = 0; k < 10; k++) {
      const [x, z] = polar((k / 10) * Math.PI * 2 + 0.31, 17.2), end = new THREE.Vector3(x, GROUND + 9.2, z);
      for (let s = 1; s <= 9; s++) {
        const p = start.clone().lerp(end, s / 10); p.y -= Math.sin(s / 10 * Math.PI) * 2.6;      // the sag
        pts.push(p);
      }
    }
    const garlands = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), pts.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    pts.forEach((p, i) => { garlands.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)); garlands.setColorAt(i, col.set(i % 3 ? 0xffe2a8 : BANDS[i % 4])); });
    garlands.raycast = () => {}; garlands.userData.detail = 0.3; town.add(garlands);
  }

  // ===== POI beacons ============================================================
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); town.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
  };
  addBeacon('mic', '#5fc2a8', 0, FLOOR + 23.4, 0);
  addBeacon('calibration', '#e0a23a', devices[1].x, FLOOR + devices[1].H + 7.2, devices[1].z);   // over the Bluetooth tower
  { const [x, z] = polar(Math.PI, ROW_R); addBeacon('spectrum', '#5b8fd6', x, GROUND + 18.5, z); }
  addBeacon('clock', '#5fc2a8', hub.x, hub.y + 2.6, hub.z);
  addBeacon('live', '#5fc2a8', boothAt[0], FLOOR + 6.4, boothAt[1]);

  const label = makeLabel('Hubs', 'Synchronized Audio', '#1f6f5c');
  label.sprite.position.set(0, 33, 0); town.add(label.sprite);

  tagPickable(g, 'hubs');

  // timing error of device i at story time tau (seconds of arrival at the microphone)
  const errorAt = (i, tau) => {
    if (tau < T_CAL) return OFFSETS[i];
    if (tau < T_TRACK) return OFFSETS[i] * (1 - smoothstep(T_CAL + i * SLOT + 0.3, T_CAL + (i + 1) * SLOT - 0.1, tau));
    if (tau < T_DRIFT) return 0.03 * Math.sin(tau * 1.3 + i * 2.1) * Math.exp(-(tau - T_TRACK) * 0.5);
    return OFFSETS[i] * smoothstep(T_DRIFT, PERIOD, tau);
  };
  const phases = [0, 0, 0, 0];
  const paneCol = new THREE.Color();

  return {
    group: g, label,
    frame: { target: [2, 6, 6], azimuth: AZ, polar: 54, radius: 106 },
    pois: pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState })),
    update(t, dt) {
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
        // phase since this tower's last arrival at the microphone: 0 = it lands now
        const ph = (((t - e) / BEAT) % 1 + 1) % 1;
        const since = ph * BEAT;
        phases[i] = ph;

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
        if (i === 1) d.screen.material.emissiveIntensity = 0.9 + (cal ? 0.9 : 0);

        // its lamp fires when it lands; its bar in the gauge is how far off it is
        d.lamp.material.emissiveIntensity = 0.35 + 3.2 * Math.exp(-since * 6);
        const len = 0.5 + Math.abs(e) * 6.4;
        const gd = d.gauge.userData.dir;
        d.gauge.scale.set(0.6, 0.2, len);
        d.gauge.position.set(gd.x * (4.4 + len / 2), FLOOR, gd.y * (4.4 + len / 2));
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

      // the dancers jump when the tower they stand by lands its beat: scattered while
      // the town is out of step, all together once it is calibrated
      for (const p of dancers) {
        const f = phases[p.hears] * BEAT / 0.42;
        p.hop = f < 1 ? Math.sin(f * Math.PI) * 0.75 * p.spring : 0;
      }

      // the row of houses: the music's spectrum in lit windows; the sweep runs along it
      // during calibration, and once tracking is on each tower's band takes its colour
      const beatKick = Math.exp(-beatPh * BEAT * 4);
      const sweepCol = calIdx >= 0 && calF < 0.55 ? (1000 + (calF / 0.55) * 5000) / HZ_PER_COL : -9;
      houses.forEach((hse, j) => {
        const wob = 0.5 + 0.5 * Math.sin(t * (1.9 + (j % 7) * 0.33) + j * 1.7);
        const level = Math.min(1, hse.rest * (0.5 + 0.7 * wob) + (j < 6 ? beatKick * 0.3 : 0));
        const litRows = Math.round(level * ROWS), swept = Math.abs(j - sweepCol) < 1.2;
        for (let k = 0; k < ROWS; k++) {
          if (swept) paneCol.copy(paneWhite);
          else if (k >= litRows) paneCol.copy(paneOff);
          else if (hse.band >= 0) paneCol.copy(paneWarm).lerp(bandCols[hse.band], trackGlow);
          else paneCol.copy(paneWarm);
          panes.setColorAt(j * ROWS + k, paneCol);
        }
      });
      panes.instanceColor.needsUpdate = true;

      // the hall's clock, and a tick out to each tower and back
      minute.rotation.z = sideHands[0].rotation.z = -t * 0.5; hour.rotation.z = sideHands[1].rotation.z = -t * 0.5 / 12;
      flag.rotation.y = Math.sin(t * 1.7) * 0.35;
      ticks.forEach((m, i) => {
        const f = ((t * 0.5 + i * 0.25) % 1);
        m.position.lerpVectors(hub, devices[i].top, f < 0.5 ? f * 2 : 2 - f * 2);
      });

      // the booth: the record turns; ten lanterns ride the cable, one second from
      // capture to playback
      platter.rotation.y = -t * 2.1;
      laptop.material.emissiveIntensity = 0.6 + beatKick * 0.5;
      for (let s = 0; s < SLICES; s++) {
        const f = ((t * 0.1 + s / SLICES) % 1);
        slices[s].position.lerpVectors(railA, railB, f);
        slices[s].material.opacity = 0.9 * smoothstep(0, 0.06, f) * (1 - smoothstep(0.94, 1, f));
      }

      fabric.update(t, dt);
    },
  };
}
