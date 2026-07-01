// bridges.js — wooden rope bridges between close floating islands in archipelago mode.
// For each pair of islands whose closest rim points are within MAX_GAP world units,
// a plank-and-rope bridge is strung between them following a parabolic sag (catenary
// approximation). Geometry is flat-shaded vertex-colored, matching the rest of the world.
import * as THREE from 'three';

const MAX_GAP    = 130;   // world units; skip pairs further apart than this
const PLANK_W    = 3.0;   // plank width across the bridge
const PLANK_D    = 0.55;  // plank footprint depth along the bridge
const PLANK_T    = 0.22;  // plank thickness (height)
const PLANK_STEP = 0.94;  // spacing centre-to-centre along bridge (PLANK_D + gap)
const ROPE_H     = 1.55;  // rope rail height above plank deck
const ROPE_RW    = 0.13;  // rope ribbon half-width (in perp direction)
const SAG_K      = 0.13;  // sag = gap_dist * SAG_K (parabolic droop at midpoint)

const _WL = new THREE.Color('#a87042');   // light wood
const _WD = new THREE.Color('#6b4220');   // dark wood
const _RC = new THREE.Color('#39302a');   // rope/chain
const _PC = new THREE.Color('#7a5230');   // post

function hash2(i, j) {
  let h = (i * 374761393 + j * 668265263) ^ 0x9e3779b9;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Sample all rim points for an island (world XZ only; Y resolved later via field).
function rimPoints(isl) {
  const { x, z, rim } = isl;
  return rim.map((r, s) => {
    const th = (s / rim.length) * Math.PI * 2;
    return { x: x + Math.cos(th) * r, z: z + Math.sin(th) * r };
  });
}

// Find the closest pair of points between two rim arrays.
function closestPair(pA, pB) {
  let dMin = Infinity, a = null, b = null;
  for (const pa of pA) {
    for (const pb of pB) {
      const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
      if (d < dMin) { dMin = d; a = pa; b = pb; }
    }
  }
  return { a, b, dist: dMin };
}

// Build one bridge mesh between rim point pa and pb.
function makeBridgeMesh(field, pa, pb, seed) {
  const ax = pa.x, az = pa.z;
  const bx = pb.x, bz = pb.z;

  // Anchor heights: 1.2 units above the actual terrain at each rim point (so the
  // bridge starts just above the island edge, not clipping through the cliff).
  const ay = Math.max(field.heightAt(ax, az) + 1.2, 3.5);
  const by = Math.max(field.heightAt(bx, bz) + 1.2, 3.5);

  const dist = Math.hypot(bx - ax, bz - az);
  const sag  = dist * SAG_K;

  // Bridge direction unit vector (XZ) and perpendicular.
  const dX = (bx - ax) / dist, dZ = (bz - az) / dist;
  const pX = -dZ, pZ = dX;
  const hW = PLANK_W * 0.5;

  // Parabolic sag: position along bridge at normalised param u ∈ [0,1].
  const curve = (u) => ({
    x: ax + (bx - ax) * u,
    y: ay + (by - ay) * u - 4 * sag * u * (1 - u),
    z: az + (bz - az) * u,
  });

  const N      = Math.max(5, Math.floor(dist / PLANK_STEP));
  const nPosts = Math.floor(N / 4) + 2;

  // Generous over-allocation; we slice to actual byte count at the end.
  const maxTris = (N + 30) * 16;
  const positions = new Float32Array(maxTris * 9);
  const colors    = new Float32Array(maxTris * 9);
  let o = 0;

  const _c = new THREE.Color();

  const tri = (ax, ay, az, bx, by, bz, cx, cy, cz, c) => {
    positions[o]   = ax; positions[o+1] = ay; positions[o+2] = az;
    positions[o+3] = bx; positions[o+4] = by; positions[o+5] = bz;
    positions[o+6] = cx; positions[o+7] = cy; positions[o+8] = cz;
    colors[o]   = c.r; colors[o+1]   = c.g; colors[o+2]   = c.b;
    colors[o+3] = c.r; colors[o+4]   = c.g; colors[o+5]   = c.b;
    colors[o+6] = c.r; colors[o+7]   = c.g; colors[o+8]   = c.b;
    o += 9;
  };

  // Quad as two clockwise triangles: p0-p1-p2 and p1-p3-p2.
  const quad = (p0, p1, p2, p3, c) => {
    tri(p0.x, p0.y, p0.z,  p1.x, p1.y, p1.z,  p2.x, p2.y, p2.z, c);
    tri(p1.x, p1.y, p1.z,  p3.x, p3.y, p3.z,  p2.x, p2.y, p2.z, c);
  };

  // ── planks ──────────────────────────────────────────────────────────────────
  for (let k = 0; k < N; k++) {
    const u0 = (k * PLANK_STEP) / dist;
    const u1 = (k * PLANK_STEP + PLANK_D) / dist;
    if (u1 > 1.0) break;

    const p0 = curve(u0), p1 = curve(u1);

    // Slight per-plank colour variation for flat-shaded woodgrain look.
    const jit = (hash2(k, seed | 0) - 0.5) * 0.12;
    const topC = _c.copy(_WL).lerp(_WD, 0.28 + jit);

    // Top face corners (plank surface + thickness).
    const tl  = { x: p0.x + pX * hW, y: p0.y + PLANK_T, z: p0.z + pZ * hW };
    const tr  = { x: p0.x - pX * hW, y: p0.y + PLANK_T, z: p0.z - pZ * hW };
    const bl  = { x: p1.x + pX * hW, y: p1.y + PLANK_T, z: p1.z + pZ * hW };
    const br  = { x: p1.x - pX * hW, y: p1.y + PLANK_T, z: p1.z - pZ * hW };
    quad(tl, tr, bl, br, topC);

    // Underside (darker; visible when bridge is seen from below).
    const botC = _c.copy(_WD).offsetHSL(0, 0, -0.06);
    const tl_b = { x: tl.x, y: p0.y, z: tl.z };
    const tr_b = { x: tr.x, y: p0.y, z: tr.z };
    const bl_b = { x: bl.x, y: p1.y, z: bl.z };
    const br_b = { x: br.x, y: p1.y, z: br.z };
    quad(tr_b, tl_b, br_b, bl_b, botC);
  }

  // ── rope rail strands (left + right) ────────────────────────────────────────
  for (const side of [-1, 1]) {
    // Lateral offset from bridge centreline to rope anchor.
    const sX = pX * (hW + 0.20) * side;
    const sZ = pZ * (hW + 0.20) * side;

    for (let k = 0; k < N; k++) {
      const u0 = k / N, u1 = (k + 1) / N;
      const r0 = curve(u0), r1 = curve(u1);
      const ry0 = r0.y + PLANK_T + ROPE_H;
      const ry1 = r1.y + PLANK_T + ROPE_H;

      // Rope as a perpendicular-facing ribbon (visible from the typical 3/4 camera).
      const a = { x: r0.x + sX + pX * ROPE_RW, y: ry0, z: r0.z + sZ + pZ * ROPE_RW };
      const b = { x: r0.x + sX - pX * ROPE_RW, y: ry0, z: r0.z + sZ - pZ * ROPE_RW };
      const c = { x: r1.x + sX + pX * ROPE_RW, y: ry1, z: r1.z + sZ + pZ * ROPE_RW };
      const d = { x: r1.x + sX - pX * ROPE_RW, y: ry1, z: r1.z + sZ - pZ * ROPE_RW };
      quad(a, b, c, d, _RC);
    }
  }

  // ── vertical posts (at regular intervals, one per side) ─────────────────────
  const postStep = Math.max(1, Math.floor(N / (nPosts - 1)));
  const PW = 0.11;  // post half-width

  for (let p = 0; p * postStep <= N; p++) {
    const u = Math.min(1, (p * postStep * PLANK_STEP) / dist);
    const pc = curve(u);
    const yBase = pc.y;
    const yTop  = pc.y + PLANK_T + ROPE_H;

    for (const side of [-1, 1]) {
      const sx = pX * hW * side;
      const sz = pZ * hW * side;

      // Face along the bridge direction (visible when orbiting the bridge from the side).
      const f0 = { x: pc.x + sx - dX * PW, y: yBase, z: pc.z + sz - dZ * PW };
      const f1 = { x: pc.x + sx + dX * PW, y: yBase, z: pc.z + sz + dZ * PW };
      const f2 = { x: pc.x + sx - dX * PW, y: yTop,  z: pc.z + sz - dZ * PW };
      const f3 = { x: pc.x + sx + dX * PW, y: yTop,  z: pc.z + sz + dZ * PW };
      quad(f0, f1, f2, f3, _PC);

      // Face perpendicular to bridge direction (visible when looking down the bridge).
      const g0 = { x: pc.x + sx - pX * PW, y: yBase, z: pc.z + sz - pZ * PW };
      const g1 = { x: pc.x + sx + pX * PW, y: yBase, z: pc.z + sz + pZ * PW };
      const g2 = { x: pc.x + sx - pX * PW, y: yTop,  z: pc.z + sz - pZ * PW };
      const g3 = { x: pc.x + sx + pX * PW, y: yTop,  z: pc.z + sz + pZ * PW };
      quad(g0, g1, g2, g3, _PC);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, o), 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors.slice(0, o), 3));
  geo.computeVertexNormals();
  return geo;
}

// Build all bridges for an archipelago world. Called from world.js alongside buildFlying.
export function buildBridges(field, islands, seed) {
  const group = new THREE.Group();
  group.name = 'bridges';
  if (!islands || !islands.rims || islands.rims.length < 2) return group;

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0,
    side: THREE.DoubleSide,   // bridges are seen from above AND below
  });

  const rims     = islands.rims;
  const allPts   = rims.map(rimPoints);

  for (let i = 0; i < rims.length; i++) {
    for (let j = i + 1; j < rims.length; j++) {
      const { a, b, dist } = closestPair(allPts[i], allPts[j]);
      if (dist > MAX_GAP || dist < 20) continue;  // too far or islands already merged

      const bSeed = (seed ^ (i * 0x4f1b + j * 0x9e37)) >>> 0;
      const geo   = makeBridgeMesh(field, a, b, bSeed);
      const mesh  = new THREE.Mesh(geo, mat);
      mesh.name = 'bridge';
      group.add(mesh);
    }
  }

  return group;
}
