// croquis.js — the CROQUIS world: an ENDLESS hand-drawn sky you FLY THROUGH.
// Its own generator (not the island recoloured): you glide forever, as a weightless
// paper glider, through a graphite sketchbook page — warm drawing-paper sky, pencil-
// hatched cumulus you thread and sink INTO, and wooden airships drifting across the
// gaps. "un monde en 3D fait de nuages, vaisseaux volants, dans lequel on vole. C'est
// un dessin infini."
//
// The hand-drawn look comes from GEOMETRY + baked canvas textures, NOT a screen pass:
//   - a volumetric cloud field (one InstancedMesh of displaced blobs) gives real
//     parallax & self-occlusion so you truly fly THROUGH clouds;
//   - hero cloud-towers and airships wear an INVERTED-HULL graphite contour (an opaque
//     BackSide shell) — a bold pencil silhouette that holds from every angle, even
//     from inside, with no post-processing;
//   - pooled pencil-linework sprites ink themselves in as they approach (finish-by-
//     distance), so recycling reads as "the drawing drawing itself ahead of you";
//   - ~60% of the frame is left as bare warm paper (the anti-slop discipline).
// Everything is pooled & recycled around the moving camera → an infinite flight.
import * as THREE from 'three';
import { mulberry32, clamp, smoothstep } from './gen/noise.js';

// ---- palette (from the design spec) ----
const SKY = ['#e7eef1', '#eef0ea', '#f4ecdc'];   // cool paper zenith → warm horizon
const FOG = '#eef0e8';
const GRAPHITE = 0x4a443b;                         // primary contour
const HATCH = '#6b6357';                           // secondary / hatch
const FARLINE = '#9a9184';                         // lightest / far
const BLUE = '#b8c6d6';                            // non-photo-blue under-drawing
const PAPERWHITE = 0xf7f5ee;                        // cloud fill / wash
const PASTELS = ['#c7d8e2', '#f2ddc9', '#ecd4d4', '#d3e0d0', '#ddd6e6'];
const WOOD1 = 0xcdae82, WOOD2 = 0xb8966a, CANVAS = 0xece4d2, ROPE = 0x5b5348;

// ---- flight / field tuning ----
const SPEED = 30;              // forward cruise (u/s) — a gentle soaring glide
const SPAWN = 850;             // spawn distance ahead (past fogFar → fades in)
const BEHIND = 150;            // recycle once this far behind the camera
const CORRIDOR_Y = [-260, 320];

// =====================================================================
// main
// =====================================================================
export function buildCroquis(stage, container, seed) {
  const rng = mulberry32((seed ^ 0xc0ffee) >>> 0);
  const group = new THREE.Group();
  group.name = 'croquis';

  // ---- warm the paper ambiance for flight (mutate the live stage, never rebuild) ----
  stage.scene.background = bakeSky();
  if (stage.scene.fog) { stage.scene.fog.color.set(FOG); stage.scene.fog.near = 120; stage.scene.fog.far = 900; }
  if (stage.sun) stage.sun.castShadow = false;
  stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  // ---- shared assets ----
  const cloudTex = [];
  for (let i = 0; i < 8; i++) cloudTex.push(bakeCloudTex(mulberry32((seed ^ (0x1111 * (i + 1))) >>> 0), i % 3 === 0));
  const sailTex = bakeSailTex(mulberry32((seed ^ 0x5a11) >>> 0));

  // ================= cloud VOLUME field (one instanced draw) =================
  const blob = blobGeo((seed ^ 0xb10b) >>> 0);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xfbf9f3, flatShading: true, fog: true });
  const CAP = 384;
  const field = new THREE.InstancedMesh(blob, cloudMat, CAP);
  field.frustumCulled = false;
  group.add(field);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  const _sc = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _col = new THREE.Color();

  const clusters = [];
  let iCount = 0;
  const NCLUSTERS = 42;
  for (let c = 0; c < NCLUSTERS && iCount < CAP; c++) {
    const n = 4 + ((rng() * 5) | 0);
    const insts = [];
    for (let k = 0; k < n && iCount < CAP; k++) {
      const s = 9 + rng() * 20;
      insts.push({
        i: iCount++,
        off: new THREE.Vector3((rng() * 2 - 1) * 26, (rng() * 2 - 1) * 12, (rng() * 2 - 1) * 26),
        s, ry: rng() * Math.PI * 2,
      });
    }
    // pastel kept PALE (lerped well toward white) so clouds read as tinted paper, not
    // saturated rock — but present enough for "beaucoup de couleur mais pâle".
    const pastel = rng() < 0.42
      ? new THREE.Color(PASTELS[(rng() * PASTELS.length) | 0]).lerp(new THREE.Color(0xffffff), 0.6)
      : null;
    // one linework sprite riding a near lobe (the pencil contour on the soft body)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex[(rng() * cloudTex.length) | 0], transparent: true, depthWrite: false,
      opacity: 0.7, fog: true, color: 0xffffff, rotation: (rng() - 0.5) * 0.3,
    }));
    const spScale = 90 + rng() * 120;
    sp.scale.set(spScale * (rng() < 0.5 ? 1 : -1), spScale * 0.66, 1);   // mirror some
    group.add(sp);
    clusters.push({
      base: new THREE.Vector3(), insts, pastel, sprite: sp,
      spOff: new THREE.Vector3((rng() * 2 - 1) * 10, -4 + rng() * 7, (rng() * 2 - 1) * 10),
      radius: 34, outlineOnly: rng() < 0.28,
    });
  }
  field.count = iCount;

  const rebuildCluster = (cl) => {
    let maxr = 0;
    for (const it of cl.insts) {
      _v.copy(cl.base).add(it.off);
      _q.setFromAxisAngle(_up, it.ry);
      _sc.set(it.s, it.s * 0.62, it.s);
      _m.compose(_v, _q, _sc);
      field.setMatrixAt(it.i, _m);
      _col.set(cl.pastel ? cl.pastel : 0xffffff);
      field.setColorAt(it.i, _col);
      maxr = Math.max(maxr, it.off.length() + it.s);
    }
    cl.radius = maxr;
    cl.sprite.position.copy(cl.base).add(cl.spOff);
  };

  // ================= hero cloud-towers (with graphite contour shells) =================
  const towers = [];
  const NTOWERS = 7;
  for (let t = 0; t < NTOWERS; t++) {
    const g = new THREE.Group();
    const tseed = (seed ^ (0x7000 * (t + 1))) >>> 0;
    const trng = mulberry32(tseed);
    const stacks = 3 + ((trng() * 2) | 0);
    let y = 0;
    for (let s = 0; s < stacks; s++) {
      const r = 46 - s * 8 + trng() * 6;
      const geo = coreGeo(tseed + s * 17, r);
      const fill = new THREE.Mesh(geo, cloudMat);
      fill.position.y = y;
      g.add(fill);
      const shell = invertedHull(geo, 2.6, tseed + s * 31, GRAPHITE);
      shell.position.y = y;
      g.add(shell);
      y += r * 1.15;
    }
    // a linework sprite crowning it
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex[(trng() * cloudTex.length) | 0], transparent: true, depthWrite: false, opacity: 0.8, fog: true }));
    const ss = 150 + trng() * 90; sp.scale.set(ss * (trng() < 0.5 ? 1 : -1), ss * 0.66, 1);
    sp.position.y = y * 0.5; g.add(sp);
    group.add(g);
    towers.push({ group: g, base: new THREE.Vector3(), sprite: sp, radius: 90 });
  }

  // ================= airships =================
  const ships = [];
  const NSHIPS = 11;
  for (let i = 0; i < NSHIPS; i++) {
    const sseed = (seed ^ (0x9a10 * (i + 3))) >>> 0;
    const srng = mulberry32(sseed);
    const kind = i % 3;
    const g = kind === 0 ? makeDirigible(srng) : kind === 1 ? makeSkyBoat(srng, sailTex) : makeSkiff(srng);
    group.add(g.group);
    ships.push({
      group: g.group, base: new THREE.Vector3(), prop: g.prop || null,
      drift: new THREE.Vector3((srng() * 2 - 1) * 10, (srng() * 2 - 1) * 3, (srng() * 2 - 1) * 10),
      bob: srng() * Math.PI * 2, spin: (srng() - 0.5) * 0.1, heading: srng() * Math.PI * 2,
    });
  }
  // one rare B-612 asteroid among them (the tender landmark)
  const b612 = makeAsteroid(mulberry32((seed ^ 0xb612) >>> 0));
  group.add(b612.group);
  ships.push({ group: b612.group, base: new THREE.Vector3(), prop: null,
    drift: new THREE.Vector3(2, 0, 2), bob: 1.3, spin: 0.05, heading: 0, rare: true });

  // themed MONTGOLFIÈRES — one per project, drifting by from time to time. Each
  // balloon wears its project's identity in pale pastel: the toast balloon (warm red
  // band, a toast slab swinging under the basket), the splash droplet (cyan, teardrop
  // envelope), the inventor's patchwork (warm amber, a wooden gear hanging).
  const BALLOON_THEMES = ['toast', 'splash', 'apairo'];
  const balloons = [];                 // exposed for click-picking (project cards)
  BALLOON_THEMES.forEach((theme, i) => {
    const brng = mulberry32((seed ^ (0xba1100 * (i + 1))) >>> 0);
    // each project rolls its CRAFT TYPE (montgolfière or dirigible) and a THEME
    // VARIANT from the software's own skins — a different sky on every load.
    const b = makeCraft(brng, theme);
    b.group.userData.balloonTheme = theme;
    group.add(b.group);
    balloons.push({ group: b.group, theme });
    // NB: drift.y must stay tiny — an earlier +2..4 u/s climb sent every balloon out
    // of the corridor within seconds, so they were effectively never seen.
    ships.push({ group: b.group, base: new THREE.Vector3(), prop: null, anim: b.anim || null,
      drift: new THREE.Vector3((brng() * 2 - 1) * 6, (brng() - 0.5) * 0.8, (brng() * 2 - 1) * 6),
      bob: brng() * Math.PI * 2, spin: (brng() - 0.5) * 0.06, heading: brng() * Math.PI * 2,
      balloon: true });   // slightly high band, but near the flight corridor
  });

  // ================= construction horizon guide (non-photo-blue) =================
  const horizon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: bakeHorizonTex(), transparent: true, depthWrite: false, opacity: 0.34, fog: false }));
  horizon.scale.set(4200, 60, 1);
  group.add(horizon);

  // ================= fly-into-cloud paper veil =================
  const veil = new THREE.Sprite(new THREE.SpriteMaterial({
    color: PAPERWHITE, transparent: true, depthWrite: false, depthTest: false, opacity: 0, fog: false }));
  veil.scale.set(10, 7, 1); veil.renderOrder = 30;
  group.add(veil);
  let veilOp = 0;

  // ================= flight rig =================
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const camera = new THREE.PerspectiveCamera(64, container.clientWidth / container.clientHeight, 0.5, 1600);
  const pos = new THREE.Vector3(0, 20, 0);
  const forward = new THREE.Vector3(0, 0, -1);
  let yaw = 0, pitch = -0.02, yawRate = 0, roll = 0;
  let px = 0, py = 0;                         // pointer offset from centre, [-1,1]
  const onMove = (e) => {
    const r = container.getBoundingClientRect();
    px = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    py = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
  };
  const onLeave = () => { px = 0; py = 0; };
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerleave', onLeave);

  // ---- throttle ----
  // Keys are TOGGLES, not holds: most laptop touchpads are disabled by the OS while
  // a key is held ("disable while typing"), so hold-a-key would freeze the steering.
  //   ↑ / Z / W  — toggle boost (press again to cruise; also resumes from a stop)
  //   ↓ / S / Space — toggle a full stop (hang among the clouds)
  // Holding the POINTER (mouse button / finger) still boosts while held — same
  // device as the steering, so nothing conflicts.
  let boostHold = false, boostLatch = false, stopped = false;
  let speedF = 1;                                     // smoothed speed factor
  const onDown = () => { boostHold = true; stopped = false; };
  const onUp = () => { boostHold = false; };
  const isBoostKey = (k) => k === 'ArrowUp' || k === 'z' || k === 'Z' || k === 'w' || k === 'W';
  const isStopKey = (k) => k === 'ArrowDown' || k === 's' || k === 'S' || k === ' ';
  const onKeyDown = (e) => {
    if (e.repeat) return;
    if (isBoostKey(e.key)) {
      if (stopped) stopped = false;          // first press resumes, second boosts
      else boostLatch = !boostLatch;
      e.preventDefault();
    } else if (isStopKey(e.key)) {
      stopped = !stopped; boostLatch = false;
      e.preventDefault();
    }
  };
  container.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKeyDown);

  const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _u = new THREE.Vector3();
  const _d = new THREE.Vector3(), _flat = new THREE.Vector3();
  const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const worldUp = new THREE.Vector3(0, 1, 0);

  // ---- lateral scatter for (re)spawns, excluding a tube on the flight axis ----
  const scatter = (target, base, distMin, distSpan, sideX, sideY) => {
    const dist = distMin + rng() * distSpan;
    const sgn = rng() < 0.5 ? -1 : 1;
    const rx = sgn * (150 + rng() * sideX);
    const ry_ = sideY[0] + rng() * (sideY[1] - sideY[0]);
    target.copy(base).addScaledVector(_fwd, dist)
      .addScaledVector(_right, rx).addScaledVector(_u, ry_);
  };

  // ---- initial layout: fill the view ahead (near AND far) ----
  const seedField = () => {
    for (const cl of clusters) { scatter(cl.base, pos, 60, 820, 380, CORRIDOR_Y); rebuildCluster(cl); }
    for (const tw of towers) { scatter(tw.base, pos, 120, 780, 460, [-120, 60]); tw.group.position.copy(tw.base); }
    for (const sh of ships) {
      scatter(sh.base, pos, 200, 700, sh.balloon ? 150 : 420,
        sh.balloon ? [-20, 150] : [-200, 240]);
      sh.group.position.copy(sh.base);
    }
    field.instanceMatrix.needsUpdate = true;
    if (field.instanceColor) field.instanceColor.needsUpdate = true;
  };
  // temp basis for the initial seed (camera looks -Z)
  _fwd.set(0, 0, -1); _right.set(1, 0, 0); _u.set(0, 1, 0);
  seedField();

  const dist2 = SPAWN * 1.55, dist2sq = dist2 * dist2;   // recycle envelope (> any spawn radius)

  return {
    group, camera, isCroquis: true, balloons,
    update(t, dt) {
      // ---------- origin rebase FIRST (infinite-flight precision): shift the whole
      // pool + pos before the camera/ships are placed from them this frame, so camera
      // and world stay in one frame of reference (no one-frame cloudscape flash).
      if (pos.lengthSq() > 6000 * 6000) {
        const shift = pos.clone();          // NOT a shared temp — rebuildCluster uses _v
        pos.sub(shift);
        for (const cl of clusters) { cl.base.sub(shift); rebuildCluster(cl); }
        for (const tw of towers) { tw.base.sub(shift); tw.group.position.copy(tw.base); }
        for (const sh of ships) { sh.base.sub(shift); }
        field.instanceMatrix.needsUpdate = true;
      }

      // ---------- flight ----------
      const k = 1 - Math.pow(0.0001, dt);                 // critically-damped, floaty
      const targetYawRate = reduceMotion ? 0 : -px * 0.5;
      yawRate += (targetYawRate - yawRate) * k;
      yaw += yawRate * dt;
      const targetPitch = reduceMotion ? -0.02 : clamp(-py * 0.5, -0.52, 0.52);
      pitch += (targetPitch - pitch) * k;
      const targetRoll = reduceMotion ? 0 : clamp(-yawRate * 0.7, -0.32, 0.32);
      roll += (targetRoll - roll) * k;
      _euler.set(pitch, yaw, roll); camera.quaternion.setFromEuler(_euler);

      _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      forward.copy(_fwd);
      // throttle: stop wins; easing makes it feel like leaning forward / flaring to
      // a halt rather than flipping a speed switch
      const speedTarget = stopped ? 0 : (boostHold || boostLatch) ? 2.6 : 1;
      speedF += (speedTarget - speedF) * Math.min(1, dt * 2.2);
      pos.addScaledVector(_fwd, (reduceMotion ? SPEED * 0.5 : SPEED) * speedF * dt);
      const bob = reduceMotion ? 0 : Math.sin(t * 1.9) * 0.6;
      camera.position.copy(pos); camera.position.y += bob;

      _right.crossVectors(_fwd, worldUp).normalize();
      _u.crossVectors(_right, _fwd).normalize();
      const camPos = camera.position;

      // ---------- recycle + ink-in: cloud clusters ----------
      let dirty = false, inCloud = false;
      for (const cl of clusters) {
        _d.subVectors(cl.base, camPos);
        let along = _d.dot(_fwd);
        if (along < -BEHIND || _d.lengthSq() > dist2sq) {
          scatter(cl.base, camPos, SPAWN - 40, 120, 360, CORRIDOR_Y);
          rebuildCluster(cl); dirty = true; along = SPAWN;   // fresh spawn = far = faint
        }
        const finish = smoothstep(820, 240, along);
        cl.sprite.material.opacity = (cl.outlineOnly ? 0.0 : 0.10) + finish * (cl.outlineOnly ? 0.55 : 0.78);
        if (_d.lengthSq() < cl.radius * cl.radius) inCloud = true;
      }
      if (dirty) field.instanceMatrix.needsUpdate = true;   // colours never change on recycle

      // ---------- recycle: hero towers ----------
      for (const tw of towers) {
        _d.subVectors(tw.base, camPos);
        let along = _d.dot(_fwd);
        if (along < -BEHIND * 1.4 || _d.lengthSq() > dist2sq) {
          scatter(tw.base, camPos, SPAWN - 20, 140, 460, [-120, 60]);
          tw.group.position.copy(tw.base); along = SPAWN;
        }
        tw.sprite.material.opacity = 0.25 + smoothstep(900, 300, along) * 0.6;
        if (_d.lengthSq() < tw.radius * tw.radius) inCloud = true;
      }

      // ---------- recycle + drift: airships ----------
      for (const sh of ships) {
        sh.base.addScaledVector(sh.drift, dt);
        _d.subVectors(sh.base, camPos);
        const along = _d.dot(_fwd);
        if (along < -BEHIND * 1.6 || _d.lengthSq() > dist2sq) {
          // balloons respawn close to the flight corridor so you actually MEET them;
          // other ships (and the B-612) keep their wide, rarer bands.
          scatter(sh.base, camPos, SPAWN - 30, 130, sh.balloon ? 150 : 420,
            sh.rare ? [-40, 120] : sh.balloon ? [-20, 150] : [-220, 260]);
        }
        sh.group.position.copy(sh.base);
        sh.group.position.y += Math.sin(t * 0.6 + sh.bob) * 3;
        sh.group.rotation.y = sh.heading + t * sh.spin;
        if (sh.prop) sh.prop.rotation.z += dt * 4;
        if (sh.anim) sh.anim(t);            // themed touches (flame, drips, gear)
      }

      // ---------- horizon guide + veil ----------
      _flat.copy(_fwd); _flat.y = 0; _flat.normalize();
      horizon.position.copy(camPos).addScaledVector(_flat, 700); horizon.position.y = camPos.y - bob;
      veilOp += ((inCloud ? 0.62 : 0) - veilOp) * Math.min(1, dt * 3);
      veil.material.opacity = veilOp;
      veil.position.copy(camPos).addScaledVector(_fwd, 3.2);
    },
    resize() {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
    },
    dispose() {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      container.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}

// =====================================================================
// geometry helpers
// =====================================================================

// a shared displaced cloud blob (unit radius, puffy lobes, flattened base)
function blobGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2);         // detail 2 → puffier clouds
  const rng = mulberry32(seed);
  const bumps = [];
  for (let i = 0; i < 5; i++) {
    bumps.push({ v: new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize(), s: 0.32 + rng() * 0.5, f: 1.4 + rng() * 1.6 });
  }
  displace(g, bumps);
  return g;
}
// a tower core displaced blob baked at final world radius
function coreGeo(seed, radius) {
  const g = new THREE.IcosahedronGeometry(radius, 2);
  const rng = mulberry32(seed);
  const bumps = [];
  for (let i = 0; i < 6; i++) {
    bumps.push({ v: new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize(), s: (0.28 + rng() * 0.42) * radius, f: 1.6 + rng() * 1.8 });
  }
  displaceWorld(g, bumps);
  return g;
}
function displace(g, bumps) {
  const p = g.attributes.position, v = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); dir.copy(v).normalize();
    let r = 1;
    for (const b of bumps) r += b.s * Math.pow(Math.max(0, dir.dot(b.v)), b.f);
    v.copy(dir).multiplyScalar(r); if (v.y < 0) v.y *= 0.5;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
}
function displaceWorld(g, bumps) {
  const p = g.attributes.position, v = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const len = v.length(); dir.copy(v).normalize();
    let r = len;
    for (const b of bumps) r += b.s * Math.pow(Math.max(0, dir.dot(b.v)), b.f);
    v.copy(dir).multiplyScalar(r); if (v.y < 0) v.y *= 0.62;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
}

// INVERTED-HULL contour: clone the geo, push each vertex out along its normal (with a
// hand-shaky jitter), render as an opaque BackSide silhouette → a bold pencil outline.
function invertedHull(geo, push, seed, colorHex) {
  const g = geo.clone();
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  const rng = mulberry32(seed), v = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); nv.fromBufferAttribute(n, i);
    v.addScaledVector(nv, push * (0.7 + rng() * 0.6));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex, side: THREE.BackSide, fog: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  return new THREE.Mesh(g, mat);
}

// =====================================================================
// airships (fill Lambert + inverted-hull contour + line detail)
// =====================================================================
// wrap a fill mesh + its inverted-hull graphite contour in one node, so a caller that
// offsets the returned node moves BOTH (a bare fill would leave its outline behind).
function outlined(geo, fillMat, push, seed, g) {
  const node = new THREE.Group();
  const fill = new THREE.Mesh(geo, fillMat);
  fill.scale.setScalar(0.997);          // sit just under the shell (no z-fight)
  node.add(fill);
  node.add(invertedHull(geo, push, seed, GRAPHITE));
  g.add(node);
  return node;
}
function makeDirigible(rng) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: WOOD1, flatShading: true });
  const cloth = new THREE.MeshLambertMaterial({ color: CANVAS, flatShading: true });
  const balloon = new THREE.SphereGeometry(1, 14, 10); balloon.scale(30, 13, 13);
  outlined(balloon, cloth, 0.5, (rng() * 1e9) | 0, g);
  // pastel band
  const band = new THREE.Mesh(new THREE.CylinderGeometry(13.2, 13.2, 6, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: PASTELS[(rng() * PASTELS.length) | 0], side: THREE.DoubleSide }));
  band.rotation.z = Math.PI / 2; g.add(band);
  const gond = new THREE.BoxGeometry(13, 4.5, 6); outlined(gond, wood, 0.4, (rng() * 1e9) | 0, g).position.y = -15;
  // rigging
  const rg = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-6, -12.5, 0), new THREE.Vector3(-9, -3, 0),
    new THREE.Vector3(6, -12.5, 0), new THREE.Vector3(9, -3, 0),
  ]), new THREE.LineBasicMaterial({ color: ROPE }));
  g.add(rg);
  const fin = new THREE.BoxGeometry(8, 10, 0.8); outlined(fin, cloth, 0.4, (rng() * 1e9) | 0, g).position.set(-30, 0, 0);
  const fin2 = new THREE.BoxGeometry(8, 0.8, 10); outlined(fin2, cloth, 0.4, (rng() * 1e9) | 0, g).position.set(-30, 0, 0);
  g.scale.setScalar(0.8 + rng() * 0.7);
  return { group: g };
}
function makeSkyBoat(rng, sailTex) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: WOOD2, flatShading: true });
  const cloth = new THREE.MeshLambertMaterial({ color: CANVAS, flatShading: true });
  // hull: a lathe teardrop
  const prof = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8; prof.push(new THREE.Vector2(Math.sin(u * Math.PI) * (2 + u * 4) * 0.9, -12 + u * 24)); }
  const hull = new THREE.LatheGeometry(prof, 10); hull.rotateZ(Math.PI / 2); hull.scale(1.6, 1, 1);
  outlined(hull, wood, 0.45, (rng() * 1e9) | 0, g);
  // small balloon canopy above
  const canopy = new THREE.SphereGeometry(1, 12, 8); canopy.scale(14, 9, 9);
  const cm = outlined(canopy, cloth, 0.45, (rng() * 1e9) | 0, g); cm.position.y = 16;
  // mast + sail
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 20, 6), wood); mast.position.y = 6; g.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshBasicMaterial({
    map: sailTex, color: PASTELS[(rng() * PASTELS.length) | 0], transparent: true, side: THREE.DoubleSide }));
  sail.position.set(6, 8, 0); sail.rotation.y = Math.PI / 2; g.add(sail);
  // propeller
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 1.4), wood); prop.position.set(-20, 0, 0); g.add(prop);
  g.scale.setScalar(0.85 + rng() * 0.7);
  return { group: g, prop };
}
function makeSkiff(rng) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshLambertMaterial({ color: CANVAS, flatShading: true });
  // a little one-person glider: a wing + a pod
  const wing = new THREE.ConeGeometry(9, 3, 4); wing.rotateX(Math.PI / 2); wing.scale(1, 1, 2.4);
  outlined(wing, cloth, 0.35, (rng() * 1e9) | 0, g);
  const pod = new THREE.SphereGeometry(2.6, 8, 6); outlined(pod, cloth, 0.35, (rng() * 1e9) | 0, g).position.y = -3;
  g.scale.setScalar(0.7 + rng() * 0.6);
  return { group: g };
}
// ---- the project craft: montgolfière OR dirigible × the software's own skins ----
// Each load rolls a craft type and a theme variant per project, so the sky differs
// every visit. Tints stay pale pencil-pastel, but the BAND carries a legible brand
// hue (the earlier all-pastel toast balloon read as unexplained pink).
const CRAFT_VARIANTS = {
  toast: [   // Toaster's real skins: brutalist red / café espresso / Arcade Quest
    { env: 0xf2e6d0, band: 0xd94f45, band2: null,     charm: 'toast', charmCol: 0xcaa15a }, // red
    { env: 0xe7d7c3, band: 0x8a6a4f, band2: 0xd8c3a8, charm: 'toast', charmCol: 0x6b4a33 }, // café
    { env: 0xdde8d4, band: 0x7fd08a, band2: 0xc79ede, charm: 'toast', charmCol: 0xcaa15a }, // arcade
  ],
  splash: [  // Splasher: dark-aqua tool skin / the cartoon wave
    { env: 0xc6dee8, band: 0x6f9fc4, band2: null,     charm: 'drop', charmCol: 0xa8d4e4, shape: 'drop' },
    { env: 0xe2eef2, band: 0x6aa5cc, band2: 0xffffff, charm: 'drop', charmCol: 0x8fc8de, shape: 'drop' }, // wave
  ],
  apairo: [  // Apairo: the robotics data factory by the sea — gold-sand / sea-and-gold
    { env: 0xf0e6cc, band: 0xd9a441, band2: null,     charm: 'robot', charmCol: 0xcfd6da },
    { env: 0xdfeaf0, band: 0x9ec4d4, band2: 0xd9a441, charm: 'robot', charmCol: 0xcfd6da },
  ],
  gear: [    // Origin: the inventor's wood-and-canvas craft (currently not flown)
    { env: 0xe9dcc2, band: 0xd4b78a, band2: null,     charm: 'gear', charmCol: 0xb8966a },
  ],
};

function makeCraft(rng, project) {
  const variants = CRAFT_VARIANTS[project] || CRAFT_VARIANTS.toast;
  const V = variants[(rng() * variants.length) | 0];
  const dirigible = rng() < 0.5;
  return dirigible ? makeDirigibleCraft(rng, V) : makeBalloonCraft(rng, V);
}

// the charm swinging under the craft + its themed micro-effect (kept subtle)
function makeCharm(rng, V, g, y) {
  const mat = new THREE.MeshLambertMaterial({ color: V.charmCol, flatShading: true });
  let charm;
  if (V.charm === 'toast') {
    charm = outlined(new THREE.BoxGeometry(4.2, 4.8, 1.1), mat, 0.35, (rng() * 1e9) | 0, g);
  } else if (V.charm === 'drop') {
    const geo = new THREE.SphereGeometry(2.2, 8, 6); geo.scale(1, 1.5, 1);
    charm = outlined(geo, mat, 0.35, (rng() * 1e9) | 0, g);
  } else if (V.charm === 'robot') {
    // a little pale-steel robot passenger with a blinking amber eye + antenna
    charm = new THREE.Group();
    outlined(new THREE.BoxGeometry(2.8, 3, 2.2), mat, 0.3, (rng() * 1e9) | 0, charm);
    outlined(new THREE.BoxGeometry(2.0, 1.6, 1.8), mat, 0.3, (rng() * 1e9) | 0, charm).position.y = 2.3;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xe0b04a, transparent: true, opacity: 0.9 }));
    eye.position.set(0, 2.3, 1.02); charm.add(eye);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 5),
      new THREE.MeshLambertMaterial({ color: ROPE, flatShading: true }));
    ant.position.y = 3.9; charm.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xe0b04a }));
    tip.position.y = 4.8; charm.add(tip);
    g.add(charm);
    charm.userData.eye = eye;
  } else {
    charm = new THREE.Group();
    charm.add(new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.7, 6, 8), mat));
    for (let s = 0; s < 2; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.6, 0.7), mat);
      spoke.rotation.z = s * Math.PI / 2; charm.add(spoke);
    }
    g.add(charm);
  }
  charm.position.y = y;
  const ph = rng() * 9;
  const parts = { charm, ph };
  if (V.charm === 'drop') {
    parts.drips = [];
    for (let d = 0; d < 3; d++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5),
        new THREE.MeshBasicMaterial({ color: V.charmCol, transparent: true }));
      g.add(m); parts.drips.push({ m, ph: d / 3 });
    }
  }
  return parts;
}
function animCharm(p, t, y) {
  p.charm.rotation.z = Math.sin(t * 0.9 + p.ph) * 0.2;   // gentle pendulum swing
  if (p.drips) for (const dr of p.drips) {
    const f = (t * 0.25 + dr.ph) % 1;
    dr.m.position.y = y - 2 - f * 9;
    dr.m.material.opacity = Math.max(0, 0.8 - f);
  }
  const eye = p.charm.userData && p.charm.userData.eye;
  if (eye) {  // the robot blinks: mostly lit, a quick wink now and then
    eye.material.opacity = Math.sin(t * 1.7 + p.ph) > -0.9 ? 0.9 : 0.15;
  }
}

function makeBalloonCraft(rng, V) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: WOOD1, flatShading: true });
  const cloth = new THREE.MeshLambertMaterial({ color: V.env, flatShading: true });
  // envelope: round, or a stretched teardrop for the splash droplet shape
  const env = new THREE.SphereGeometry(1, 14, 10);
  if (V.shape === 'drop') { env.scale(13, 17, 13); env.translate(0, 2, 0); }
  else env.scale(15, 16, 15);
  outlined(env, cloth, 0.5, (rng() * 1e9) | 0, g);
  // brand band(s) around the equator — the legible identity stripe
  const bandR = V.shape === 'drop' ? 12.6 : 14.6;
  const bandY = V.shape === 'drop' ? 2 : 0;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(bandR, bandR, 4.5, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: V.band, side: THREE.DoubleSide }));
  band.position.y = bandY; g.add(band);
  if (V.band2) {
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(bandR * 0.97, bandR * 0.97, 1.6, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: V.band2, side: THREE.DoubleSide }));
    b2.position.y = bandY - 3.6; g.add(b2);
  }
  // basket + rigging
  outlined(new THREE.BoxGeometry(6, 4.5, 6), wood, 0.4, (rng() * 1e9) | 0, g).position.y = -22;
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-2.6, -19.8, -2.6), new THREE.Vector3(-7, -8, -7),
    new THREE.Vector3(2.6, -19.8, -2.6), new THREE.Vector3(7, -8, -7),
    new THREE.Vector3(-2.6, -19.8, 2.6), new THREE.Vector3(-7, -8, 7),
    new THREE.Vector3(2.6, -19.8, 2.6), new THREE.Vector3(7, -8, 7),
  ]), new THREE.LineBasicMaterial({ color: ROPE })));
  // burner flame pulsing at the envelope mouth (all balloons have a burner)
  const flame = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffb14a, transparent: true, opacity: 0.7 }));
  flame.position.y = -17.5; g.add(flame);

  const charm = makeCharm(rng, V, g, -28);
  const anim = (t) => {
    flame.material.opacity = 0.35 + Math.abs(Math.sin(t * 7 + charm.ph)) * 0.45;
    flame.scale.y = 0.8 + Math.abs(Math.sin(t * 7 + charm.ph)) * 0.5;
    animCharm(charm, t, -28);
  };
  g.scale.setScalar(0.9 + rng() * 0.5);
  return { group: g, anim };
}

function makeDirigibleCraft(rng, V) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: WOOD2, flatShading: true });
  const cloth = new THREE.MeshLambertMaterial({ color: V.env, flatShading: true });
  const envelope = new THREE.SphereGeometry(1, 14, 10); envelope.scale(26, 11, 11);
  outlined(envelope, cloth, 0.5, (rng() * 1e9) | 0, g);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(11.2, 11.2, 5, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: V.band, side: THREE.DoubleSide }));
  band.rotation.z = Math.PI / 2; g.add(band);
  if (V.band2) {
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(10.9, 10.9, 2, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: V.band2, side: THREE.DoubleSide }));
    b2.rotation.z = Math.PI / 2; b2.position.x = 6; g.add(b2);
  }
  outlined(new THREE.BoxGeometry(11, 4, 5.5), wood, 0.4, (rng() * 1e9) | 0, g).position.y = -13;
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-5, -11, 0), new THREE.Vector3(-8, -3, 0),
    new THREE.Vector3(5, -11, 0), new THREE.Vector3(8, -3, 0),
  ]), new THREE.LineBasicMaterial({ color: ROPE })));
  // stern propeller: a great wooden GEAR for the inventor, plain blades otherwise
  const prop = new THREE.Group(); prop.position.set(-28, 0, 0); g.add(prop);
  if (V.charm === 'gear') {
    prop.add(new THREE.Mesh(new THREE.TorusGeometry(4.6, 1.0, 6, 8),
      new THREE.MeshLambertMaterial({ color: WOOD2, flatShading: true })));
    for (let s = 0; s < 4; s++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8.6, 1.6), wood);
      blade.rotation.z = (s / 4) * Math.PI; prop.add(blade);
    }
  } else {
    for (let s = 0; s < 2; s++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 1.4), wood);
      blade.rotation.z = s * Math.PI / 2; prop.add(blade);
    }
  }
  prop.rotation.y = Math.PI / 2;

  // the charm hangs under the gondola (skip for gear — its gear IS the propeller)
  const charm = V.charm === 'gear' ? null : makeCharm(rng, V, g, -19);
  const ph = rng() * 9;
  const anim = (t) => {
    prop.rotation.z = t * (V.charm === 'gear' ? 0.9 : 2.2) + ph;
    if (charm) animCharm(charm, t, -19);
  };
  g.scale.setScalar(0.9 + rng() * 0.4);
  return { group: g, anim };
}

// the B-612 — a tiny asteroid-world, kept precious
function makeAsteroid(rng) {
  const g = new THREE.Group();
  const rock = new THREE.MeshLambertMaterial({ color: 0xd9c9b0, flatShading: true });
  const geo = new THREE.IcosahedronGeometry(9, 1);
  const bumps = [];
  for (let i = 0; i < 5; i++) bumps.push({ v: new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize(), s: (0.2 + rng() * 0.3) * 9, f: 2 + rng() * 2 });
  displaceWorld(geo, bumps);
  outlined(geo, rock, 0.5, (rng() * 1e9) | 0, g);
  // a rose under a dome
  const rose = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf3c9c2 }));
  rose.position.y = 10; g.add(rose);
  // a baobab tuft + a matchstick volcano
  const tree = new THREE.Mesh(new THREE.ConeGeometry(2.5, 5, 6), new THREE.MeshLambertMaterial({ color: 0xbcd0a8, flatShading: true }));
  tree.position.set(4, 11, -2); g.add(tree);
  const volc = new THREE.Mesh(new THREE.ConeGeometry(2, 3, 6), new THREE.MeshLambertMaterial({ color: WOOD2, flatShading: true }));
  volc.position.set(-5, 10, 3); g.add(volc);
  g.scale.setScalar(0.9 + rng() * 0.4);
  return { group: g };
}

// =====================================================================
// baked canvas textures (pencil linework, sail hatch, sky, horizon)
// =====================================================================
function bakeSky() {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
  const ctx = cv.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, SKY[0]); grd.addColorStop(0.55, SKY[1]); grd.addColorStop(1, SKY[2]);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  return tex;
}
function bakeHorizonTex() {
  const w = 512, h = 16;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = BLUE; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.9;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 6) ctx.lineTo(x, h / 2 + Math.sin(x * 0.05) * 0.8);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// a pencil cloud: soft open-based wash + a wobbly doubled graphite top + underside
// hatch + faint stipple. Optionally a pale pastel wash. 8 seeded variants.
function bakeCloudTex(rng, withWash) {
  const s = 256;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const ctx = cv.getContext('2d');
  const n = 4 + ((rng() * 3) | 0);
  const lobes = []; let x = s * 0.18; const baseY = s * 0.6;
  for (let i = 0; i < n; i++) { const r = s * (0.08 + rng() * 0.075); lobes.push({ x: x + r, y: baseY - r * 0.5 - rng() * s * 0.05, r }); x += r * 1.3; }

  // soft wash fill (paper white, occasionally pastel)
  for (const l of lobes) {
    const g = ctx.createRadialGradient(l.x, l.y, 1, l.x, l.y, l.r * 1.15);
    g.addColorStop(0, 'rgba(247,245,238,0.62)'); g.addColorStop(0.7, 'rgba(246,242,231,0.34)'); g.addColorStop(1, 'rgba(244,240,228,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, l.r * 1.15, 0, Math.PI * 2); ctx.fill();
  }
  if (withWash) {
    const p = ['rgba(199,216,226,0.20)', 'rgba(242,221,201,0.20)', 'rgba(236,212,212,0.18)'][(rng() * 3) | 0];
    for (const l of lobes) { ctx.fillStyle = p; ctx.beginPath(); ctx.arc(l.x, l.y - l.r * 0.15, l.r * 0.85, 0, Math.PI * 2); ctx.fill(); }
  }

  // wobbly doubled graphite top contour (base left OPEN)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const j = () => (rng() - 0.5) * 3.2;
  for (let pass = 0; pass < 3; pass++) {
    ctx.strokeStyle = `rgba(74,68,59,${0.62 - pass * 0.15})`; ctx.lineWidth = 2.6 - pass * 0.6;
    ctx.beginPath();
    for (let i = 0; i < lobes.length; i++) {
      const l = lobes[i]; const a0 = Math.PI * 1.04, a1 = Math.PI * 1.96;
      if (i === 0) ctx.moveTo(l.x + Math.cos(a0) * l.r + j(), l.y + Math.sin(a0) * l.r + j());
      ctx.arc(l.x + j() * 0.3, l.y + j() * 0.3, l.r, a0, a1);
    }
    ctx.stroke();
  }
  // underside hatch (shaded third only), light from upper-left
  ctx.strokeStyle = 'rgba(107,99,87,0.16)'; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const hx = s * 0.28 + rng() * s * 0.44, hy = baseY - 6 + rng() * s * 0.05;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 6, hy + 9); ctx.stroke();
  }
  // paper tooth stipple
  ctx.fillStyle = 'rgba(120,112,96,0.05)';
  for (let i = 0; i < 90; i++) ctx.fillRect(s * 0.12 + rng() * s * 0.76, s * 0.28 + rng() * s * 0.42, 1, 1);

  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function bakeSailTex(rng) {
  const s = 128;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.0)'; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(91,83,72,0.18)'; ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) { const y = (i / 10) * s; ctx.beginPath(); ctx.moveTo(0, y + rng() * 3); ctx.lineTo(s, y + rng() * 3); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.transparent = true;
  return tex;
}
