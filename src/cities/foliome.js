// foliome.js — Foliome: hand-coded portfolio sites the artist updates alone — click a
// zone, a panel opens beside it, change it, it is saved.
// "THE BLUELINE": the tool's own demo site (Atelier Morane, an architecture practice
// drawn as a blueline print: one blue ink on cool paper) stood up as an architect's
// model on its site plan. White card, blue ink edges — and, floating over it, the
// editor's marks in guide magenta, the colour of things that are "tool, not artwork".
// The city is EDITABLE, with the tool's own gesture:
//  - the four PROJECTS are the site's `projects` list, one maquette each. Click one:
//    the note opens beside it with real fields (a text, a select, the list order).
//    Every change is an operation on a content path (`projects.<id>.title`), kept in
//    the visitor's browser the way Foliome keeps content.json — with undo.
//  - the PRINT on the drafting table is the site ONLINE: static, it only changes when
//    "Mettre en ligne" is pressed. Edit a title and the model follows, the print waits.
//  - the LAB prepares what the artist uploads: one picture in, the same picture out at
//    640, 1280 and 1920 px.
//  - the ATELIER (hero) is where it all runs: the site's own dev server.
import * as THREE from 'three';
import { box, cyl, makeLabel, makeWallPortal, poiBeacon, tagPOI, tagPickable } from './kit.js';
import { smoothstep } from '../gen/noise.js';

const PAPER = 0xeceff3, CARD = 0xf6f7fa, LAVIS = 0xcfd8ec, INK = 0x2a36a8, PENCIL = 0xe2462c;
const GUIDE = 0xe5197d, GUIDE_DEEP = 0xb80f62;
const CSS = { paper: '#eceff3', white: '#f7f8fb', ink: '#2a36a8', dense: '#1a2170', guideDeep: '#b80f62' };

// The sheet is squared to the dive camera (frame.azimuth): inside `board`, +X is
// screen-right and +Z comes toward the viewer, so everything lettered faces +Z.
const AZ = 0.42;
// Same footing as the other built-up cities: the site stands LIFT above the (sunk)
// city origin and whatever meets the ground runs SKIRT below it.
const LIFT = 0.5, SKIRT = 2, FLOOR = 0.5;
const SHEET_W = 68, SHEET_D = 52;
const SLOTS = [-19.5, -6.5, 6.5, 19.5], ROW_Z = 9;   // where the four projects stand

// ---- the content, as Foliome holds it ------------------------------------------
// One list of items with stable ids; `program` indexes the select's options (the
// labels are the note's, in content.js). Titles and years are the real demo's.
const STORE = 'foliome-demo';
const DEMO = [
  { id: 'p_refuge', title: 'Refuge de la Combe Noire', year: '2024', program: 1 },
  { id: 'p_halle', title: 'Halle aux grains', year: '2023', program: 2 },
  { id: 'p_maison', title: 'Maison sur la pente', year: '2022', program: 0 },
  { id: 'p_chai', title: 'Chai des Roches', year: '2021', program: 1 },
];
const PROGRAMS = 4, TITLE_MAX = 36, UNDO_LEVELS = 100;
const clone = (v) => JSON.parse(JSON.stringify(v));

function validList(list) {
  return Array.isArray(list) && list.length === DEMO.length &&
    DEMO.every((d) => list.some((p) => p && p.id === d.id)) &&
    list.every((p) => typeof p.title === 'string' && p.title.length <= TITLE_MAX &&
      Number.isInteger(p.program) && p.program >= 0 && p.program < PROGRAMS);
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE));
    if (raw && validList(raw.doc?.projects) && validList(raw.published?.projects)) {
      const years = Object.fromEntries(DEMO.map((d) => [d.id, d.year]));
      for (const side of [raw.doc, raw.published]) for (const p of side.projects) p.year = years[p.id];
      return { doc: raw.doc, published: raw.published };
    }
  } catch (e) { /* no storage, or not ours: start from the demo */ }
  return { doc: { projects: clone(DEMO) }, published: { projects: clone(DEMO) } };
}

// Paths address an item by its ID, not its index, so they keep pointing at the same
// item when the list is reordered — the rule of @foliome/core, in miniature.
function applyOp(doc, op) {
  const [list, id, field] = op.path.split('.');
  const items = doc[list];
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return;
  if (op.op === 'set') items[i][field] = op.value;
  else if (op.op === 'move') {
    const [item] = items.splice(i, 1);
    items.splice(Math.max(0, Math.min(items.length, op.index)), 0, item);
  }
}

// ---- drawing: card, ink, and lettered paper --------------------------------------
// White card gives off a little light of its own (GLOW), so it stays paper-white in
// the diorama's warm shade instead of going to cardboard.
const GLOW = 0xe3e8f4;
const cardMat = (color = CARD, extra = {}) => new THREE.MeshStandardMaterial({
  color, flatShading: true, roughness: 0.95, emissive: GLOW, emissiveIntensity: 0.32, ...extra,
});
function prism(pts, depth, color = CARD) {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))),
    { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, cardMat(color));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const card = (w, h, d, pos, color = CARD) => box(w, h, d, color, { pos, roughness: 0.95, emissive: GLOW, emissiveIntensity: 0.32 });
// tinted "glass": a wash of lavis that glows a little
const wash = (w, h, d, pos) => box(w, h, d, LAVIS, { pos, roughness: 0.6, emissive: LAVIS, emissiveIntensity: 0.25, cast: false });

// Ink strokes with real thickness: one instanced beam per segment. (GL lines are a
// single device pixel wide — a hairline on a dense screen.)
const beamGeo = new THREE.BoxGeometry(1, 1, 1);
function beams(segments, th, color) {
  const mesh = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color }), segments.length / 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const d = new THREE.Vector3(), mid = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < segments.length; i += 2) {
    d.subVectors(segments[i + 1], segments[i]);
    const len = d.length();
    q.setFromUnitVectors(up, d.normalize());
    mid.addVectors(segments[i], segments[i + 1]).multiplyScalar(0.5);
    mesh.setMatrixAt(i / 2, m.compose(mid, q, s.set(th, len + th, th)));
  }
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.userData.noInk = true;
  mesh.raycast = () => {};               // strokes are never the thing you click
  return mesh;
}

// Draw every crease of every mesh under `root` in ink, as one child of `root` (so
// the strokes move with it).
function inkEdges(root, th = 0.1) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rel = new THREE.Matrix4(), segments = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noInk) return;
    const edges = new THREE.EdgesGeometry(o.geometry, 28);
    const pos = edges.attributes.position;
    rel.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) segments.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(rel));
    edges.dispose();
  });
  root.add(beams(segments, th, INK));
}

// a sheet of lettered paper: { tex, draw(fn) } — draw(fn) repaints it
function paper(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, draw(fn) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); fn(ctx, w, h); tex.needsUpdate = true; } };
}
// the demo's display face is tall and narrow, "like elevations": a squeezed bold sans
function tallCaps(ctx, text, x, y, size, color, align = 'left', squeeze = 0.62) {
  ctx.save(); ctx.translate(x, y); ctx.scale(squeeze, 1);
  ctx.font = `700 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text.toUpperCase(), 0, 0);
  const w = ctx.measureText(text.toUpperCase()).width * squeeze;
  ctx.restore();
  return w;
}

function drawSheet(ctx, w, h) {
  // board coordinates (x right, z toward the viewer) → pixels
  const px = (x) => (x / SHEET_W + 0.5) * w, py = (z) => (z / SHEET_D + 0.5) * h, u = w / SHEET_W;
  ctx.fillStyle = CSS.paper; ctx.fillRect(0, 0, w, h);
  for (let i = 0, x = 0; x <= w; x += 16, i++) {
    ctx.strokeStyle = i % 5 ? 'rgba(42,54,168,0.09)' : 'rgba(42,54,168,0.2)'; ctx.lineWidth = i % 5 ? 1 : 1.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let i = 0, y = 0; y <= h; y += 16, i++) {
    ctx.strokeStyle = i % 5 ? 'rgba(42,54,168,0.09)' : 'rgba(42,54,168,0.2)'; ctx.lineWidth = i % 5 ? 1 : 1.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  // the ground itself: contour lines — this practice only builds on slopes
  ctx.strokeStyle = 'rgba(42,54,168,0.24)'; ctx.lineWidth = 1.6;
  ctx.font = 'italic 15px "EB Garamond", serif'; ctx.fillStyle = 'rgba(42,54,168,0.55)'; ctx.textAlign = 'left';
  for (let k = 0; k < 8; k++) {
    const y0 = 70 + k * 92;
    const at = (x) => y0 - x * 0.16 + Math.sin(x * 0.011 + k * 1.3) * 26 + Math.sin(x * 0.027 + k) * 9;
    ctx.beginPath(); ctx.moveTo(30, at(30));
    for (let x = 38; x <= w - 30; x += 8) ctx.lineTo(x, at(x));
    ctx.stroke();
    if (at(44) > 44 && at(44) < h - 44) ctx.fillText(String(820 + k * 5), 44, at(44) - 5);
  }
  // where each item of the list stands: its place number, on the paper
  ctx.setLineDash([9, 7]); ctx.strokeStyle = 'rgba(42,54,168,0.5)'; ctx.lineWidth = 1.6;
  SLOTS.forEach((x, i) => {
    ctx.strokeRect(px(x - 5.5), py(ROW_Z - 5.5), 11 * u, 11 * u);
    tallCaps(ctx, String(i + 1).padStart(2, '0'), px(x), py(ROW_Z + 8.3), 26, 'rgba(42,54,168,0.75)', 'center');
  });
  ctx.setLineDash([]);
  // a scale bar, bottom-left
  const bx0 = px(-30), by0 = py(22.6);
  ctx.strokeStyle = CSS.ink; ctx.lineWidth = 1.5; ctx.fillStyle = CSS.ink;
  [0, 5, 10, 20].forEach((m, i, all) => {
    if (i === all.length - 1) return;
    const x0 = bx0 + m * u * 0.8, x1 = bx0 + all[i + 1] * u * 0.8;
    if (i % 2 === 0) ctx.fillRect(x0, by0, x1 - x0, 7); else ctx.strokeRect(x0, by0, x1 - x0, 7);
  });
  ctx.font = 'italic 15px "EB Garamond", serif'; ctx.textAlign = 'center';
  for (const m of [0, 5, 10, 20]) ctx.fillText(m === 20 ? '20 m' : String(m), bx0 + m * u * 0.8, by0 + 23);

  ctx.strokeStyle = CSS.ink; ctx.lineWidth = 4; ctx.strokeRect(16, 16, w - 32, h - 32);
  ctx.lineWidth = 1.5; ctx.strokeRect(26, 26, w - 52, h - 52);
  // title block, bottom-right, as on any drawing
  const tx = w - 26 - 300, ty = h - 26 - 96;
  ctx.fillStyle = CSS.paper; ctx.fillRect(tx, ty, 300, 96);
  ctx.lineWidth = 2; ctx.strokeRect(tx, ty, 300, 96);
  ctx.beginPath(); ctx.moveTo(tx, ty + 54); ctx.lineTo(tx + 300, ty + 54); ctx.stroke();
  tallCaps(ctx, 'Atelier Morane', tx + 14, ty + 42, 40, CSS.ink);
  ctx.font = 'italic 19px "EB Garamond", serif'; ctx.fillStyle = CSS.dense; ctx.textAlign = 'left';
  ctx.fillText('Plan de masse — 1:200', tx + 14, ty + 82);
  // north arrow, top-left
  ctx.fillStyle = CSS.paper; ctx.beginPath(); ctx.arc(74, 78, 26, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(74, 78, 24, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = CSS.ink; ctx.beginPath(); ctx.moveTo(74, 46); ctx.lineTo(84, 88); ctx.lineTo(74, 80); ctx.lineTo(64, 88); ctx.closePath(); ctx.fill();
}

// each programme has its hatch, as in a drawing's legend
function drawHatch(ctx, w, h, program) {
  ctx.fillStyle = '#e3e8f3'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(42,54,168,0.34)'; ctx.lineWidth = 2;
  ctx.beginPath();
  if (program === 0) {                       // housing: diagonals
    for (let k = -h; k < w; k += 22) { ctx.moveTo(k, h); ctx.lineTo(k + h, 0); }
  } else if (program === 1) {                // public building: a square grid
    for (let k = 0; k <= w; k += 28) { ctx.moveTo(k, 0); ctx.lineTo(k, h); ctx.moveTo(0, k); ctx.lineTo(w, k); }
  } else if (program === 2) {                // renovation: cross-hatch
    for (let k = -h; k < w; k += 30) { ctx.moveTo(k, h); ctx.lineTo(k + h, 0); ctx.moveTo(k, 0); ctx.lineTo(k + h, h); }
  } else {                                   // landscape: contour lines
    for (let y = 14; y < h; y += 24) {
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.045 + y * 0.3) * 7);
    }
  }
  ctx.stroke();
  ctx.strokeStyle = CSS.ink; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
}

function drawPlate(ctx, w, h, p) {
  ctx.fillStyle = CSS.white; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = CSS.ink; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.font = 'italic 36px "EB Garamond", serif'; ctx.fillStyle = CSS.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(p.year, w - 22, h / 2 + 13);
  let size = 86;                             // the title shrinks to stay on its plate
  ctx.textAlign = 'left';
  do { size -= 3; ctx.font = `700 ${size}px Caveat, cursive`; }
  while (size > 26 && ctx.measureText(p.title).width > w - 130);
  ctx.fillStyle = CSS.dense;
  ctx.fillText(p.title, 22, h / 2 + size * 0.3);
}

// the site ONLINE: its home page, as last published
function drawPrint(ctx, w, h, projects) {
  ctx.fillStyle = CSS.white; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = CSS.ink; ctx.lineWidth = 5; ctx.strokeRect(14, 14, w - 28, h - 28);
  tallCaps(ctx, 'Atelier Morane', 44, 122, 104, CSS.ink);
  ctx.font = 'italic 27px "EB Garamond", serif'; ctx.fillStyle = CSS.dense; ctx.textAlign = 'left';
  ctx.fillText('Architecture en territoire de pente', 46, 164);
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(44, 190); ctx.lineTo(w - 44, 190); ctx.stroke();
  projects.forEach((p, i) => {
    const y = 258 + i * 86;
    ctx.font = '600 26px ui-monospace, "DejaVu Sans Mono", Menlo, monospace'; ctx.fillStyle = CSS.ink; ctx.textAlign = 'left';
    ctx.fillText(String(i + 1).padStart(2, '0'), 46, y);
    let size = 50;                           // long titles shrink to stay on their line
    while (size > 22 && tallCaps(ctx, p.title, 0, -999, size, CSS.dense) > w - 300) size -= 3;
    tallCaps(ctx, p.title, 104, y, size, CSS.dense);
    ctx.font = 'italic 28px "EB Garamond", serif'; ctx.fillStyle = CSS.ink; ctx.textAlign = 'right';
    ctx.fillText(p.year, w - 46, y);
    ctx.strokeStyle = 'rgba(42,54,168,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(44, y + 26); ctx.lineTo(w - 44, y + 26); ctx.stroke();
  });
}

// the picture the lab hands back, lettered with its width
function drawPhoto(ctx, w, h, label) {
  ctx.fillStyle = CSS.white; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = CSS.ink; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
  ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(24, h - 70); ctx.lineTo(w * 0.36, h * 0.3); ctx.lineTo(w * 0.52, h - 110);
  ctx.lineTo(w * 0.68, h * 0.42); ctx.lineTo(w - 24, h - 70); ctx.stroke();
  ctx.beginPath(); ctx.arc(w * 0.78, h * 0.24, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = CSS.ink; ctx.fillRect(10, h - 62, w - 20, 52);
  ctx.font = '700 40px ui-monospace, "DejaVu Sans Mono", Menlo, monospace'; ctx.fillStyle = CSS.white;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h - 34);
}

// the editor's tag: a magenta flag naming the zone it sits on
function drawTag(ctx, w, h, text) {
  ctx.font = '600 44px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const tw = Math.min(w - 44, ctx.measureText(text).width);
  ctx.fillStyle = CSS.guideDeep;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 8, tw + 44, h - 8, [14, 14, 14, 0]); else ctx.rect(0, 8, tw + 44, h - 8);
  ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 22, h / 2 + 6, w - 44);
}

function drawPointer(ctx) {
  ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#17171c'; ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(14, 8); ctx.lineTo(14, 76); ctx.lineTo(31, 61); ctx.lineTo(43, 88);
  ctx.lineTo(56, 82); ctx.lineTo(44, 56); ctx.lineTo(66, 56); ctx.closePath();
  ctx.stroke(); ctx.fill();
}

// ---- the four maquettes (each stands on its plinth, front toward +Z) --------------
const gable = (w, rise, depth, over = 0.3) => prism([[-w / 2 - over, 0], [w / 2 + over, 0], [0, rise]], depth);

const MODELS = {
  // a mountain refuge: a steep-roofed hut on stilts, on stacked contour layers
  p_refuge(m) {
    m.add(card(8.4, 0.5, 8.0, [0, 0.25, 0]), card(6.6, 0.5, 6.2, [-0.5, 0.75, -0.4]), card(4.8, 0.5, 4.6, [-0.8, 1.25, -0.7]));
    for (const dx of [-1.4, 1.4]) for (const dz of [-1.1, 1.1]) m.add(card(0.3, 1.0, 0.3, [-0.8 + dx, 2.0, -0.7 + dz]));
    m.add(card(3.6, 2.4, 3.0, [-0.8, 3.7, -0.7]));
    const roof = gable(3.6, 2.7, 3.6); roof.position.set(-0.8, 4.9, -0.7); m.add(roof);
    m.add(card(0.5, 1.5, 0.5, [0.2, 6.5, -1.3]));
    m.add(wash(0.9, 1.3, 0.1, [-0.8, 3.2, 0.82]));
    m.add(cyl(0.05, 0.05, 2.4, CARD, 5, { pos: [2.6, 1.95, 1.6] }));
    m.add(box(0.9, 0.5, 0.05, PENCIL, { pos: [3.05, 2.85, 1.6], cast: false }));
  },
  // a grain hall: an open colonnade under one long roof, with a lantern
  p_halle(m) {
    m.add(card(8.6, 0.4, 5.4, [0, 0.2, 0]));
    for (const x of [-3.6, -1.8, 0, 1.8, 3.6]) for (const z of [-2.0, 2.0]) m.add(card(0.45, 2.8, 0.45, [x, 1.8, z]));
    m.add(card(8.2, 0.4, 4.8, [0, 3.4, 0]));
    const roof = gable(4.8, 2.3, 8.2, 0.35); roof.rotation.y = Math.PI / 2; roof.position.y = 3.6; m.add(roof);
    m.add(card(3.0, 0.7, 1.0, [0, 6.0, 0]));
    const cap = gable(1.0, 0.6, 3.0, 0.2); cap.rotation.y = Math.PI / 2; cap.position.y = 6.35; m.add(cap);
  },
  // a house on a slope: two volumes stepping up a ramp of ground
  p_maison(m) {
    const slope = prism([[-4.2, 0], [4.2, 0], [4.2, 2.6]], 7.6); m.add(slope);
    m.add(card(3.0, 2.6, 3.6, [-1.7, 1.7, 0.6]), card(3.0, 2.6, 3.6, [1.8, 2.8, -0.8]));
    for (const [x, y, z] of [[-1.7, 3.15, 0.6], [1.8, 4.25, -0.8]]) {
      const roof = card(3.6, 0.22, 4.2, [x, y, z]); roof.rotation.z = 0.2; m.add(roof);
    }
    m.add(wash(2.0, 1.4, 0.1, [-1.7, 1.9, 2.42]), wash(2.0, 1.4, 0.1, [1.8, 3.0, 1.02]));
    m.add(card(2.4, 0.2, 2.2, [-3.0, 0.75, 2.4]));
  },
  // a winery: a barrel vault half-buried by a rock, casks out front
  p_chai(m) {
    m.add(card(8.4, 0.5, 6.6, [0, 0.25, 0]), card(6.4, 1.2, 4.6, [0.4, 1.1, -0.4]));
    const vaultGeo = new THREE.CylinderGeometry(2.3, 2.3, 6.4, 14, 1, false, 0, Math.PI);
    vaultGeo.rotateZ(Math.PI / 2);
    const vault = new THREE.Mesh(vaultGeo, cardMat(CARD, { side: THREE.DoubleSide }));
    vault.position.set(0.4, 1.7, -0.4); vault.castShadow = true; vault.receiveShadow = true; m.add(vault);
    for (const [x, y] of [[-2.9, 1.1], [-1.6, 1.1], [-2.25, 2.2]]) {
      const cask = cyl(0.62, 0.62, 1.0, LAVIS, 10, { pos: [x, y, 2.5], roughness: 0.8 });
      cask.rotation.x = Math.PI / 2; m.add(cask);
    }
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), cardMat());
    rock.scale.set(1, 0.8, 1); rock.position.set(3.5, 1.3, 1.9); rock.castShadow = true; m.add(rock);
  },
};

// a maquette tree: a ball of card on a pin
function modelTree(x, z, r) {
  const t = new THREE.Group(); t.position.set(x, FLOOR, z);
  t.add(cyl(0.09, 0.09, r * 1.6, CARD, 5, { pos: [0, r * 0.8, 0] }));
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), cardMat());
  ball.position.y = r * 2.2; ball.castShadow = true; t.add(ball);
  return t;
}

export function build() {
  const g = new THREE.Group();
  const board = new THREE.Group(); board.position.y = LIFT; board.rotation.y = AZ; g.add(board);
  const state = loadState();
  const history = [];                    // undo snapshots of state.doc, newest last
  const lettered = [];                   // repaint these once the web fonts are in

  // ===== THE SHEET — the site plan everything stands on ========================
  const fixed = new THREE.Group(); board.add(fixed);
  fixed.add(card(SHEET_W, FLOOR + SKIRT, SHEET_D, [0, (FLOOR - SKIRT) / 2, 0], PAPER));
  const sheetPaper = paper(1024, 784);
  lettered.push(() => sheetPaper.draw(drawSheet));
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_D),
    new THREE.MeshStandardMaterial({ map: sheetPaper.tex, roughness: 1, emissive: 0xffffff, emissiveMap: sheetPaper.tex, emissiveIntensity: 0.34 }));
  sheet.rotation.x = -Math.PI / 2; sheet.position.y = FLOOR + 0.02; sheet.receiveShadow = true;
  sheet.userData.noInk = true; fixed.add(sheet);

  // ===== THE ATELIER — a north-lit studio: the dev server the site is edited on =
  const atelier = new THREE.Group(); atelier.position.set(-4, FLOOR, -15); board.add(atelier); tagPOI(atelier, 'atelier');
  atelier.add(card(16, 10, 11, [0, 5, 0]));
  for (let k = 0; k < 4; k++) {            // the sawtooth roof, glazed on its upright faces
    const shed = prism([[0, 0], [4, 0], [0, 3.4]], 11); shed.position.set(-8 + k * 4, 10, 0); atelier.add(shed);
    atelier.add(wash(0.12, 2.5, 9.6, [-8 + k * 4 - 0.07, 11.5, 0]));
  }
  atelier.add(card(1.7, 7.5, 1.7, [6, 13.7, -3.2]), card(2.2, 0.5, 2.2, [6, 17.7, -3.2]));     // chimney
  const glass = wash(9.6, 5.4, 0.12, [-1.8, 5.6, 5.52]); atelier.add(glass);                   // studio window
  for (let i = 0; i <= 4; i++) atelier.add(card(0.16, 5.4, 0.16, [-6.6 + i * 2.4, 5.6, 5.62]));
  for (let j = 0; j <= 2; j++) atelier.add(card(9.76, 0.16, 0.16, [-1.8, 2.9 + j * 2.7, 5.62]));
  atelier.add(card(2.6, 4.2, 0.2, [5.6, 2.1, 5.55]), wash(1.9, 3.5, 0.1, [5.6, 1.95, 5.68]));  // door
  atelier.add(card(18, 0.4, 2.4, [0, 0.2, 6.6]));                                              // doorstep
  inkEdges(atelier, 0.14);
  const portal = makeWallPortal('#e5197d', 5.2, 4.4);     // the back door, away from the sheet's front
  portal.group.position.set(0, 0, -5.6); portal.group.rotation.y = Math.PI;
  atelier.add(portal.group);

  // ===== THE PRINT — the site online: a sheet pinned to the drafting table ======
  const table = new THREE.Group(); table.position.set(20, FLOOR, -14.5); board.add(table); tagPOI(table, 'print');
  for (const dx of [-5.2, 5.2]) {           // two trestles
    for (const s of [-1, 1]) {
      const leg = card(0.4, 8.2, 0.4, [dx, 4.0, s * 1.5]); leg.rotation.x = -s * 0.2; table.add(leg);
    }
    table.add(card(0.4, 0.4, 3.4, [dx, 2.6, 0]));
  }
  const top = new THREE.Group(); top.position.set(0, 8.0, 0.6); top.rotation.x = -0.52; table.add(top);
  top.add(card(14, 9.6, 0.5, [0, 0, -0.25]));
  top.add(card(14.4, 0.5, 1.0, [0, -4.9, 0.3]));                                               // the ledge
  top.add(wash(0.5, 9.0, 0.14, [-6.3, 0, 0.1]));                                               // a T-square
  inkEdges(table, 0.12);
  const printPaper = paper(900, 600);
  const printGeo = new THREE.PlaneGeometry(12, 8); printGeo.translate(0, -4, 0);               // hangs from its top edge
  const print = new THREE.Mesh(printGeo, new THREE.MeshBasicMaterial({ map: printPaper.tex }));
  print.position.set(0.5, 4.1, 0.06); top.add(print);
  for (const dx of [-4.5, 5.5]) top.add(box(0.7, 0.45, 0.16, PENCIL, { pos: [dx, 4.0, 0.14], cast: false }));   // clips
  const paintPrint = () => printPaper.draw((ctx, w, h) => drawPrint(ctx, w, h, state.published.projects));
  lettered.push(paintPrint);

  // ===== THE LAB — one picture in, the same picture out at three widths =========
  const lab = new THREE.Group(); lab.position.set(-26, FLOOR, -7); board.add(lab); tagPOI(lab, 'labo');
  lab.add(card(9, 5, 6, [0, 2.5, 0]), card(9.6, 0.4, 6.6, [0, 5.2, 0]), card(3, 0.9, 2.4, [-1.5, 5.85, 0]));
  lab.add(wash(2.6, 0.12, 2.0, [-1.5, 6.32, 0]));                                              // skylight
  lab.add(card(1.4, 3.0, 0.2, [-3.4, 1.5, 3.05]));                                             // door
  lab.add(card(6.4, 0.3, 3.2, [7.6, 1.7, 0]));                                                 // the intake table
  for (const dx of [5.0, 10.2]) for (const dz of [-1.2, 1.2]) lab.add(card(0.3, 1.6, 0.3, [dx, 0.8, dz]));
  inkEdges(lab, 0.11);
  const intake = new THREE.Group(); lab.add(intake);        // the original, sliding in
  const original = paper(384, 288);
  lettered.push(() => original.draw((ctx, w, h) => drawPhoto(ctx, w, h, '3200')));
  const origMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.7),
    new THREE.MeshBasicMaterial({ map: original.tex, transparent: true }));
  origMesh.rotation.x = -Math.PI / 2; origMesh.position.y = 1.9; intake.add(origMesh);
  const prints = [640, 1280, 1920].map((px, i) => {          // widths in true 1 : 2 : 3
    const sheetPx = paper(384, 288);
    lettered.push(() => sheetPx.draw((ctx, w, h) => drawPhoto(ctx, w, h, String(px))));
    const w = 0.95 * (i + 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.75),
      new THREE.MeshBasicMaterial({ map: sheetPx.tex, transparent: true }));
    m.position.set([-1.75, -0.15, 2.55][i], 1.15 + w * 0.375, 3.06); lab.add(m);
    return m;
  });

  // ===== THE PROJECTS — the site's list, one maquette per item ==================
  const byId = {};
  for (const item of DEMO) {
    const grp = new THREE.Group(); grp.position.set(0, FLOOR, ROW_Z); board.add(grp);
    grp.userData.zone = item.id; tagPOI(grp, 'projects');
    grp.add(card(10, 0.9, 10, [0, 0.45, 0]));
    const model = new THREE.Group(); model.position.y = 0.9; grp.add(model);
    MODELS[item.id](model);
    inkEdges(grp, 0.09);
    // the plinth's top carries the programme's hatch; its front edge, the name plate
    const hatch = paper(256, 256);
    const hatchMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.7, 9.7),
      new THREE.MeshStandardMaterial({ map: hatch.tex, roughness: 1, emissive: 0xffffff, emissiveMap: hatch.tex, emissiveIntensity: 0.34 }));
    hatchMesh.rotation.x = -Math.PI / 2; hatchMesh.position.y = 0.92; hatchMesh.receiveShadow = true; grp.add(hatchMesh);
    const plate = paper(640, 160);
    const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: plate.tex }));
    plateMesh.position.set(0, 0.95, 6.15); plateMesh.rotation.x = -0.85; grp.add(plateMesh);
    // a strip of magenta along the plinth that flashes when the item is saved
    const flash = box(10.1, 0.14, 10.1, GUIDE, { pos: [0, 0.07, 0], emissive: GUIDE, emissiveIntensity: 0, cast: false, receive: false });
    flash.material.transparent = true; flash.material.opacity = 0; grp.add(flash);
    byId[item.id] = { id: item.id, grp, hatch, plate, flash, saved: 0, shown: {} };
  }
  const itemOf = (id) => state.doc.projects.find((p) => p.id === id);
  // repaint whatever the content changed (also called once the fonts are in, forced)
  const refresh = (force = false) => {
    state.doc.projects.forEach((p, i) => {
      const v = byId[p.id];
      v.slot = i;
      if (force || v.shown.title !== p.title) { v.plate.draw((ctx, w, h) => drawPlate(ctx, w, h, p)); v.shown.title = p.title; }
      if (force || v.shown.program !== p.program) { v.hatch.draw((ctx, w, h) => drawHatch(ctx, w, h, p.program)); v.shown.program = p.program; }
    });
  };
  lettered.push(() => refresh(true));
  state.doc.projects.forEach((p, i) => { byId[p.id].grp.position.x = SLOTS[i]; });

  // ===== THE EDITOR'S MARKS — outline + tag on a zone, in guide magenta =========
  const frameSegs = [];
  {
    const pos = new THREE.EdgesGeometry(new THREE.BoxGeometry(10.9, 9.6, 10.9)).attributes.position;
    for (let i = 0; i < pos.count; i++) frameSegs.push(new THREE.Vector3().fromBufferAttribute(pos, i));
  }
  const makeMark = (color, th) => {
    const mark = new THREE.Group(); mark.visible = false;
    const outline = beams(frameSegs, th, color); outline.position.y = 4.85; mark.add(outline);
    const tagPaper = paper(512, 96);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagPaper.tex, transparent: true, depthTest: false, depthWrite: false }));
    tag.center.set(0, 0); tag.scale.set(8, 1.5, 1); tag.position.set(-5.45, 9.7, 5.45); tag.renderOrder = 18;
    mark.add(tag);
    let on = null, text = null;
    mark.show = (id) => {                 // sit on that zone (or hide), re-lettering the tag if needed
      const label = id ? itemOf(id).title : null;
      if (id !== on) { if (id) byId[id].grp.add(mark); mark.visible = !!id; on = id; }
      if (id && label !== text) { tagPaper.draw((ctx, w, h) => drawTag(ctx, w, h, label || '…')); text = label; }
    };
    mark.relabel = () => { text = null; };
    return mark;
  };
  const hoverMark = makeMark(GUIDE, 0.13), activeMark = makeMark(GUIDE_DEEP, 0.2);
  board.add(hoverMark, activeMark);
  lettered.push(() => { hoverMark.relabel(); activeMark.relabel(); });
  const pointerPaper = paper(96, 96); pointerPaper.draw(drawPointer);
  const pointer = new THREE.Sprite(new THREE.SpriteMaterial({ map: pointerPaper.tex, transparent: true, depthTest: false, depthWrite: false }));
  pointer.center.set(0.15, 0.92); pointer.scale.set(3.2, 3.2, 1); pointer.renderOrder = 19;
  pointer.raycast = () => {};
  board.add(pointer);

  // ===== maquette trees along the sheet's edges =================================
  for (const [x, z, r] of [[-31, -22, 1.5], [-24.5, -23.5, 1.1], [-15, -23, 1.3], [9, -23, 1.2], [31, -22.5, 1.5],
    [31.5, -3, 1.2], [31, 3.5, 1.4], [-31.5, 20, 1.4], [-31, 3, 1.1], [-17, 22, 1.0]]) fixed.add(modelTree(x, z, r));
  inkEdges(fixed, 0.08);

  // ===== POI beacons ============================================================
  const pois = [];
  const addBeacon = (id, accent, x, y, z) => {
    const b = poiBeacon(accent); b.group.position.set(x, y, z); board.add(b.group);
    tagPOI(b.group, id); pois.push({ id, accent, beacon: b });
    return b;
  };
  addBeacon('atelier', '#e5197d', -4, 23, -15);
  const projectsBeacon = addBeacon('projects', '#e5197d', 0, 13.5, ROW_Z);
  addBeacon('print', '#5f6fd8', 20, 17, -14.5);
  addBeacon('labo', '#5f6fd8', -26, 10.5, -7);

  const label = makeLabel('Foliome', 'Editable Portfolios', '#e5197d');
  label.sprite.position.set(-4, 29, -15); board.add(label.sprite);

  tagPickable(g, 'foliome');
  const paintAll = () => { for (const fn of lettered) fn(); };
  paintAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintAll);

  // ===== EDITING — the note's controls, and what they do to the content =========
  let hoverId = null, activeId = null, lastId = null, panel = null;
  let printing = 1;                        // 0 → 1 while a fresh print unrolls
  let burst = { path: null, at: 0 };
  const pin = new THREE.Object3D();        // where the note is pinned: over the zone being edited
  projectsBeacon.group.add(pin);
  const dirty = () => JSON.stringify(state.doc) !== JSON.stringify(state.published);
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode: lives for this visit */ }
  };
  const commit = (op) => {
    // one undo level per burst of typing in a field, not one per keystroke
    const now = performance.now();
    if (!(op.op === 'set' && op.path === burst.path && now - burst.at < 1500)) {
      history.push(JSON.stringify(state.doc));
      if (history.length > UNDO_LEVELS) history.shift();
    }
    burst = { path: op.path, at: now };
    applyOp(state.doc, op);
    save(); refresh();
    byId[op.path.split('.')[1]].saved = 1;
    panel?.sync('saved');
  };
  const undo = () => {
    if (!history.length) { panel?.sync('nothing'); return; }
    state.doc = JSON.parse(history.pop());
    burst = { path: null, at: 0 };
    save(); refresh();
    panel?.sync('undone');
  };
  const publish = () => {
    state.published = clone(state.doc);
    save(); paintPrint(); printing = 0;
    panel?.sync('published');
  };

  // `note.edit` carries the labels (content.js), so the panel speaks the page's language
  const mount = (el, note) => {
    const L = note && note.edit;
    if (!L || !activeId) return;
    const make = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    const field = (text, control) => { const l = make('label', 'note-edit-field'); l.append(make('span', null, text), control); return l; };
    const wrap = make('div', 'note-edit');
    const path = make('code', 'note-edit-path');
    const title = make('input'); title.type = 'text'; title.maxLength = TITLE_MAX; title.spellcheck = false; title.autocomplete = 'off';
    const program = make('select');
    L.programs.forEach((name, i) => { const o = make('option', null, name); o.value = String(i); program.append(o); });
    const left = make('button', null, '←'), right = make('button', null, '→');
    left.type = right.type = 'button'; left.title = L.moveLeft; right.title = L.moveRight;
    left.setAttribute('aria-label', L.moveLeft); right.setAttribute('aria-label', L.moveRight);
    const place = make('span', 'note-edit-place');
    const order = make('div', 'note-edit-order'); order.append(make('span', null, L.order), left, right, place);
    const undoBtn = make('button', null, L.undo), pubBtn = make('button', null, L.publish);
    undoBtn.type = pubBtn.type = 'button';
    const bar = make('div', 'note-edit-bar'); bar.append(undoBtn, pubBtn);
    const status = make('p', 'note-edit-status'); status.setAttribute('aria-live', 'polite');
    wrap.append(path, field(L.title, title), field(L.program, program), order, bar, status);

    title.addEventListener('input', () => commit({ op: 'set', path: `projects.${activeId}.title`, value: title.value }));
    program.addEventListener('change', () => commit({ op: 'set', path: `projects.${activeId}.program`, value: +program.value }));
    const move = (by) => commit({ op: 'move', path: `projects.${activeId}`, index: state.doc.projects.findIndex((p) => p.id === activeId) + by });
    left.addEventListener('click', () => move(-1));
    right.addEventListener('click', () => move(1));
    undoBtn.addEventListener('click', undo);
    pubBtn.addEventListener('click', publish);

    panel = {
      sync(said) {
        const item = itemOf(activeId), i = state.doc.projects.indexOf(item), n = state.doc.projects.length;
        path.textContent = `projects.${item.id}`;
        if (title.value !== item.title) title.value = item.title;   // leave the caret alone while typing
        program.value = String(item.program);
        left.disabled = i === 0; right.disabled = i === n - 1;
        place.textContent = `${i + 1} / ${n}`;
        undoBtn.disabled = !history.length;
        pubBtn.disabled = !dirty(); pubBtn.classList.toggle('is-primary', dirty());
        status.textContent = said ? L[said] : (dirty() ? L.pending : '');
      },
    };
    panel.sync();
    el.append(wrap);
  };

  const poiRecords = pois.map((p) => ({ id: p.id, accent: p.accent, anchor: p.beacon.anchor, setState: p.beacon.setState }));
  Object.assign(poiRecords.find((p) => p.id === 'projects'), {
    anchor: pin, mount,
    reach: 6.6,                            // the note opens beside the maquette, not over it
    // the note is about ONE project: the one clicked, else the last one edited
    select(zone) {
      activeId = byId[zone] ? zone : (lastId || state.doc.projects[0].id);
      lastId = activeId;
      byId[activeId].grp.add(pin); pin.position.set(0, 4.6, 0);
      return activeId;
    },
    deselect() { activeId = null; panel = null; projectsBeacon.group.add(pin); pin.position.set(0, 0, 0); },
    hoverZone(zone) { hoverId = byId[zone] ? zone : null; },
  });

  return {
    group: g, label,
    frame: { target: [0, 6, 0], azimuth: AZ, polar: 53, radius: 88 },
    pois: poiRecords,
    update(t, dt = 0.016) {
      portal.update(t);
      for (const p of pois) p.beacon.update(t);

      // each project glides to its place in the list; a save flashes its plinth
      const ease = 1 - Math.exp(-dt * 7);
      for (const id in byId) {
        const v = byId[id];
        v.grp.position.x += (SLOTS[v.slot] - v.grp.position.x) * ease;
        v.saved *= Math.exp(-dt * 2.6);
        v.flash.material.opacity = v.saved; v.flash.material.emissiveIntensity = v.saved * 2.2;
      }

      // the editor's marks. Left alone, the outline strolls from zone to zone with its
      // pointer — an invitation; hovered or opened, it obeys the visitor instead.
      const idle = !hoverId && !activeId;
      const stroll = state.doc.projects[Math.floor(t / 2.8) % state.doc.projects.length].id;
      hoverMark.show(idle ? stroll : (hoverId !== activeId ? hoverId : null));
      activeMark.show(activeId);
      pointer.visible = idle;
      if (idle) {
        const v = byId[stroll].grp.position;
        pointer.position.set(v.x + 3.6, FLOOR + 3.4 + Math.sin(t * 2.2) * 0.25, ROW_Z + 5.6);
      }

      // a fresh print unrolls from its top edge
      printing = Math.min(1, printing + dt / 0.7);
      print.scale.y = 0.04 + 0.96 * smoothstep(0, 1, printing);

      // the lab: the original slides in, then its three sizes come out one by one
      const f = (t * 0.14) % 1;
      intake.position.x = 9.4 - smoothstep(0.02, 0.3, f) * 6.2;
      origMesh.material.opacity = 1 - smoothstep(0.24, 0.32, f);
      prints.forEach((m, i) => {
        m.material.opacity = smoothstep(0.34 + i * 0.1, 0.42 + i * 0.1, f) * (1 - smoothstep(0.92, 1, f));
      });
      glass.material.emissiveIntensity = 0.3 + Math.sin(t * 0.9) * 0.08;
    },
  };
}
