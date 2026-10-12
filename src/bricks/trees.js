// trees.js (brick) — everything that GROWS: the trees of every species the biomes
// call for (gen/placement.js), bushes, reeds. Each species is a low-poly shape or two
// drawn as INSTANCED meshes — a whole forest is one draw call — tinted per instance
// (which is how one broadleaf shape is an oak here, a maple in October there, a
// cherry in blossom further on), and swayed by the wind in the vertex shader.
import * as THREE from 'three';
import { ACTIVE } from '../themes.js';
import { underWeather } from './weather.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _white = new THREE.Color(0xffffff);
const _col = new THREE.Color(), _c = new THREE.Color();

// several geometries → one (positions only: everything here is flat-shaded)
function merge(parts) {
  const pos = [];
  for (const g of parts) {
    const flat = g.index ? g.toNonIndexed() : g;
    pos.push(...flat.attributes.position.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}
const at = (geo, x, y, z) => geo.translate(x, y, z);
// a limb from a to b
function limb(a, b, r0, r1, seg = 4) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---- the shapes (a tree of scale 1 stands 5–6 units tall) ---------------------------
const SHAPES = {
  conifer() {
    return {
      trunk: at(new THREE.CylinderGeometry(0.18, 0.28, 2.6, 5, 1, true), 0, 1.3, 0),
      // two tiers, the upper one tucked into the lower
      leaves: merge([at(new THREE.ConeGeometry(1.6, 3.3, 6), 0, 2.85, 0), at(new THREE.ConeGeometry(1.1, 2.7, 6, 1, true), 0, 4.45, 0)]),
    };
  },
  broad() {
    return {
      trunk: at(new THREE.CylinderGeometry(0.22, 0.32, 2.4, 5, 1, true), 0, 1.2, 0),
      leaves: at(new THREE.IcosahedronGeometry(1.9, 0).scale(1, 0.85, 1), 0, 4.0, 0),
    };
  },
  palm() {
    // a trunk that leans out and straightens, a crown of drooping fronds
    const trunk = new THREE.CylinderGeometry(0.15, 0.27, 5.2, 5, 3, true).translate(0, 2.6, 0);
    const tp = trunk.attributes.position;
    for (let i = 0; i < tp.count; i++) { const t = tp.getY(i) / 5.2; tp.setX(i, tp.getX(i) + 1.0 * t * t); }
    const pos = [], C = V(1.0, 5.2, 0);
    for (let f = 0; f < 7; f++) {
      const a = (f / 7) * Math.PI * 2 + 0.3, dx = Math.cos(a), dz = Math.sin(a), px = -dz * 0.48, pz = dx * 0.48;
      const mid = V(C.x + dx * 1.5, C.y + 0.5, C.z + dz * 1.5), tip = V(C.x + dx * 3.0, C.y - 0.85, C.z + dz * 3.0);
      pos.push(C.x, C.y, C.z, mid.x + px, mid.y, mid.z + pz, mid.x - px, mid.y, mid.z - pz);
      pos.push(mid.x + px, mid.y, mid.z + pz, tip.x, tip.y, tip.z, mid.x - px, mid.y, mid.z - pz);
    }
    const leaves = new THREE.BufferGeometry();
    leaves.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    leaves.computeVertexNormals();
    return { trunk, leaves, twoSided: true };
  },
  acacia() {
    // the umbrella of the savanna: a forked trunk, a wide flat crown
    return {
      trunk: merge([limb(V(0, 0, 0), V(0.25, 2.3, 0), 0.26, 0.17, 5), limb(V(0.25, 2.3, 0), V(-0.7, 3.5, 0.3), 0.15, 0.09), limb(V(0.25, 2.3, 0), V(1.1, 3.4, -0.2), 0.15, 0.09)]),
      leaves: merge([at(new THREE.IcosahedronGeometry(2.3, 0).scale(1.25, 0.3, 1.25), 0.1, 3.9, 0), at(new THREE.IcosahedronGeometry(1.3, 0).scale(1.2, 0.32, 1.2), 1.5, 3.5, -0.5)]),
    };
  },
  cactus() {
    // a saguaro: one column, two arms that turn up
    const arm = (side, y, reach, up) => [
      at(new THREE.BoxGeometry(reach, 0.34, 0.34), side * (0.3 + reach / 2), y, 0),
      at(new THREE.CylinderGeometry(0.2, 0.22, up, 5), side * (0.3 + reach), y + up / 2, 0),
    ];
    return { leaves: merge([at(new THREE.CylinderGeometry(0.34, 0.42, 3.7, 6), 0, 1.85, 0), ...arm(1, 1.9, 0.75, 1.5), ...arm(-1, 1.35, 0.6, 1.2)]) };
  },
  dead() {
    // what the marsh or the lava left: a bare trunk, a few broken limbs
    return {
      leaves: merge([limb(V(0, 0, 0), V(0.2, 3.6, 0.1), 0.3, 0.1, 5), limb(V(0.1, 2.0, 0), V(1.2, 3.1, 0.3), 0.12, 0.04), limb(V(0.15, 2.6, 0), V(-0.9, 3.7, -0.4), 0.11, 0.04), limb(V(0.12, 1.5, 0), V(-0.5, 2.2, 0.8), 0.09, 0.03)]),
    };
  },
};

// ---- the colours --------------------------------------------------------------------
const TRUNK = new THREE.Color('#6b4f33'), PALE_TRUNK = new THREE.Color('#8d7250');
const AUTUMN = ['#dc8a2e', '#c9522b', '#e2b53c', '#b33c2b', '#e7a13a', '#93a046'].map((c) => new THREE.Color(c));
const BLOSSOM = ['#f3b6ce', '#f8d9e4', '#ee9cbd', '#fbeff3'].map((c) => new THREE.Color(c));
const BLOOM = ['#e58fb0', '#f2d15c', '#f1ece0', '#6f9a52', '#6f9a52', '#b49be0'].map((c) => new THREE.Color(c));
const FROST = new THREE.Color('#eef2ef');
const of = (list, t) => list[Math.min(list.length - 1, (t * list.length) | 0)];
const LEAF = {
  conifer: (t) => _c.set(t.tone === 'dark' ? '#2f5a3b' : '#3f703c').offsetHSL(0, 0, (t.tint - 0.5) * 0.1).lerp(FROST, (t.frost || 0) * 0.78),
  broad: (t) => (t.tone === 'autumn' ? _c.copy(of(AUTUMN, t.tint)).offsetHSL(0, 0, ((t.rot * 7) % 1 - 0.5) * 0.06)
    : t.tone === 'blossom' ? _c.copy(of(BLOSSOM, t.tint))
      : _c.set('#62994a').offsetHSL((t.tint - 0.5) * 0.05, 0, (t.tint - 0.5) * 0.14)),
  palm: (t) => _c.set('#4f9a4a').offsetHSL((t.tint - 0.5) * 0.04, 0, (t.tint - 0.5) * 0.1),
  acacia: (t) => _c.set('#7f9a48').offsetHSL((t.tint - 0.5) * 0.05, 0, (t.tint - 0.5) * 0.1),
  cactus: (t) => _c.set('#5b8c58').offsetHSL(0, 0, (t.tint - 0.5) * 0.1),
  dead: (t) => _c.set('#7c6c5a').offsetHSL(0, 0, (t.tint - 0.5) * 0.12),
};
const BUSH = {
  green: (t) => _c.set('#5f8f4a').offsetHSL((t.tint - 0.5) * 0.05, 0, (t.tint - 0.5) * 0.12),
  heather: (t) => _c.set(t.tint < 0.6 ? '#a26c9d' : t.tint < 0.85 ? '#8a80b4' : '#7a8f55').offsetHSL(0, 0, (t.rot % 1 - 0.5) * 0.08),
  dry: (t) => _c.set('#b3a25c').offsetHSL(0, 0, (t.tint - 0.5) * 0.14),
  bloom: (t) => _c.copy(of(BLOOM, t.tint)),
};

export function buildTrees(scatter) {
  const group = new THREE.Group();
  group.name = 'trees';
  const painted = [];             // { mesh, list, colorOf } — re-tinted on a theme switch

  // per-instance colour = the species' tint, lifted toward white by the theme's pastel
  // amount (0 in the diorama) so foliage goes pale in the croquis with the terrain
  const paint = ({ mesh, list, colorOf }) => {
    list.forEach((t, n) => {
      _col.copy(colorOf(t));
      if (ACTIVE.pastel) _col.lerp(_white, ACTIVE.pastel * 0.85);
      mesh.setColorAt(n, _col);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  // white base so the per-instance colour shows true (instanceColor multiplies)
  const instanced = (geo, list, colorOf, { sway = 0, cast = false, twoSided = false, widen = 1 } = {}) => {
    if (!list.length || !geo) return;
    const mat = underWeather(new THREE.MeshStandardMaterial({
      color: 0xffffff, flatShading: true, roughness: 0.95, side: twoSided ? THREE.DoubleSide : THREE.FrontSide,
    }), { sway });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, n) => {
      _p.set(t.x, t.y, t.z);
      _q.setFromAxisAngle(_up, t.rot || 0);
      const s = t.scale || 1;
      _s.set(s * widen, s * (t.tall || 1), s * widen);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(n, _m);
    });
    mesh.castShadow = cast; mesh.receiveShadow = true;
    mesh.raycast = () => {};
    const rec = { mesh, list, colorOf };
    paint(rec); painted.push(rec);
    group.add(mesh);
  };

  // ---- trees, by species ----
  const bySpecies = {};
  for (const t of scatter.trees) (bySpecies[t.kind] || (bySpecies[t.kind] = [])).push(t);
  for (const kind in bySpecies) {
    if (!SHAPES[kind]) continue;
    const shape = SHAPES[kind](), list = bySpecies[kind];
    instanced(shape.leaves, list, LEAF[kind], {
      sway: kind === 'cactus' || kind === 'dead' ? 0 : kind === 'palm' ? 0.03 : 0.02, cast: true, twoSided: shape.twoSided,
    });
    instanced(shape.trunk, list, () => (kind === 'palm' ? PALE_TRUNK : TRUNK));
  }

  // ---- bushes: a low round shrub, the colour of where it grows ----
  instanced(at(new THREE.IcosahedronGeometry(1, 0).scale(1.15, 0.72, 1.15), 0, 0.45, 0),
    scatter.bushes || [], (t) => (BUSH[t.tone] || BUSH.green)(t), { sway: 0.012 });

  // ---- reeds: a tuft of blades on the water's edge ----
  {
    const pos = [];
    for (let b = 0; b < 4; b++) {
      const a = b * 0.8 + 0.2, dx = Math.cos(a), dz = Math.sin(a), lean = 0.35 * (b % 2 ? 1 : -1);
      pos.push(-dz * 0.11, 0, dx * 0.11, dz * 0.11, 0, -dx * 0.11, dx * lean, 2.3 + (b % 3) * 0.4, dz * lean);
    }
    const blades = new THREE.BufferGeometry();
    blades.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    blades.computeVertexNormals();
    instanced(blades, scatter.reeds || [], (t) => _c.set('#8fa052').offsetHSL(0, 0, (t.tint - 0.5) * 0.16), { sway: 0.06, twoSided: true });
  }

  return {
    group,
    update() {},                   // the wind is the weather's (bricks/weather.js)
    // recolour everything for the active theme's pastel (no geometry rebuild)
    restyle() { for (const rec of painted) paint(rec); },
    count: scatter.trees.length,
  };
}
