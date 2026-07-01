// flying.js (brick) — the FLYING-ISLAND / ARCHIPELAGO geometry: a jagged rocky
// UNDERSIDE hanging beneath each landmass (its top rim follows the real island edge)
// and a soft CLOUD SEA the islands float above. Built once and shown/hidden with the
// mode (the ocean plane is hidden while it's visible).
//
// ?mode=floating carves the continent into separate islands (see gen/islands.js) and
// passes their coastline rims here as opts.islands.rims — one skirt is hung per
// island. Without that (legacy single flying island) one skirt is sampled around the
// whole coastline.
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

// Four distinct underside profiles — same keel depth, very different silhouettes.
// 0: smooth taper (default, current behaviour)
// 1: mushroom — wide top, pinched waist, small flare before keel
// 2: spire — aggressive straight-down taper for a sharp stalactite look
// 3: overhang — outward bulge at ~40% depth then rapid taper; dramatic undercut
function _profileR(u, style) {
  if (style === 1) {
    const pinch = Math.max(0, 1 - 5 * Math.abs(u - 0.38));
    return Math.max(0.04, (1 - u) * (1 - 0.52 * pinch) * (1 + 0.18 * Math.sin(u * Math.PI * 1.1)));
  } else if (style === 2) {
    return Math.max(0.04, Math.pow(1 - u, 2.0) * (1 + 0.14 * Math.sin(u * Math.PI)));
  } else if (style === 3) {
    return Math.max(0.04, (1 - u) * (1 + 0.72 * Math.sin(u * Math.PI * 1.35)));
  }
  return Math.max(0.05, (1 - u) * (1 + 0.28 * Math.sin(u * Math.PI)));
}

// Build one island's rocky underside: rings from the coast rim (following the real
// terrain-edge height) tapering down to a keel, jagged with cheap hashed noise.
function makeSkirt(field, cx, cz, rim, depth, seed, profStyle = 0) {
  const SEG = rim.length;
  const RINGS = 15;
  const rand = seed;
  const profileR = (u) => _profileR(u, profStyle);
  const easeU = (u) => Math.pow(u, 1.3);

  // top ring follows the real terrain height at the island edge, so the skirt meets
  // cut cliffs (blob boundary through land) as well as the coast with no gap.
  const topY = [];
  for (let a = 0; a < SEG; a++) {
    const th = (a / SEG) * Math.PI * 2;
    const ex = cx + Math.cos(th) * rim[a], ez = cz + Math.sin(th) * rim[a];
    topY.push(Math.max(1.0, field.heightAt(ex, ez)));
  }

  const H = [], X = [], Z = [];
  for (let ri = 0; ri <= RINGS; ri++) {
    const u = ri / RINGS;
    const hr = [], xr = [], zr = [];
    for (let ai = 0; ai <= SEG; ai++) {
      const a = ai % SEG;
      const th = (ai / SEG) * Math.PI * 2;
      const jag = (hash2((rand + ri) | 0, a) - 0.5);
      const rr = rim[a] * profileR(u) * (1 + jag * 0.16 * u);
      const y = topY[a] * (1 - easeU(u)) + (-depth) * easeU(u) + jag * 24 * u * (1 - u);
      hr.push(y);
      xr.push(cx + Math.cos(th) * rr);
      zr.push(cz + Math.sin(th) * rr);
    }
    H.push(hr); X.push(xr); Z.push(zr);
  }

  const triCount = RINGS * SEG * 2;
  const positions = new Float32Array(triCount * 9);
  const colors = new Float32Array(triCount * 9);
  const col = new THREE.Color();
  let o = 0;
  const emit = (ax, ay, az, bx, by, bz, cx2, cy, cz2, ri, ai) => {
    const my = (ay + by + cy) / 3;
    if (my > -18) col.copy(DIRT).lerp(MOSS, hash2(ri, ai) * 0.5);
    else col.copy(ROCK).lerp(ROCK_D, Math.min(1, (-my) / 160));
    if (my < -170) col.lerp(DEEP, Math.min(1, (-my - 170) / 160));
    col.offsetHSL(0, 0, (hash2(ri * 3, ai) - 0.5) * 0.06);
    positions[o] = ax; positions[o + 1] = ay; positions[o + 2] = az;
    positions[o + 3] = bx; positions[o + 4] = by; positions[o + 5] = bz;
    positions[o + 6] = cx2; positions[o + 7] = cy; positions[o + 8] = cz2;
    for (let v = 0; v < 3; v++) { colors[o + v * 3] = col.r; colors[o + v * 3 + 1] = col.g; colors[o + v * 3 + 2] = col.b; }
    o += 9;
  };
  for (let ri = 0; ri < RINGS; ri++) {
    for (let ai = 0; ai < SEG; ai++) {
      const x00 = X[ri][ai], z00 = Z[ri][ai], y00 = H[ri][ai];
      const x10 = X[ri][ai + 1], z10 = Z[ri][ai + 1], y10 = H[ri][ai + 1];
      const x01 = X[ri + 1][ai], z01 = Z[ri + 1][ai], y01 = H[ri + 1][ai];
      const x11 = X[ri + 1][ai + 1], z11 = Z[ri + 1][ai + 1], y11 = H[ri + 1][ai + 1];
      emit(x00, y00, z00, x10, y10, z10, x01, y01, z01, ri, ai);
      emit(x10, y10, z10, x11, y11, z11, x01, y01, z01, ri, ai);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildFlying(field, half, seed, opts = {}) {
  const group = new THREE.Group();
  group.name = 'flying';
  const rand = mulberry32((seed ^ 0xf1a1) >>> 0);
  const rockMat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
  });

  // --- 1. rocky undersides ---
  const islands = opts.islands && opts.islands.rims && opts.islands.rims.length
    ? opts.islands.rims
    : null;

  if (islands) {
    // archipelago: one skirt per carved island, hugging its own edge.
    // Each island gets a seed-derived profile style for visual variety.
    let s = 0;
    for (const isl of islands) {
      const depth = 150 + (isl.R || 160) * 0.75;
      const skirtSeed = (seed ^ (0x51 * (s + 1))) >>> 0;
      const profStyle = ((seed ^ (0xf7 * (s + 3))) >>> 0) % 4;
      const geo = makeSkirt(field, isl.x, isl.z, isl.rim, depth, skirtSeed, profStyle);
      const m = new THREE.Mesh(geo, rockMat);
      m.name = 'flying-underside';
      group.add(m);
      s++;
    }
  } else {
    // legacy single flying island: sample the whole coastline as one rim
    const SEG = 84, maxR = half * 0.95, rim = [];
    for (let a = 0; a < SEG; a++) {
      const th = (a / SEG) * Math.PI * 2;
      const cx = Math.cos(th), cz = Math.sin(th);
      let r = 60;
      for (let rr = maxR; rr > 40; rr -= 10) {
        if (field.heightAt(cx * rr, cz * rr) > 1.5) { r = rr + 8; break; }
      }
      rim.push(r);
    }
    const geo = makeSkirt(field, 0, 0, rim, 260 + half * 0.35, seed >>> 0);
    const m = new THREE.Mesh(geo, rockMat);
    m.name = 'flying-underside';
    group.add(m);
  }

  // --- 2. cloud sea: soft sprites filling the sky below/between the islands ---
  const tex = makeCloudTexture();
  const bank = new THREE.Group();
  const N = islands ? 300 : 240;
  const spreadR = half * (islands ? 1.7 : 2.0);
  for (let i = 0; i < N; i++) {
    const th = rand() * Math.PI * 2;
    const rr = Math.pow(rand(), 0.5) * spreadR;
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false,
      opacity: 0.42 + rand() * 0.42, color: 0xffffff, fog: true });
    const sp = new THREE.Sprite(m);
    const w = 220 + rand() * 420;
    sp.scale.set(w, w * 0.58, 1);
    // sit well below the island bases, with a few higher wisps threading the gaps
    const low = -70 - rand() * 190;
    const wisp = -8 - rand() * 30;
    sp.position.set(Math.cos(th) * rr, rand() < 0.22 ? wisp : low, Math.sin(th) * rr);
    bank.add(sp);
  }
  group.add(bank);

  group.visible = false;             // shown only when the flying mode is active
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
