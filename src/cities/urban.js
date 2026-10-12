// urban.js — the FABRIC that makes a settlement read as a CITY: buildings with windows
// and roofs standing on pavement blocks, streets between them, lamps, trees, traffic,
// people. A city describes its fabric (lots, who drives and walks where) and gets a
// handful of INSTANCED meshes back: a dense district costs a few draw calls, and none
// of its small parts is ever what the pointer picks (only building bodies are).
//
// Heights are city-local. world.js levels the ground under a city and sinks the city
// half a unit, so the ground a city stands on is at y = GROUND.
import * as THREE from 'three';
import { mulberry32 } from '../gen/noise.js';

export const GROUND = 0.5;

const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color();
const noRaycast = () => {};

const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);          // stands on its base
const PANE = new THREE.PlaneGeometry(1, 1);                               // a window, facing +Z
// a gable roof: unit triangular prism, ridge along Z, standing on its base
const GABLE = (() => {
  const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], C = [0, 1, -0.5], D = [-0.5, 0, 0.5], E = [0.5, 0, 0.5], F = [0, 1, 0.5];
  const tris = [D, E, F, B, A, C, A, D, F, A, F, C, E, B, C, E, C, F];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
})();
// a pyramid roof on a unit square base
const PYRAMID = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const CROWN = new THREE.IcosahedronGeometry(1, 0);

const DEFAULTS = {
  seed: 7,
  walls: [0xd8cfbf, 0xc9bda8, 0xe2dccf],  // body colours, one picked per building
  wallGlow: 0x000000, wallGlowI: 0,       // a floor of own light, for dark cities
  roof: 'flat',                           // 'flat' | 'gable' | 'pyramid'
  roofs: [0x8a5a44],                      // pitched-roof colours
  trim: 0xb9ad98,                         // cornices, roof clutter
  pavement: 0xbfb8aa,                     // the slab a block of buildings stands on
  windowLit: [0xffd9a0, 0xffe8c4, 0xf7c97a], windowOff: 0x2b3038, litP: 0.4,
  floorH: 1.8, bay: 1.7,                  // window rhythm
  awnings: null,                          // [colours] → shopfront awnings on some ground floors
  lamp: 0xffe6b0, pole: 0x3a3d42,
  leaves: [0x5f8f52, 0x4f7d48], trunk: 0x5a4632,
  cars: [0xd9534f, 0xf0ad4e, 0x5bc0de, 0xf5f5f5, 0x3a3f4a], people: [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x264653, 0xf4a261, 0xf1faee],
  marking: 0xf1ead8,
};

export class Fabric {
  constructor(style = {}) {
    this.style = { ...DEFAULTS, ...style };
    this.rand = mulberry32(this.style.seed >>> 0);
    this.bodies = []; this.props = []; this.gables = []; this.pyramids = []; this.windows = [];
    this.lights = []; this.crowns = []; this.puffs = [];
    this.vehicles = []; this.walkersList = []; this.crowdList = [];
    this.extra = [];
  }

  pick(list) { return list[(this.rand() * list.length) | 0]; }

  // a plain box standing on y (pavement, awning, crate, roof clutter…)
  prop(x, y, z, w, h, d, color, rot = 0) { this.props.push({ x, y, z, w, h, d, color, rot }); }

  // ONE BUILDING on the lot (x, z), w wide × d deep × h high, turned by rot.
  // o: color, roof ('flat'|'gable'|'pyramid'|'none'), roofColor, y (base), windows (bool),
  //    litP, faces (which of the 4 sides get windows: 0 = +Z front, then +X, -Z, -X),
  //    shop (awning on the front), clutter (bool).
  building(x, z, w, d, h, o = {}) {
    const st = this.style, rot = o.rot ?? 0, y = o.y ?? GROUND - 0.3;
    const color = o.color ?? this.pick(st.walls);
    this.bodies.push({ x, y, z, w, h, d, color, rot });
    const top = y + h, roof = o.roof ?? st.roof;
    if (roof === 'flat') {
      this.prop(x, top - 0.06, z, w + 0.34, 0.3, d + 0.34, o.trim ?? st.trim, rot);
      if (o.clutter !== false && Math.min(w, d) > 2.4) {
        const n = 1 + ((this.rand() * 2.4) | 0);
        for (let i = 0; i < n; i++) {
          const cw = 0.7 + this.rand() * 0.9, ch = 0.5 + this.rand() * 1.1;
          const [ox, oz] = this._turn((this.rand() - 0.5) * (w - cw - 0.6), (this.rand() - 0.5) * (d - cw - 0.6), rot);
          this.prop(x + ox, top + 0.2, z + oz, cw, ch, cw, o.trim ?? st.trim, rot);
        }
      }
    } else if (roof === 'gable') {
      const along = o.ridge ? o.ridge === 'z' : d >= w;       // by default the ridge runs along the long side
      this.gables.push({
        x, y: top, z, w: (along ? w : d) + 0.5, h: o.rise ?? Math.min(w, d) * 0.5, d: (along ? d : w) + 0.5,
        color: o.roofColor ?? this.pick(st.roofs), rot: rot + (along ? 0 : Math.PI / 2),
      });
    } else if (roof === 'pyramid') {
      this.pyramids.push({ x, y: top, z, w: w + 0.5, h: o.rise ?? Math.min(w, d) * 0.5, d: d + 0.5, color: o.roofColor ?? this.pick(st.roofs), rot });
    }
    if (o.windows !== false) this.windowsOn(x, y, z, w, d, h, rot, o);
    if ((o.shop ?? !!st.awnings) && st.awnings && this.rand() < 0.6) {
      const [ox, oz] = this._turn(0, d / 2 + 0.45, rot);
      this.prop(x + ox, GROUND + 1.55, z + oz, Math.min(w * 0.8, 3.4), 0.14, 0.9, this.pick(st.awnings), rot);
    }
    return { x, z, w, d, h, top, rot };
  }

  // windows alone, on a volume that already exists (a city's own landmark or monolith)
  windowsOn(x, y, z, w, d, h, rot = 0, o = {}) {
    const st = this.style, floorH = o.floorH ?? st.floorH, bay = o.bay ?? st.bay, litP = o.litP ?? st.litP;
    const base = Math.max(y, GROUND) + (o.skipGround === false ? 0.2 : floorH * 0.9);
    const rows = Math.floor((y + h - 0.5 - base) / floorH);
    if (rows < 1) return;
    for (const f of o.faces ?? [0, 1, 2, 3]) {
      const width = f % 2 ? d : w, out = (f % 2 ? w : d) / 2 + 0.035;
      const cols = Math.max(1, Math.floor((width - 0.5) / bay));
      const pitch = (width - 0.5) / cols, yaw = rot + f * Math.PI / 2;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const [ox, oz] = this._turn((i - (cols - 1) / 2) * pitch, out, yaw);
        const lit = this.rand() < litP;
        this.windows.push({
          x: x + ox, y: base + (j + 0.5) * floorH, z: z + oz, w: pitch * 0.54, h: floorH * 0.5, yaw,
          lit, on: this.pick(st.windowLit), off: o.windowOff ?? st.windowOff,
        });
      }
    }
  }

  // a paved slab on the ground: a block's pavement, a square, a road
  slab(x, z, w, d, color, rot = 0, h = 0.14) { this.prop(x, GROUND - 1.2, z, w, 1.2 + h, d, color ?? this.style.pavement, rot); }

  // a straight road with a dashed centre line
  road(x1, z1, x2, z2, width = 3.2, color = 0x3d4046) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), rot = Math.atan2(dx, dz);
    this.slab((x1 + x2) / 2, (z1 + z2) / 2, width, len, color, rot, 0.05);
    for (let s = 1.2; s < len - 1; s += 2.6) {
      this.prop(x1 + dx * s / len, GROUND + 0.05, z1 + dz * s / len, 0.14, 0.03, 1.1, this.style.marking, rot);
    }
  }

  // a circular road (its own lathed ring) with a dashed centre line
  ring(r, width = 3.2, color = 0x3d4046, cx = 0, cz = 0) {
    const prof = [[r - width / 2, -1.2], [r - width / 2, 0.05], [r + width / 2, 0.05], [r + width / 2, -1.2]]
      .map(([a, b]) => new THREE.Vector2(a, GROUND + b));
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(prof, Math.max(24, Math.round(r * 1.6))),
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, side: THREE.DoubleSide }));
    mesh.position.set(cx, 0, cz); mesh.receiveShadow = true; mesh.raycast = noRaycast;
    this.extra.push(mesh);
    const n = Math.round(Math.PI * 2 * r / 2.6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.prop(cx + Math.sin(a) * r, GROUND + 0.05, cz + Math.cos(a) * r, 0.14, 0.03, 1.1, this.style.marking, a + Math.PI / 2);
    }
  }

  lamp(x, z, h = 3.4) {
    this.prop(x, GROUND, z, 0.13, h, 0.13, this.style.pole);
    this.lights.push({ x, y: GROUND + h, z, s: 0.42, color: this.style.lamp });
  }

  // a small light: steady, or blinking every `period` seconds, lit for `duty` of it
  // (rooftop beacons, signs; a short duty makes a camera flash)
  light(x, y, z, color, s = 0.3, period = 0, phase = 0, duty = 0.5) { this.lights.push({ x, y, z, s, color, period, phase, duty }); }

  tree(x, z, s = 1) {
    this.prop(x, GROUND, z, 0.22 * s, 1.5 * s, 0.22 * s, this.style.trunk);
    this.crowns.push({ x, y: GROUND + 2.3 * s, z, s: 1.15 * s * (0.85 + this.rand() * 0.3), color: this.pick(this.style.leaves) });
  }

  // smoke from a chimney: `n` puffs rising and thinning
  smoke(x, y, z, n = 4, color = 0xf4f1ea) { for (let i = 0; i < n; i++) this.puffs.push({ x, y, z, off: i / n, color }); }

  // TRAFFIC on a path: { pts: [[x, z], …], closed } or { ring: r, cx, cz }. Two lanes,
  // half the cars each way. o: n, speed, colors, lane (offset from the centre line),
  // w/h/l (size), y (height above the ground: drones fly the same paths).
  traffic(path, o = {}) {
    const n = o.n ?? 6, track = makeTrack(path);
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      this.vehicles.push({
        track, s0: this.rand() * track.len, v: (o.speed ?? 5) * (0.8 + this.rand() * 0.4) * dir,
        lane: (o.lane ?? 0.75) * dir, color: this.pick(o.colors ?? this.style.cars),
        w: o.w ?? 0.95, h: o.h ?? 0.75, l: o.l ?? 1.9, y: o.y ?? 0.1,
      });
    }
  }

  // PEOPLE walking a path, both ways, a little off its centre line
  walkers(path, o = {}) {
    const n = o.n ?? 8, track = makeTrack(path);
    for (let i = 0; i < n; i++) {
      this.walkersList.push({
        track, s0: this.rand() * track.len, v: (o.speed ?? 0.9) * (0.7 + this.rand() * 0.6) * (i % 2 ? 1 : -1),
        lane: (o.side ?? 0) + (this.rand() - 0.5) * (o.spread ?? 0.8), color: this.pick(o.colors ?? this.style.people),
        ph: this.rand() * 6.28,
      });
    }
  }

  // PEOPLE milling about: place(i, rand) → [x, z] gives each one a spot to hover around.
  // Returns the records ({x, z, …}) so a city can make its own crowd dance.
  crowd(n, place, o = {}) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const [x, z] = place(i, this.rand);
      const rec = {
        x, z, roam: o.roam ?? 0.9, color: this.pick(o.colors ?? this.style.people),
        f1: 0.25 + this.rand() * 0.4, f2: 0.25 + this.rand() * 0.4, p1: this.rand() * 6.28, p2: this.rand() * 6.28, hop: 0,
      };
      this.crowdList.push(rec); out.push(rec);
    }
    return out;
  }

  _turn(lx, lz, rot) { const c = Math.cos(rot), s = Math.sin(rot); return [lx * c + lz * s, -lx * s + lz * c]; }

  // ---- everything declared so far → instanced meshes -------------------------------
  build() {
    const st = this.style, group = new THREE.Group();
    group.name = 'fabric';
    const instanced = (geo, mat, list, place, opts = {}) => {
      if (!list.length) return null;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((e, i) => { place(e, i, mesh); });
      mesh.castShadow = !!opts.cast; mesh.receiveShadow = opts.receive !== false;
      if (opts.detail) mesh.userData.detail = opts.detail;   // size of ONE instance → world.js sortDetail
      if (!opts.pick) mesh.raycast = noRaycast;
      if (opts.moving) mesh.frustumCulled = false;   // its bounds would be stale as soon as it moves
      group.add(mesh);
      return mesh;
    };
    const boxAt = (e, i, mesh) => {
      _q.setFromAxisAngle(UP, e.rot || 0);
      mesh.setMatrixAt(i, _m.compose(_p.set(e.x, e.y, e.z), _q, _s.set(e.w, e.h, e.d)));
      mesh.setColorAt(i, _c.set(e.color));
    };
    const solid = () => new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.88 });

    const wall = solid(); wall.emissive.set(st.wallGlow); wall.emissiveIntensity = st.wallGlowI;
    instanced(BOX, wall, this.bodies, boxAt, { cast: true, pick: true });
    // props come in all sizes, from a pavement to an awning: the small ones are a
    // mesh of their own, so they can be dropped from afar
    const small = (e) => Math.max(e.w, e.h, e.d) < 2.4;
    instanced(BOX, solid(), this.props.filter((e) => !small(e)), boxAt);
    instanced(BOX, solid(), this.props.filter(small), boxAt, { detail: 0.7 });
    instanced(GABLE, solid(), this.gables, boxAt, { cast: true });
    instanced(PYRAMID, solid(), this.pyramids, boxAt, { cast: true });
    for (const m of this.extra) group.add(m);

    // windows: unlit panes whose colour IS their state (lit / dark); a few flip now and then
    const winMesh = instanced(PANE, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.windows, (e, i, mesh) => {
      _q.setFromAxisAngle(UP, e.yaw);
      mesh.setMatrixAt(i, _m.compose(_p.set(e.x, e.y, e.z), _q, _s.set(e.w, e.h, 1)));
      mesh.setColorAt(i, _c.set(e.lit ? e.on : e.off));
    }, { receive: false, detail: 0.6 });

    const lightMesh = instanced(BOX, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.lights, (e, i, mesh) => {
      mesh.setMatrixAt(i, _m.compose(_p.set(e.x, e.y, e.z), _q.identity(), _s.set(e.s, e.s * 0.7, e.s)));
      mesh.setColorAt(i, _c.set(e.color));
    }, { receive: false, detail: 0.3 });
    const blinkers = this.lights.map((e, i) => ({ e, i })).filter(({ e }) => e.period > 0);

    instanced(CROWN, solid(), this.crowns, (e, i, mesh) => {
      mesh.setMatrixAt(i, _m.compose(_p.set(e.x, e.y, e.z), _q.identity(), _s.set(e.s, e.s * 1.05, e.s)));
      mesh.setColorAt(i, _c.set(e.color));
    }, { cast: true, detail: 1.2 });

    const puffMesh = instanced(CROWN, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, transparent: true, opacity: 0.42, depthWrite: false }),
      this.puffs, (e, i, mesh) => { mesh.setColorAt(i, _c.set(e.color)); }, { receive: false, moving: true, detail: 0.7 });

    const carMesh = instanced(BOX, solid(), this.vehicles, (e, i, mesh) => { mesh.setColorAt(i, _c.set(e.color)); }, { moving: true, detail: 1.0 });
    const folk = [...this.walkersList, ...this.crowdList];
    const folkMesh = instanced(BOX, solid(), folk, (e, i, mesh) => { mesh.setColorAt(i, _c.set(e.color)); }, { receive: false, moving: true, detail: 0.5 });

    const windows = this.windows, vehicles = this.vehicles, walkers = this.walkersList, crowd = this.crowdList, puffs = this.puffs;
    const flip = mulberry32((st.seed ^ 0x51f7) >>> 0);
    let nextFlip = 0;
    const at = { x: 0, z: 0, yaw: 0 };

    return {
      group,
      update(t) {
        // a window goes dark, another lights up
        if (winMesh && t > nextFlip) {
          nextFlip = t + 0.35;
          for (let k = 0, n = 1 + (windows.length >> 9); k < n; k++) {
            const i = (flip() * windows.length) | 0, e = windows[i];
            e.lit = !e.lit; winMesh.setColorAt(i, _c.set(e.lit ? e.on : e.off));
          }
          winMesh.instanceColor.needsUpdate = true;
        }
        if (blinkers.length) {
          for (const { e, i } of blinkers) {
            const on = ((t / e.period + (e.phase || 0)) % 1) < e.duty;
            lightMesh.setColorAt(i, on ? _c.set(e.color) : _c.set(e.color).multiplyScalar(0.12));
          }
          lightMesh.instanceColor.needsUpdate = true;
        }
        if (carMesh) {
          vehicles.forEach((e, i) => {
            e.track.at(e.s0 + e.v * t, at);
            const side = at.yaw + Math.PI / 2;
            _q.setFromAxisAngle(UP, at.yaw);
            carMesh.setMatrixAt(i, _m.compose(
              _p.set(at.x + Math.sin(side) * e.lane, GROUND + e.y, at.z + Math.cos(side) * e.lane), _q, _s.set(e.w, e.h, e.l)));
          });
          carMesh.instanceMatrix.needsUpdate = true;
        }
        if (folkMesh) {
          let i = 0;
          for (const e of walkers) {
            e.track.at(e.s0 + e.v * t, at);
            const side = at.yaw + Math.PI / 2;
            folkMesh.setMatrixAt(i++, _m.compose(
              _p.set(at.x + Math.sin(side) * e.lane, GROUND + 0.05 + Math.abs(Math.sin(t * 6 + e.ph)) * 0.07, at.z + Math.cos(side) * e.lane),
              _q.identity(), _s.set(0.34, 0.92, 0.34)));
          }
          for (const e of crowd) {
            folkMesh.setMatrixAt(i++, _m.compose(
              _p.set(e.x + Math.sin(t * e.f1 + e.p1) * e.roam, GROUND + 0.05 + e.hop, e.z + Math.sin(t * e.f2 + e.p2) * e.roam),
              _q.identity(), _s.set(0.34, 0.92, 0.34)));
          }
          folkMesh.instanceMatrix.needsUpdate = true;
        }
        if (puffMesh) {
          puffs.forEach((e, i) => {
            const f = (t * 0.16 + e.off) % 1, s = (0.3 + f * 1.0) * (1 - f * f * 0.8);
            puffMesh.setMatrixAt(i, _m.compose(
              _p.set(e.x + Math.sin(f * 4 + e.off * 9) * 0.5 + f * 1.4, e.y + f * 7, e.z), _q.identity(), _s.set(s, s, s)));
          });
          puffMesh.instanceMatrix.needsUpdate = true;
        }
      },
    };
  }
}

// a path cars or people follow: at(s, out) gives the point and heading at distance s
function makeTrack(path) {
  if (path.ring) {
    const r = path.ring, cx = path.cx || 0, cz = path.cz || 0, len = Math.PI * 2 * r;
    return {
      len,
      at(s, out) {
        const a = (s / r) % (Math.PI * 2);
        out.x = cx + Math.sin(a) * r; out.z = cz + Math.cos(a) * r; out.yaw = a + Math.PI / 2;
        return out;
      },
    };
  }
  // an open path is driven there and back: mirror it into a loop
  const pts = path.closed ? path.pts : [...path.pts, ...path.pts.slice(1, -1).reverse()];
  const seg = [];
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push({ a, b, l, s: len, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) }); len += l;
  }
  return {
    len,
    at(s, out) {
      s = ((s % len) + len) % len;
      let k = 0;
      while (k < seg.length - 1 && s > seg[k].s + seg[k].l) k++;
      const g = seg[k], f = g.l ? (s - g.s) / g.l : 0;
      out.x = g.a[0] + (g.b[0] - g.a[0]) * f; out.z = g.a[1] + (g.b[1] - g.a[1]) * f; out.yaw = g.yaw;
      return out;
    },
  };
}

// A STREET GRID of city blocks over a disc of radius R: every block is a pavement slab
// carrying two to four buildings; the terrain between slabs (tinted by the city's
// ground colour) reads as the streets. `keep(x, z, r)` says where blocks may stand —
// leave the landmarks, squares and roads out. `height(x, z, r)` shapes the skyline.
export function district(fab, { R, angle = 0, block = 10, street = 3.4, keep = () => true, height = () => 8, cx = 0, cz = 0, o = {} }) {
  const rand = fab.rand, b = block - street, n = Math.ceil(R / block) + 1;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const [ox, oz] = fab._turn(i * block, j * block, angle);
    const x = cx + ox, z = cz + oz, r = Math.hypot(ox, oz);
    if (r + b * 0.62 > R || !keep(x, z, r)) continue;
    fab.slab(x, z, b, b, null, angle);
    if (rand() < 0.07) {                                       // a pocket park
      fab.tree(x - 1.2, z + 0.8, 1.1); fab.tree(x + 1.4, z - 1.0, 0.9);
      continue;
    }
    const lots = rand() < 0.28 ? [[0, 0, b - 0.9, b - 0.9]]                              // one big building
      : rand() < 0.5 ? [[-b / 4, 0, b / 2 - 0.7, b - 0.9], [b / 4, 0, b / 2 - 0.7, b - 0.9]]   // two slabs
        : [[-b / 4, -b / 4, b / 2 - 0.7, b / 2 - 0.7], [b / 4, -b / 4, b / 2 - 0.7, b / 2 - 0.7],
          [-b / 4, b / 4, b / 2 - 0.7, b / 2 - 0.7], [b / 4, b / 4, b / 2 - 0.7, b / 2 - 0.7]];
    for (const [lx, lz, w, d] of lots) {
      if (lots.length === 4 && rand() < 0.12) continue;       // a gap in the block
      const [px, pz] = fab._turn(lx, lz, angle);
      fab.building(x + px, z + pz, w, d, Math.max(2.4, height(x + px, z + pz, r) * (0.72 + rand() * 0.56)), { rot: angle, ...o });
    }
  }
}
