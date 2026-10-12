// rivers.js (brick) — the rivers' water: one ribbon per river, laid in the channel
// hydrology.js cut for it, plus a dark water thread at the bottom of the ravine.
import * as THREE from 'three';
import { smoothPath } from '../gen/hydrology.js';

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

// A RIVER: a ribbon laid at the water level its channel was cut for (hydrology.js),
// along the same smoothed curve, as wide as the channel's bed. Paler along the banks
// where it shallows, streaked by the current, fading in at the spring and out where
// it meets the sea.
function buildRiver(rawPoints, field) {
  const pts = smoothPath(rawPoints, 2);
  const n = pts.length;
  if (n < 4) return null;
  const pos = [], uvs = [], ends = [], drops = [], indices = [];
  let run = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    if (i) run += Math.hypot(p.x - a.x, p.z - a.z);
    let tx = b.x - a.x, tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    // the level it was cut at — but never above the ground as it is NOW (a city's
    // shelf may have reshaped it since): there the river slips under, it never floats
    const y = Math.min(p.y, field.heightAt(p.x, p.z) + 1.3);
    const w = p.w * 0.94 * Math.min(1, 0.28 + i / 22);       // a stream at its source, widening as it goes
    pos.push(p.x - tz * w, y, p.z + tx * w, p.x + tz * w, y, p.z - tx * w);
    uvs.push(0, run / 11, 1, run / 11);
    const end = Math.min(1, i / 6, (n - 1 - i) / 8);
    ends.push(end, end);
    // how steeply it falls here: past a gentle grade the water breaks white
    const fall = Math.abs(b.y - a.y) / (Math.hypot(b.x - a.x, b.z - a.z) || 1);
    const drop = Math.min(1, Math.max(0, (fall - 0.24) * 3.0));
    drops.push(drop, drop);
    if (i < n - 1) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
  geo.setAttribute('aDrop', new THREE.Float32BufferAttribute(drops, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a8fb5, roughness: 0.3, metalness: 0.0, transparent: true, opacity: 0.95,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aEnd;\nattribute float aDrop;\nvarying vec2 vRiver;\nvarying float vEnd;\nvarying float vDrop;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vRiver = uv; vEnd = aEnd; vDrop = aDrop;\n transformed.y += sin(uv.y * 5.0 - uTime * 3.0) * 0.05;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vRiver;\nvarying float vEnd;\nvarying float vDrop;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float edge = abs(vRiver.x - 0.5) * 2.0;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.64, 0.85, 0.86), smoothstep(0.45, 1.0, edge) * 0.6);
        diffuseColor.rgb += 0.06 * sin(vRiver.y * 7.0 - uTime * 2.6 + sin(vRiver.x * 7.0) * 1.6);
        // rapids and falls: streaks of foam racing down the steep reaches
        float foam = vDrop * (0.5 + 0.5 * sin(vRiver.y * 31.0 - uTime * 13.0 + sin(vRiver.x * 11.0) * 2.4));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.98, 0.98), clamp(foam * 1.1 + vDrop * 0.25, 0.0, 0.92));
        diffuseColor.a *= vEnd * (1.0 - smoothstep(0.8, 1.0, edge) * 0.45);`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return { mesh, uniforms };
}

export function buildRivers(hydro, field) {
  const group = new THREE.Group();
  group.name = 'rivers';
  const flows = [];

  for (const poly of hydro.rivers) {
    const r = buildRiver(poly, field);
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
