// clouds.js (brick) — a soft, hazy horizon band sitting far out at the fog line so
// the sky has a gentle cloud line where the land fades away. Overhead drifting clouds
// were removed: at portal-transition altitudes (Y=230-320) they were traversed by the
// camera, causing jarring pop-in. The horizon mist stays — it's always beyond the
// camera's range and never intersects the camera path.
import * as THREE from 'three';
import { mulberry32 } from '../gen/noise.js';

export function buildClouds(seed, worldHalf) {
  const group = new THREE.Group();
  group.name = 'clouds';
  const rand = mulberry32((seed ^ 0xc10d5eed) >>> 0);

  // ===== soft horizon band =====
  // A ring of big, soft sprite puffs far out where the land dissolves into the fog,
  // giving the horizon a hazy cloud line. Kept WELL beyond the island (not tied to its
  // small radius) and softer, so turning the camera to a coast that faces no mountains
  // doesn't wash the whole island white. Fog-aware so they melt into the sky.
  const mistTex = makeMistTexture();
  const bank = new THREE.Group();
  const RINGS = [
    { r: Math.max(1050, worldHalf * 1.25), n: 120, y: 250, sMin: 360, sMax: 520, yj: 120 },
    { r: Math.max(1320, worldHalf * 1.60), n: 90, y: 380, sMin: 420, sMax: 600, yj: 160 },
  ];
  const banks = [];
  for (const ring of RINGS) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + (rand() - 0.5) * 0.14;
      const rr = ring.r * (0.92 + rand() * 0.16);
      const sm = new THREE.SpriteMaterial({
        map: mistTex, transparent: true, depthWrite: false,
        opacity: 0.3 + rand() * 0.22, color: 0xfffdf6, fog: true,
      });
      const sp = new THREE.Sprite(sm);
      const w = ring.sMin + rand() * (ring.sMax - ring.sMin);
      sp.scale.set(w, w * 0.6, 1);
      sp.position.set(Math.cos(a) * rr, ring.y + (rand() - 0.5) * ring.yj, Math.sin(a) * rr);
      bank.add(sp);
      banks.push({ sp, a, baseY: sp.position.y });
    }
  }
  group.add(bank);

  return {
    group,
    update(t) {
      // the haze breathes & drifts almost imperceptibly
      bank.rotation.y = t * 0.004;
      for (const b of banks) b.sp.position.y = b.baseY + Math.sin(t * 0.2 + b.a * 3) * 3;
    },
  };
}

// soft cumulus puff: bright rounded tops clustered high, softer base — reads as a
// sunlit cloud bank (brighter core, longer alpha hold than the old wispy mist).
function makeMistTexture() {
  const s = 256;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  // cauliflower tops across the upper body + a couple lower fill lobes
  const lobes = [
    [0.50, 0.46, 0.40], [0.30, 0.52, 0.27], [0.70, 0.52, 0.29],
    [0.42, 0.40, 0.22], [0.60, 0.40, 0.20], [0.50, 0.62, 0.34],
  ];
  for (const [cx, cy, r] of lobes) {
    const g = ctx.createRadialGradient(cx * s, cy * s, 2, cx * s, cy * s, r * s);
    g.addColorStop(0, 'rgba(255,255,253,0.96)');
    g.addColorStop(0.55, 'rgba(252,248,238,0.55)');
    g.addColorStop(1, 'rgba(248,242,228,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx * s, cy * s, r * s, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
