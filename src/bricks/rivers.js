// rivers.js (brick) — builds animated water ribbons along river polylines, plus
// a dark water thread at the bottom of the ravine. Ribbons follow the carved
// terrain so the water sits in its valley.
import * as THREE from 'three';

// Chaikin-style smoothing so ribbons flow instead of stair-stepping.
function smooth(points, iters = 2) {
  let pts = points;
  for (let it = 0; it < iters; it++) {
    if (pts.length < 3) break;
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push({
        x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25, acc: a.acc,
        i: a.i, j: a.j,
      });
      out.push({
        x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75, acc: b.acc,
        i: b.i, j: b.j,
      });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function buildRibbon(rawPoints, field, opts) {
  const { color = 0x4a86a6, yOffset = 0.3, minW = 1.2, wScale = 1, flow = true } = opts || {};
  const points = smooth(rawPoints, 2);
  if (points.length < 2) return null;

  const pos = [];
  const uvs = [];
  const tmpT = new THREE.Vector2();
  const N = points.length;

  for (let i = 0; i < N; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(N - 1, i + 1)];
    tmpT.set(b.x - a.x, b.z - a.z);
    if (tmpT.lengthSq() < 1e-6) tmpT.set(1, 0);
    tmpT.normalize();
    // perpendicular in XZ
    const px = -tmpT.y, pz = tmpT.x;
    const w = (Math.max(minW, 1.0 + Math.sqrt(p.acc || 1) / 16)) * wScale;
    const y = field.heightAt(p.x, p.z) + yOffset;
    pos.push(
      p.x + px * w, y, p.z + pz * w,
      p.x - px * w, y, p.z - pz * w
    );
    const v = i / (N - 1);
    uvs.push(0, v, 1, v);
  }

  const indices = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    // CCW from above
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.3, metalness: 0.0,
    transparent: true, opacity: 0.92,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  const uniforms = { uTime: { value: 0 } };
  if (flow) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vV;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vV = uv.y;\n transformed.y += sin(uv.y*40.0 - uTime*3.0)*0.12;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vV;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb += 0.10*sin(vV*60.0 - uTime*3.0);');
    };
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return { mesh, uniforms };
}

export function buildRivers(hydro, field) {
  const group = new THREE.Group();
  group.name = 'rivers';
  const flows = [];

  // wide enough to read as flowing lines across the ~1000u continent
  for (const poly of hydro.rivers) {
    const r = buildRibbon(poly, field, { color: 0x4f8db0, yOffset: 0.35, minW: 2.4, wScale: 1.9 });
    if (r) { group.add(r.mesh); flows.push(r.uniforms); }
  }

  // ravine water thread (dark, narrow, deep)
  if (hydro.ravine) {
    const pts = hydro.ravine.map((p) => ({ x: p.x, z: p.z, acc: 2 }));
    const r = buildRibbon(pts, field, { color: 0x1e3a4a, yOffset: 0.2, minW: 1.6, wScale: 1.6, flow: false });
    if (r) group.add(r.mesh);
  }

  return {
    group,
    update(t) { for (const u of flows) u.uTime.value = t; },
  };
}
