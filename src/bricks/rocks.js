// rocks.js (brick) — instanced low-poly boulders scattered on rocky ground.
import * as THREE from 'three';

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

  // a chunky faceted boulder
  const geo = new THREE.DodecahedronGeometry(1, 0);
  geo.scale(1, 0.7, 1.05);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 });

  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const base = new THREE.Color('#8a8170');
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
    _c.copy(base).offsetHSL(0, (r.tint - 0.5) * 0.05, (r.tint - 0.5) * 0.18);
    mesh.setColorAt(n, _c);
    n++;
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);

  return { group, update() {}, count: n };
}
