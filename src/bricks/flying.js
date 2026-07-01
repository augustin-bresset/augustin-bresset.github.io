// flying.js (brick) — the FLYING-ISLAND theme's extra geometry: a jagged rocky
// UNDERSIDE hanging beneath the island (its top rim follows the real, organic
// coastline) and a soft CLOUD SEA the island floats above. Built once and simply
// shown/hidden on a theme switch (the ocean plane is hidden while it's visible).
import * as THREE from 'three';
import { mulberry32 } from '../gen/noise.js';

function hash2(i, j) {
  let h = (i * 374761393 + j * 668265263) ^ 0x9e3779b9;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const ROCK = new THREE.Color('#6b6157');
const ROCK_D = new THREE.Color('#40382f');
const DEEP = new THREE.Color('#2c261f');
const DIRT = new THREE.Color('#5c4a32');
const MOSS = new THREE.Color('#65763f');

export function buildFlying(field, half, seed) {
  const group = new THREE.Group();
  group.name = 'flying';
  const rand = mulberry32((seed ^ 0xf1a1) >>> 0);

  // --- 1. sample the outer coastline radius per angle (organic silhouette) ---
  const SEG = 84;
  const maxR = half * 0.95;
  const rim = [];
  for (let a = 0; a < SEG; a++) {
    const th = (a / SEG) * Math.PI * 2;
    const cx = Math.cos(th), cz = Math.sin(th);
    let r = 60;                       // fallback (tiny island / all sea at this angle)
    for (let rr = maxR; rr > 40; rr -= 10) {
      if (field.heightAt(cx * rr, cz * rr) > 1.5) { r = rr + 8; break; }
    }
    rim.push(r);
  }

  // --- 2. underside skirt: rings from the coast rim tapering down to a keel ---
  const RINGS = 16;
  const depth = 260 + half * 0.35;
  const profileR = (u) => Math.max(0.05, (1 - u) * (1 + 0.28 * Math.sin(u * Math.PI)));
  const dropY = (u) => 1 - depth * Math.pow(u, 1.28);

  const H = [], X = [], Z = [];
  for (let ri = 0; ri <= RINGS; ri++) {
    const u = ri / RINGS;
    const hr = [], xr = [], zr = [];
    for (let ai = 0; ai <= SEG; ai++) {
      const a = ai % SEG;
      const th = (ai / SEG) * Math.PI * 2;
      // jagged rock: wobble radius + height with cheap hashed noise
      const jag = (hash2(ri, a) - 0.5);
      const rr = rim[a] * profileR(u) * (1 + jag * 0.16 * u);
      hr.push(dropY(u) + jag * 26 * u * (1 - u));
      xr.push(Math.cos(th) * rr);
      zr.push(Math.sin(th) * rr);
    }
    H.push(hr); X.push(xr); Z.push(zr);
  }

  const triCount = RINGS * SEG * 2;
  const positions = new Float32Array(triCount * 9);
  const colors = new Float32Array(triCount * 9);
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), nrm = new THREE.Vector3();
  const col = new THREE.Color();
  let o = 0;
  const emit = (ax, ay, az, bx, by, bz, cx, cy, cz, ri, ai) => {
    ab.set(bx - ax, by - ay, bz - az); ac.set(cx - ax, cy - ay, cz - az);
    nrm.crossVectors(ab, ac).normalize();
    const my = (ay + by + cy) / 3;
    // colour by depth: mossy dirt at the rim, rock below, near-black at the keel
    if (my > -18) col.copy(DIRT).lerp(MOSS, hash2(ri, ai) * 0.5);
    else col.copy(ROCK).lerp(ROCK_D, Math.min(1, (-my) / 160));
    if (my < -170) col.lerp(DEEP, Math.min(1, (-my - 170) / 160));
    col.offsetHSL(0, 0, (hash2(ri * 3, ai) - 0.5) * 0.06);
    positions[o] = ax; positions[o + 1] = ay; positions[o + 2] = az;
    positions[o + 3] = bx; positions[o + 4] = by; positions[o + 5] = bz;
    positions[o + 6] = cx; positions[o + 7] = cy; positions[o + 8] = cz;
    for (let v = 0; v < 3; v++) { colors[o + v * 3] = col.r; colors[o + v * 3 + 1] = col.g; colors[o + v * 3 + 2] = col.b; }
    o += 9;
  };
  for (let ri = 0; ri < RINGS; ri++) {
    for (let ai = 0; ai < SEG; ai++) {
      const x00 = X[ri][ai], z00 = Z[ri][ai], y00 = H[ri][ai];
      const x10 = X[ri][ai + 1], z10 = Z[ri][ai + 1], y10 = H[ri][ai + 1];
      const x01 = X[ri + 1][ai], z01 = Z[ri + 1][ai], y01 = H[ri + 1][ai];
      const x11 = X[ri + 1][ai + 1], z11 = Z[ri + 1][ai + 1], y11 = H[ri + 1][ai + 1];
      // wind so normals face outward/down
      emit(x00, y00, z00, x10, y10, z10, x01, y01, z01, ri, ai);
      emit(x10, y10, z10, x11, y11, z11, x01, y01, z01, ri, ai);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const under = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
  }));
  under.name = 'flying-underside';
  group.add(under);

  // --- 3. cloud sea: soft sprites over a big disc just below the coastline ---
  const tex = makeCloudTexture();
  const bank = new THREE.Group();
  const N = 240;
  for (let i = 0; i < N; i++) {
    const th = rand() * Math.PI * 2;
    // start AT the coastline (so the leftover flat ocean ring is blanketed) and
    // spread outward to the horizon, sitting just below the coast.
    const base = rim[Math.floor((th / (Math.PI * 2)) * SEG) % SEG];
    const rr = base * (0.9 + Math.pow(rand(), 0.5) * 1.9);
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false,
      opacity: 0.5 + rand() * 0.4, color: 0xffffff, fog: true });
    const sp = new THREE.Sprite(m);
    const w = 200 + rand() * 380;
    sp.scale.set(w, w * 0.6, 1);
    sp.position.set(Math.cos(th) * rr, -6 - rand() * 46, Math.sin(th) * rr);
    bank.add(sp);
  }
  group.add(bank);

  group.visible = false;             // shown only when the flying theme is active
  return {
    group,
    setVisible(v) { group.visible = v; },
    update(t) { bank.rotation.y = t * 0.006; },
  };
}

function makeCloudTexture() {
  const s = 128;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const ctx = cv.getContext('2d');
  for (const [cx, cy, r] of [[0.5, 0.52, 0.46], [0.34, 0.56, 0.28], [0.66, 0.56, 0.3], [0.5, 0.42, 0.3]]) {
    const g = ctx.createRadialGradient(cx * s, cy * s, 1, cx * s, cy * s, r * s);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(250,251,253,0.5)');
    g.addColorStop(1, 'rgba(245,248,252,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx * s, cy * s, r * s, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
