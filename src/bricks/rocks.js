// rocks.js (brick) — instanced low-poly boulders scattered on rocky ground.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

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
    _p.set(r.x, r.y + r.scale * 0.35, r.z);
    _e.set((r.tint - 0.5) * 0.5, r.rot, (r.tint - 0.5) * 0.4);
    _q.setFromEuler(_e);
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
