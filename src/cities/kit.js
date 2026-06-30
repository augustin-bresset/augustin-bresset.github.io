// kit.js — shared building blocks for the project "cities".
// Small helpers so each city module stays focused on its own identity.
import * as THREE from 'three';

export function box(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color, flatShading: true,
    roughness: opts.roughness ?? 0.85, metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  if (opts.pos) m.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  return m;
}

export function cyl(rt, rb, h, color, seg = 12, opts = {}) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, seg);
  const mat = new THREE.MeshStandardMaterial({
    color, flatShading: opts.flat ?? true,
    roughness: opts.roughness ?? 0.85, metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  if (opts.pos) m.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  return m;
}

// a circular stone/earth platform the settlement sits on
export function platform(radius, color, h = 1.4) {
  const g = new THREE.CylinderGeometry(radius, radius + 1.5, h, 26);
  const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 });
  const m = new THREE.Mesh(g, mat);
  m.position.y = -h * 0.4;
  m.receiveShadow = true;
  m.castShadow = false;
  return m;
}

// emissive glowing panel (no real light cost)
export function glow(w, h, color, intensity = 1.4) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity,
    side: THREE.DoubleSide, flatShading: true,
  });
  return new THREE.Mesh(geo, mat);
}

// thin emissive strip (heating element / edge light)
export function strip(len, color, thickness = 0.25, intensity = 2) {
  return box(len, thickness, thickness, color, {
    emissive: color, emissiveIntensity: intensity, cast: false, receive: false,
  });
}

// glowing wireframe box — the "hologram" look for annotation bounding boxes.
// Lines are unlit (LineBasicMaterial), so they read as constant neon in the dark.
export function wireBox(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const edges = new THREE.EdgesGeometry(geo);
  const mat = new THREE.LineBasicMaterial({
    color, transparent: true, opacity: opts.opacity ?? 0.95,
    depthWrite: false,
  });
  const seg = new THREE.LineSegments(edges, mat);
  if (opts.pos) seg.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  // faint translucent fill so the box has volume, not just an outline
  if (opts.fill !== false) {
    const fill = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: opts.fillOpacity ?? 0.08, depthWrite: false,
    }));
    seg.add(fill);
  }
  return seg;
}

// a swarm of tiny glowing cubes — a stand-in "3D point cloud" (Toaster/Splasher).
// clusters: [{cx,cz,color,n,spread,y}] each a labelled object.
export function pointCloud(clusters, { size = 0.16 } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(size, size, size);
  const r = rng(91);
  for (const c of clusters) {
    const mat = new THREE.MeshBasicMaterial({ color: c.color });
    const n = c.n ?? 40, spread = c.spread ?? 1.4, baseY = c.y ?? 0.6;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      // gaussian-ish blob
      const a = r() * Math.PI * 2, rr = Math.pow(r(), 0.6) * spread;
      m.position.set(c.cx + Math.cos(a) * rr, baseY + (r() - 0.2) * spread * 0.6,
        c.cz + Math.sin(a) * rr);
      g.add(m);
    }
  }
  return g;
}

// The PORTAL: a holographic mini-diorama of the whole world on a pedestal. Clicking
// it flies the camera back to the overview map. Every mesh is tagged portal:true so
// navigation can pick it. Returns { group, update } — fold update into the city's.
export function makePortal(accent = '#e9dcc0') {
  const g = new THREE.Group();
  const ac = new THREE.Color(accent);

  // pedestal
  g.add(cyl(2.4, 3.0, 3, 0x26262c, 16, { pos: [0, 1.5, 0], roughness: 0.7, metalness: 0.35 }));
  // glowing base disc (the "sea")
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(4.3, 4.3, 0.5, 36),
    new THREE.MeshStandardMaterial({ color: 0x0e151b, emissive: 0x12303a, emissiveIntensity: 0.5, roughness: 0.35 }));
  disc.position.y = 3.2; disc.receiveShadow = true; g.add(disc);

  // mini continent: a cluster of little flat-shaded bumps
  const land = new THREE.Group(); land.position.y = 3.45; g.add(land);
  const bumpMat = new THREE.MeshStandardMaterial({ color: 0x93a072, flatShading: true, roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8c8678, flatShading: true, roughness: 1 });
  const r = rng(7771);
  for (let i = 0; i < 18; i++) {
    const a = r() * 6.28, rr = Math.pow(r(), 0.7) * 3.1;
    const h = 0.35 + r() * 1.6;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.55 + r() * 0.8, h, 6),
      h > 1.3 ? rockMat : bumpMat);
    c.position.set(Math.cos(a) * rr, h / 2, Math.sin(a) * rr);
    c.rotation.y = r() * 6.28; c.castShadow = false;
    land.add(c);
  }
  // tiny glowing city pins (echo the four project colours)
  for (const [mx, mz, col] of [[1.6, 0.4, 0xe10600], [-1.1, 1.3, 0x00b8d9],
    [0.6, -1.7, 0xdda42a], [-1.7, -0.7, 0xc4763a]]) {
    const pin = box(0.16, 0.9, 0.16, col,
      { pos: [mx, 0.5, mz], emissive: col, emissiveIntensity: 2.4, cast: false, receive: false });
    land.add(pin);
  }

  // rotating halo ring + a vertical holographic scan ring
  const ringMat = new THREE.MeshStandardMaterial({ color: ac, emissive: ac, emissiveIntensity: 1.8 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.07, 6, 44), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 3.55; g.add(ring);

  // a small floating "return / map" glyph sprite above it
  const glyph = makeGlyphSprite(accent);
  glyph.position.set(0, 8.4, 0); g.add(glyph);

  g.traverse((o) => { if (o.isMesh || o.isSprite) o.userData.portal = true; });
  g.userData.portal = true;

  return {
    group: g,
    update(t) {
      land.rotation.y = t * 0.25;
      ring.rotation.z = t * 0.5;
      glyph.position.y = 8.4 + Math.sin(t * 1.6) * 0.25;
    },
  };
}

// POI MARKER — a small floating "survey marker" that hovers over a landmark to
// say "there's something to read here". An emissive gem on a downward pin-tip with
// a faint ground ring, color-matched to the note it opens. Reads on both the dark
// cyberpunk districts and the light wind-city. The whole group is the pick anchor
// (its world position drives where the field-note slip is pinned on screen).
// Returns { group, anchor, setState, update }. Fold update into the city's loop.
export function poiBeacon(accent = '#e9dcc0') {
  const g = new THREE.Group();
  const ac = new THREE.Color(accent);

  // the bobbing part (gem + pin tip), kept on an inner node so the group origin
  // stays a steady screen anchor for the card.
  const float = new THREE.Group(); g.add(float);
  const gemMat = new THREE.MeshStandardMaterial({
    color: ac, emissive: ac, emissiveIntensity: 1.8, flatShading: true,
    roughness: 0.25, metalness: 0.1,
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), gemMat);
  gem.castShadow = false; float.add(gem);
  // downward pin tip so it reads as "pointing here"
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 6), gemMat);
  tip.position.y = -1.15; tip.rotation.x = Math.PI; tip.castShadow = false; float.add(tip);

  // faint ground ring at the landmark
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.07, 6, 30),
    new THREE.MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.45, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; g.add(ring);
  // a soft halo billboard so the marker is legible against busy scenery
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture(accent), transparent: true, depthWrite: false, opacity: 0.6,
  }));
  halo.scale.set(4.4, 4.4, 1); float.add(halo);

  let state = 'idle';
  return {
    group: g, anchor: g,
    setState(s) { state = s; },
    update(t) {
      const hov = state !== 'idle';
      const sc = state === 'open' ? 1.45 : state === 'hover' ? 1.3 : 1;
      float.position.y = Math.sin(t * 1.6) * 0.28 + (hov ? 0.4 : 0);
      float.scale.setScalar(sc);
      gem.rotation.y = t * 0.9;
      gemMat.emissiveIntensity = (hov ? 2.8 : 1.7) + Math.sin(t * 3) * 0.4;
      ring.material.opacity = (hov ? 0.85 : 0.4) + Math.sin(t * 2) * 0.08;
      const rs = sc * (1 + (hov ? Math.sin(t * 2.4) * 0.06 : 0));
      ring.scale.setScalar(rs);
      halo.material.opacity = hov ? 0.85 : 0.5;
    },
  };
}

// radial-gradient halo sprite behind a marker gem (so it pops on any background)
function haloTexture(accent) {
  const s = 128;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  const c = new THREE.Color(accent);
  const rgb = `${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0}`;
  grd.addColorStop(0, `rgba(${rgb},0.85)`);
  grd.addColorStop(0.35, `rgba(${rgb},0.32)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// language-neutral round-arrow-over-globe icon used by the portal
function makeGlyphSprite(accent) {
  const s = 128;
  const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  // soft disc backing
  ctx.fillStyle = 'rgba(20,24,30,0.78)';
  ctx.beginPath(); ctx.arc(s / 2, s / 2, 56, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 6; ctx.lineCap = 'round';
  // circular return arrow
  ctx.beginPath(); ctx.arc(s / 2, s / 2, 30, Math.PI * 0.35, Math.PI * 1.9); ctx.stroke();
  const ex = s / 2 + 30 * Math.cos(Math.PI * 0.35), ey = s / 2 + 30 * Math.sin(Math.PI * 0.35);
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 12, ey - 6); ctx.moveTo(ex, ey); ctx.lineTo(ex + 2, ey - 14); ctx.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sp = new THREE.Sprite(mat); sp.scale.set(5.5, 5.5, 1); sp.renderOrder = 19;
  return sp;
}

// Floating label sprite (faces camera). Returns { sprite, setText }.
export function makeLabel(text, sub, accent = '#2c1a0e') {
  const cw = 512, ch = 160;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  function draw(t, s) {
    ctx.clearRect(0, 0, cw, ch);
    // soft parchment plaque
    ctx.fillStyle = 'rgba(237,228,210,0.92)';
    roundRect(ctx, 12, 36, cw - 24, ch - 60, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(44,26,14,0.55)'; ctx.lineWidth = 3;
    roundRect(ctx, 12, 36, cw - 24, ch - 60, 16); ctx.stroke();
    // accent pin
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(cw / 2, 26, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cw / 2 - 1.5, 26, 3, 16);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2c1a0e';
    ctx.font = '700 54px Caveat, cursive';
    ctx.fillText(t, cw / 2, 96);
    if (s) {
      ctx.fillStyle = 'rgba(44,26,14,0.6)';
      ctx.font = 'italic 26px "EB Garamond", serif';
      ctx.fillText(s, cw / 2, 132);
    }
    tex.needsUpdate = true;
  }
  draw(text, sub);

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(26, 8.1, 1);
  sprite.renderOrder = 20;
  sprite.userData.isLabel = true;
  return { sprite, setText: (t, s) => draw(t, s) };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// mark every mesh in a subtree as belonging to a city (for raycast picking)
export function tagPickable(root, cityId) {
  root.traverse((o) => { if (o.isMesh || o.isSprite) o.userData.cityId = cityId; });
}

// mark a whole landmark (a building, the cliff, a beacon) as a Point Of Interest.
// navigation walks ancestors looking for userData.poi, so tagging the root group is
// enough — but we set it on every child too, so a click anywhere on the structure
// (or its floating marker) opens that landmark's field note.
export function tagPOI(root, poiId) {
  root.userData.poi = poiId;
  root.traverse((o) => { o.userData.poi = poiId; });
}

// Deterministic small PRNG so a city's sprawl is stable across frames.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A sprawl of small district buildings filling an annulus around the hero
// structures, so a project reads as a GIANT city, not a few buildings.
// colors: array of building hexes; lit: optional {color, p} for glowing windows.
export function sprawl({ rInner = 16, rOuter = 44, count = 70, colors, seed = 1, lit = null, maxH = 12 }) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const inst = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = rInner + Math.sqrt(rand()) * (rOuter - rInner);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 2.4 + rand() * 4.5, d = 2.4 + rand() * 4.5;
    const h = 3 + rand() * maxH;
    const col = colors[(rand() * colors.length) | 0];
    const b = box(w, h, d, col, { pos: [x, h / 2, z], roughness: 0.9 });
    b.rotation.y = rand() * Math.PI * 2;
    g.add(b);
    // occasional glowing window strip
    if (lit && rand() < lit.p) {
      const win = box(Math.min(w, d) * 0.6, h * 0.5, 0.2, lit.color,
        { pos: [x, h * 0.55, z + d / 2 + 0.05], emissive: lit.color, emissiveIntensity: 1.4, cast: false });
      win.rotation.y = b.rotation.y;
      g.add(win);
      inst.push(win);
    }
  }
  g.userData.windows = inst;
  return g;
}
