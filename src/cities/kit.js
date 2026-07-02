// kit.js — shared building blocks for the project "cities".
// Small helpers so each city module stays focused on its own identity.
import * as THREE from 'three';
import { ACTIVE } from '../themes.js';
import { portalRender } from '../portalRender.js';

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

// The PORTAL: a window into non-Euclidean space, mounted on a pedestal. The surface
// is a live bird's-eye render of the whole world — you look down through the disc and
// see the same world from the sky above (Klein-bottle topology: falling through the
// portal brings you back to where you came from). Clicking returns to the overview.
// Every mesh is tagged portal:true so navigation can pick it.
// Returns { group, update } — fold update into the city's.
export function makePortal(accent = '#e9dcc0') {
  const g = new THREE.Group();
  const ac = new THREE.Color(accent);

  // pedestal — dark metal column
  g.add(cyl(2.4, 3.0, 3, 0x26262c, 16, { pos: [0, 1.5, 0], roughness: 0.7, metalness: 0.35 }));

  // Portal surface: a flat disc showing the live top-down world render.
  // Wrapped in a group so spinning the view is a clean Y-axis rotation on the group,
  // independent of the disc's own X-tilt that makes it face up.
  const discGroup = new THREE.Group();
  discGroup.position.y = 3.35;
  const portalDisc = new THREE.Mesh(
    new THREE.CircleGeometry(4.0, 72),
    makePortalWindowMaterial()
  );
  portalDisc.rotation.x = -Math.PI / 2;  // flat, facing up
  portalDisc.castShadow = false;
  portalDisc.receiveShadow = false;
  portalDisc.userData.isPortalDisc = true;
  portalRender.registerDisc(portalDisc);   // hidden during the virtual-camera RT pass
  discGroup.add(portalDisc);
  g.add(discGroup);

  // thin accent rim at the edge of the portal window (additive glow)
  const rimMat = new THREE.MeshBasicMaterial({
    color: ac, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.05, 0.11, 6, 52), rimMat);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 3.37;
  g.add(rim);

  // outer halo ring (accent colour, animated spin)
  const ringMat = new THREE.MeshStandardMaterial({ color: ac, emissive: ac, emissiveIntensity: 1.8 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.07, 6, 44), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 3.55; g.add(ring);


  g.traverse((o) => { if (o.isMesh || o.isSprite) o.userData.portal = true; });
  g.userData.portal = true;
  // Face normal of the portal disc, in world space. Currently (0,1,0) — horizontal disc
  // facing up. When portals gain tilt/orientation in the future, update this so that
  // navigation always approaches perpendicularly to the actual portal face.
  g.userData.portalNormal = new THREE.Vector3(0, 1, 0);
  // World-space centre of the portal disc face (y = pedestal + disc height).
  // Stored here so navigation can target it directly without raycasting twice.
  // Recomputed after the group is positioned in world.js / city builders.
  g.userData.portalCenter = new THREE.Vector3(0, 3.35, 0); // local, caller adds worldPos

  return {
    group: g,
    update(t) {
      // Disc no longer spins: it's a true window (screen-space sampled), so rotating
      // the mesh wouldn't rotate the content. Only the decorative halo ring spins.
      ring.rotation.z = t * 0.5;
    },
  };
}

// WALL PORTAL — the same non-Euclidean window, but RECTANGULAR and mounted flush
// against a building façade (a doorway to elsewhere, Portal-style). Give it the
// wall's outward direction: navigation reads userData.portalNormal and approaches
// perpendicular to the face, so the dive flies straight AT the wall and through.
// Parent it to the building group so the normal follows the building's rotation.
// SIZE FLOOR: the dive ends at orbit radius ~3.6 with the camera near plane at 3,
// so the pane must cover the whole frame from there — at fov 42°/16:9 that means
// w ≥ ~5.0 and h ≥ ~2.8. Default is a wide barn-door. Returns { group, update }.
export function makeWallPortal(accent = '#e9dcc0', w = 5.6, h = 4.6) {
  const g = new THREE.Group();
  const ac = new THREE.Color(accent);

  // the window pane, flush on the wall plane, facing local +Z
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), makePortalWindowMaterial());
  pane.position.set(0, h / 2, 0.1);
  pane.castShadow = false; pane.receiveShadow = false;
  pane.userData.isPortalDisc = true;
  portalRender.registerDisc(pane);         // hidden during the virtual-camera RT pass
  g.add(pane);

  // timber door-frame around the opening
  const fw = 0.34, fd = 0.4;
  const frameCol = 0x5c4126;
  g.add(box(w + fw * 2, fw, fd, frameCol, { pos: [0, h + fw / 2, 0.06] }));
  g.add(box(fw, h, fd, frameCol, { pos: [-(w + fw) / 2, h / 2, 0.06] }));
  g.add(box(fw, h, fd, frameCol, { pos: [(w + fw) / 2, h / 2, 0.06] }));
  g.add(box(w + fw * 2, 0.24, fd + 0.2, frameCol, { pos: [0, 0.12, 0.1] })); // sill

  // a soft accent glow lining the inside of the frame
  const rimMat = new THREE.MeshStandardMaterial({ color: ac, emissive: ac, emissiveIntensity: 1.4 });
  const rimGeoV = new THREE.BoxGeometry(0.1, h, 0.12);
  for (const dx of [-(w / 2 - 0.06), w / 2 - 0.06]) {
    const r = new THREE.Mesh(rimGeoV, rimMat);
    r.position.set(dx, h / 2, 0.12); r.castShadow = false;
    g.add(r);
  }
  const rimTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.12), rimMat);
  rimTop.position.set(0, h - 0.06, 0.12); rimTop.castShadow = false;
  g.add(rimTop);

  g.traverse((o) => { if (o.isMesh || o.isSprite) o.userData.portal = true; });
  g.userData.portal = true;
  // face normal (local +Z, out of the wall) — navigation transforms it to world
  // space via matrixWorld, so a rotated building rotates the approach with it.
  g.userData.portalNormal = new THREE.Vector3(0, 0, 1);
  g.userData.portalCenter = new THREE.Vector3(0, h / 2, 0);

  return {
    group: g,
    update(t) {
      rimMat.emissiveIntensity = 1.1 + Math.sin(t * 1.6) * 0.4;
    },
  };
}

// The portal disc as a genuine WINDOW: the fragment shader samples the shared render
// target by SCREEN position (gl_FragCoord / resolution), not by the disc's own UVs.
// That makes the disc show exactly the part of the virtual-camera frame it covers on
// screen — the precondition for a seamless Portal-style cut. The RT is linear radiance,
// so we apply the SAME ACES tone map + sRGB encode the main renderer uses (matched
// exposure) so window pixels are indistinguishable from the surrounding world.
function makePortalWindowMaterial() {
  return new THREE.ShaderMaterial({
    toneMapped: false,   // we tone-map inside the shader; don't let three double-apply
    uniforms: {
      uTex:      { value: portalRender.texture },
      uRes:      { value: portalRender.resolution },   // live Vector2, updated each frame
      uExposure: { value: ACTIVE.exposure },
    },
    vertexShader: /* glsl */`
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex;
      uniform vec2  uRes;
      uniform float uExposure;

      // three.js ACESFilmicToneMapping, replicated so the window matches the scene.
      vec3 RRTAndODTFit(vec3 v) {
        vec3 a = v * (v + 0.0245786) - 0.000090537;
        vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
        return a / b;
      }
      vec3 ACESFilmic(vec3 color) {
        color *= uExposure;
        mat3 ACESInputMat = mat3(
          0.59719, 0.07600, 0.02840,
          0.35458, 0.90834, 0.13383,
          0.04823, 0.01566, 0.83777);
        mat3 ACESOutputMat = mat3(
           1.60475, -0.10208, -0.00327,
          -0.53108,  1.10813, -0.07276,
          -0.07367, -0.00605,  1.07602);
        color = ACESInputMat * color;
        color = RRTAndODTFit(color);
        return clamp(ACESOutputMat * color, 0.0, 1.0);
      }
      vec3 linearToSRGB(vec3 c) {
        return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
                   c * 12.92, step(c, vec3(0.0031308)));
      }
      void main() {
        vec2 uv = gl_FragCoord.xy / uRes;
        vec3 col = texture2D(uTex, uv).rgb;   // linear scene radiance
        gl_FragColor = vec4(linearToSRGB(ACESFilmic(col)), 1.0);
      }
    `,
  });
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
  // soft disc backing — dark in the diorama so the neon accent pops; in the croquis
  // a pale parchment disc with an ink arrow, so the return glyph stays a pencil mark
  // instead of a dark ink blot on the pale drawing.
  const pastel = ACTIVE.pastel > 0;
  ctx.fillStyle = pastel ? 'rgba(240,231,213,0.92)' : 'rgba(20,24,30,0.78)';
  ctx.beginPath(); ctx.arc(s / 2, s / 2, 56, 0, Math.PI * 2); ctx.fill();
  if (pastel) {
    ctx.strokeStyle = 'rgba(107,90,69,0.5)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, 55, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = pastel ? (ACTIVE.ink || '#6b5a45') : accent;
  ctx.lineWidth = 6; ctx.lineCap = 'round';
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
  // never claim portal meshes: a wall portal can live INSIDE a POI-tagged building
  // (e.g. the atelier's doorway) and must stay clickable as a portal.
  if (!root.userData.portal) root.userData.poi = poiId;
  root.traverse((o) => { if (!o.userData.portal) o.userData.poi = poiId; });
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
