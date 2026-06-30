// trees.js (brick) — instanced low-poly trees with a gentle wind sway.
// Conifers (cones) + broadleaf (faceted blobs), each on a short trunk.
// Sway is done in the vertex shader, phased per-instance, foliage-only.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

// inject wind sway into a foliage material
function addSway(mat, uniforms, strength) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float phase = instanceMatrix[3].x * 0.15 + instanceMatrix[3].z * 0.13;
          float h = max(position.y, 0.0);
          float s = sin(uTime * 1.3 + phase) * ${strength.toFixed(3)} * h;
          transformed.x += s;
          transformed.z += cos(uTime * 1.1 + phase) * ${strength.toFixed(3)} * 0.6 * h;
        #endif`);
  };
}

function fillInstances(mesh, list, yLift, baseScale) {
  let n = 0;
  for (const t of list) {
    _p.set(t.x, t.y + yLift * (t.scale || 1), t.z);
    _q.setFromAxisAngle(_up, t.rot || 0);
    _s.setScalar((t.scale || 1) * baseScale);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(n, _m);
    // subtle per-instance colour variation
    const tint = t.tint ?? 0.5;
    mesh.setColorAt(n, mesh.userData.tintColor(tint));
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function buildTrees(scatter) {
  const group = new THREE.Group();
  group.name = 'trees';
  const uniforms = { uTime: { value: 0 } };

  const conifers = scatter.trees.filter((t) => t.kind === 'conifer');
  const broads = scatter.trees.filter((t) => t.kind === 'broad');

  const cGreen = new THREE.Color('#4f7a3c');
  const bGreen = new THREE.Color('#6b9a47');
  const _c = new THREE.Color();
  const tintConifer = (x) => _c.copy(cGreen).offsetHSL(0, 0, (x - 0.5) * 0.12);
  const tintBroad = (x) => _c.copy(bGreen).offsetHSL((x - 0.5) * 0.04, 0, (x - 0.5) * 0.13);

  // white base so per-instance colour shows true (instanceColor multiplies)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 });

  // ---- conifers ----
  if (conifers.length) {
    const foliGeo = new THREE.ConeGeometry(1.5, 4.2, 6, 1);
    foliGeo.translate(0, 2.1, 0);
    const foliMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 });
    addSway(foliMat, uniforms, 0.018);
    const foli = new THREE.InstancedMesh(foliGeo, foliMat, conifers.length);
    foli.userData.tintColor = tintConifer;
    foli.castShadow = true;
    fillInstances(foli, conifers, 1.2, 1);
    group.add(foli);

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.6, 5);
    trunkGeo.translate(0, 1.3, 0);
    const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, conifers.length);
    trunk.userData.tintColor = () => new THREE.Color(0x6b4f33);
    trunk.castShadow = true;
    fillInstances(trunk, conifers, 0, 1);
    group.add(trunk);
  }

  // ---- broadleaf ----
  if (broads.length) {
    const foliGeo = new THREE.IcosahedronGeometry(1.9, 0);
    foliGeo.scale(1, 0.85, 1);
    foliGeo.translate(0, 3.0, 0);
    const foliMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 });
    addSway(foliMat, uniforms, 0.022);
    const foli = new THREE.InstancedMesh(foliGeo, foliMat, broads.length);
    foli.userData.tintColor = tintBroad;
    foli.castShadow = true;
    fillInstances(foli, broads, 1.0, 1);
    group.add(foli);

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.4, 5);
    trunkGeo.translate(0, 1.2, 0);
    const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, broads.length);
    trunk.userData.tintColor = () => new THREE.Color(0x6b4f33);
    trunk.castShadow = true;
    fillInstances(trunk, broads, 0, 1);
    group.add(trunk);
  }

  return {
    group,
    update(t) { uniforms.uTime.value = t; },
    count: scatter.trees.length,
  };
}
