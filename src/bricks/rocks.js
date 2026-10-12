// rocks.js (brick) — instanced low-poly boulders scattered on rocky ground, and the
// sea stacks standing off the rocky shores.
import * as THREE from 'three';
import { underWeather } from './weather.js';

const _m  = new THREE.Matrix4();
const _q  = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _p  = new THREE.Vector3();
const _s  = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _tn = new THREE.Vector3();

export function buildRocks(scatter) {
  const group = new THREE.Group();
  group.name = 'rocks';
  const list = scatter.rocks;
  if (!list.length) return { group, update() {}, count: 0 };
  const stacks = scatter.stacks || [];

  // a chunky faceted boulder
  const geo = new THREE.DodecahedronGeometry(1, 0);
  geo.scale(1, 0.7, 1.05);
  const mat = underWeather(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }));

  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const base = new THREE.Color('#8a8170'), snowed = new THREE.Color('#dfe4e2');
  const _c = new THREE.Color();
  let n = 0;
  for (const r of list) {
    _p.set(r.x, r.y + r.scale * 0.32, r.z);

    // Align the rock to the terrain normal so it rests naturally on the slope
    // (gravity). nx/nz is the height gradient dh/dx, dh/dz at the rock position;
    // the terrain normal is (-nx, 1, -nz) normalised. We then spin the rock
    // around that normal by a random angle so no two look identical.
    const nx = r.nx || 0, nz = r.nz || 0;
    const invLen = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
    _tn.set(-nx * invLen, invLen, -nz * invLen);
    _q.setFromUnitVectors(_up, _tn);            // tilt to match slope
    _q2.setFromAxisAngle(_tn, r.rot);           // random spin around terrain normal
    _q.premultiply(_q2);

    _s.setScalar(r.scale * 1.3);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(n, _m);
    _c.copy(r.snow ? snowed : base).offsetHSL(0, (r.tint - 0.5) * 0.05, (r.tint - 0.5) * (r.snow ? 0.06 : 0.18));
    mesh.setColorAt(n, _c);
    n++;
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.raycast = () => {};
  group.add(mesh);

  // SEA STACKS: tall pillars standing in the shallows, their feet in the water
  if (stacks.length) {
    const pillar = new THREE.DodecahedronGeometry(1, 0);
    pillar.scale(1, 1, 0.92);
    const sea = new THREE.InstancedMesh(pillar, mat, stacks.length);
    const dark = new THREE.Color('#77705f');
    stacks.forEach((r, i) => {
      const h = r.scale * r.tall;
      _p.set(r.x, r.y + h * 0.45, r.z);
      _q.setFromAxisAngle(_up, r.rot);
      _s.set(r.scale, h, r.scale);
      _m.compose(_p, _q, _s);
      sea.setMatrixAt(i, _m);
      sea.setColorAt(i, _c.copy(dark).offsetHSL(0, 0, (r.tint - 0.5) * 0.12));
    });
    sea.castShadow = true; sea.receiveShadow = true;
    sea.raycast = () => {};
    group.add(sea);
  }

  return { group, update() {}, count: n };
}
