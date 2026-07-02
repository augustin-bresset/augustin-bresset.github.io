// script.js — entry point. Boots the stage, resolves the active WORLD from the URL,
// builds it (a grounded terrain world, or the croquis fly-through), wires the camera,
// UI and navigation, then runs the render loop. The top-right button cycles worlds.
import * as THREE from 'three';
import { createStage } from './src/stage.js';
import { CameraRig } from './src/camera.js';
import { buildWorld, WORLD } from './src/world.js';
import { buildCroquis } from './src/croquis.js';
import { UI } from './src/ui.js';
import { Navigation } from './src/navigation.js';
import { LANG, cityLabel } from './src/lang.js';
import { createOutline } from './src/postfx.js';
import { ACTIVE, setTheme } from './src/themes.js';
import { resolveWorld, nextWorld, worldName } from './src/worlds.js';
import { portalRender } from './src/portalRender.js';

const container = document.getElementById('viewport');

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

if (!webglOK()) {
  container.innerHTML =
    '<div class="webgl-fallback"><p>This site renders a 3D world and needs WebGL.</p>' +
    '<p>Please use a modern browser. — Augustin Bresset</p></div>';
} else {
  boot();
}

function boot() {
  const qp = new URLSearchParams(location.search);

  // which WORLD (island / floating / croquis / land) — resolved BEFORE the stage is
  // built so the ambiance (lights/fog/sky/exposure) is right from the first frame.
  const world = resolveWorld(qp);
  setTheme(world.ambiance);

  const stage = createStage(container);

  const urlSeed = qp.get('seed');
  const seed = urlSeed != null
    ? (parseInt(urlSeed, 10) >>> 0)
    : (crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0;

  // Strip ?seed= from the URL immediately so a plain F5 always generates a fresh
  // world. goToWorld() briefly puts the seed back to pass it to the next page load,
  // which then strips it again — so the "same place, different style" switch works
  // for one hop without permanently locking the seed in the address bar.
  if (urlSeed != null) {
    const clean = new URLSearchParams(location.search);
    clean.delete('seed');
    const qs = clean.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname + location.hash);
  }

  // initial language: ?lang= override, else browser preference (FR for francophones)
  const navLang = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  LANG.current = qp.get('lang') === 'fr' ? 'fr' : qp.get('lang') === 'en' ? 'en' : navLang;

  const ui = new UI();
  // paper-grain boost lives on <body> in the sketch/croquis ambiance
  document.body.classList.toggle('theme-sketch', world.ambiance === 'sketch');

  // --- WORLD selector button (top-right): cycle to the next world and reload, keeping
  // the same seed + language so it feels like stepping into another version of the
  // same place. This replaces the old theme toggle. ---
  const goToWorld = (key) => {
    const p = new URLSearchParams(location.search);
    p.set('world', key); p.set('lang', LANG.current);
    p.delete('mode'); p.delete('theme');
    location.search = p.toString();
  };
  if (ui.themeBtn) {
    ui.themeBtn.textContent = worldName(world, LANG.current);
    ui.themeBtn.title = 'Change world';
    ui.themeBtn.addEventListener('click', () => goToWorld(nextWorld(world.key).key));
  }

  // language toggle (common): relabel the buttons + hint; terrain worlds also relabel
  // their city plaques (hooked in below).
  const onLang = [];
  ui.langBtn.addEventListener('click', () => {
    LANG.current = LANG.current === 'en' ? 'fr' : 'en';
    ui.refreshLang();
    if (ui.themeBtn) ui.themeBtn.textContent = worldName(world, LANG.current);
    onLang.forEach((f) => f());
  });

  // ===================== CROQUIS: the endless fly-through drawing =====================
  if (world.croquis) {
    const croquis = buildCroquis(stage, container, seed);
    stage.scene.add(croquis.group);
    stage.setCamera(croquis.camera);
    if (croquis.resize) window.addEventListener('resize', croquis.resize);
    ui.setLegend(false);
    ui.setBack(false);
    ui.showHint('croquisHint');

    // ---- clickable project balloons: a short card with links, pinned to the craft.
    // Picking is a GENEROUS screen-space test, not a precise raycast: steering
    // follows the pointer, so the camera keeps turning while you aim — the craft
    // slides under the cursor and an exact mesh hit is nearly impossible to land.
    const BALLOON_ACCENT = { toast: '#e10600', splash: '#3b82f6', apairo: '#dda42a', gear: '#c4763a' };
    const v = new THREE.Vector3();
    let opened = null;                        // { group, theme } of the open card
    let down = null;
    const el = stage.renderer.domElement;
    const pickBalloon = (cx, cy) => {
      const r = el.getBoundingClientRect();
      let best = null, bestD = Infinity;
      for (const b of croquis.balloons) {
        v.copy(b.group.position);
        v.sub(croquis.camera.position);
        const dist = v.length();
        if (dist > 750) continue;                       // lost in the fog anyway
        v.copy(b.group.position).project(croquis.camera);
        if (v.z > 1 || v.z < -1) continue;              // behind the camera
        const sx = r.left + (v.x * 0.5 + 0.5) * r.width;
        const sy = r.top + (-v.y * 0.5 + 0.5) * r.height;
        // apparent radius in px (craft ~28u across) + a fat grace margin
        const fovScale = (r.height / 2) / Math.tan((croquis.camera.fov / 2) * Math.PI / 180);
        const rad = Math.max(34, (28 / dist) * fovScale * 1.25);
        const d = Math.hypot(cx - sx, cy - sy);
        if (d < rad && d < bestD) { best = b; bestD = d; }
      }
      return best;
    };
    const placeCard = () => {
      if (!opened) return;
      v.copy(opened.group.position); v.y += 8;
      v.project(croquis.camera);
      if (v.z > 1) { opened = null; ui.hideNote(); return; }   // drifted behind us
      const r = el.getBoundingClientRect();
      const x = r.left + (v.x * 0.5 + 0.5) * r.width;
      const y = r.top + (-v.y * 0.5 + 0.5) * r.height;
      ui.positionNote(x, y, x > r.left + r.width * 0.52 ? 'left' : 'right');
    };
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 14) return;
      const b = pickBalloon(e.clientX, e.clientY);
      if (b) {
        opened = b;
        ui.showNote('croquis', b.theme, BALLOON_ACCENT[b.theme]);
        placeCard();
      } else if (opened) { opened = null; ui.hideNote(); }
    });
    // cursor affordance: show a pointer whenever a craft is within click range
    el.addEventListener('pointermove', (e) => {
      el.style.cursor = pickBalloon(e.clientX, e.clientY) ? 'pointer' : 'grab';
    });
    document.getElementById('note-close').addEventListener('click', () => { opened = null; ui.hideNote(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && opened) { opened = null; ui.hideNote(); } });

    stage.onFrame((t, dt) => { croquis.update(t, dt); placeCard(); });
    stage.start();
    return;
  }

  // ===================== grounded worlds: island / floating / land =====================
  // Initialise the portal render target BEFORE buildWorld so the texture reference
  // exists when makePortal() attaches it to the disc material inside each city build.
  portalRender.init(stage.renderer, stage.scene);
  const worldObj = buildWorld(stage, seed, { mode: world.mode });
  stage.scene.add(worldObj.group);

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rig = new CameraRig(container, WORLD.half);
  if (reduceMotion) rig.idleDrift = false;
  // open the home view toward the generated mountain mass (computed in world.js) so
  // there are always real mountains on the horizon ahead.
  if (worldObj.scenicAzimuth != null) {
    rig.azimuth = rig._azim = rig.home.azimuth = worldObj.scenicAzimuth;
    rig.apply();
  }
  stage.setCamera(rig.camera);

  // dev camera override (only fires when a param is present): ?pol=&rad=&az=&tx=&tz=&ty=
  {
    const num = (k) => (qp.has(k) ? parseFloat(qp.get(k)) : null);
    const D2R = Math.PI / 180;
    const pol = num('pol'), rad = num('rad'), az = num('az');
    const tx = num('tx'), tz = num('tz'), ty = num('ty');
    if (pol != null) rig.polar = rig._pol = pol * D2R;
    if (rad != null) rig.radius = rig._rad = rad;
    if (az != null) rig.azimuth = rig._azim = rig.home.azimuth = az * D2R;
    if (tx != null) { rig.target.x = tx; rig._tgt.x = tx; }
    if (tz != null) { rig.target.z = tz; rig._tgt.z = tz; }
    if (ty != null) { rig.target.y = ty; rig._tgt.y = ty; }
    if (pol != null || rad != null || az != null || tx != null || tz != null || ty != null) {
      rig.idleDrift = false; rig.apply();
    }
  }

  const nav = new Navigation(stage, rig, worldObj, ui);
  document.getElementById('note-close').addEventListener('click', () => nav.closeNote());
  ui.buildLegend(worldObj.cities, (id) => nav.diveTo(id));

  // Ink outline pass — inert unless a world's ambiance asks for it (all four use plain
  // rendering today, but the hook stays so an ambiance can opt in later).
  const outline = createOutline(stage.renderer, stage.scene, () => rig.camera, container);
  const syncOutline = () => {
    outline.setStrength(ACTIVE.outlineStrength); outline.setInk(ACTIVE.ink);
    outline.setWash(ACTIVE.desat || 0, ACTIVE.wash || 0, ACTIVE.washTone, ACTIVE.hatch || 0);
  };
  syncOutline();
  stage.setRenderHook(() => {
    // Portal window: compose the virtual camera from the player camera (same view,
    // lifted into the sky) and render the world into the portal texture.
    portalRender.update(rig.camera);
    portalRender.render();
    if (ACTIVE.outline) outline.render();
    else stage.renderer.render(stage.scene, rig.camera);
  });

  // city labels + language relabel hook
  applyCityLabels(worldObj);
  onLang.push(() => applyCityLabels(worldObj));

  stage.onFrame((t, dt) => {
    rig.update(t, dt);
    for (const u of worldObj.updaters) u(t, dt);
    nav.tick();                       // keep an open field-note pinned to its marker
  });

  stage.start();

  // deep-link straight into a project, e.g. ?focus=toaster (optionally &poi=ensta)
  const poi = qp.get('poi');
  if (poi) nav.pendingPoi = poi;
  const f = qp.get('focus');
  if (f) setTimeout(() => nav.diveTo(f), 600);
  const sn = qp.get('snap');
  if (sn && nav.snapTo) nav.snapTo(sn);
}

function applyCityLabels(world) {
  for (const c of world.cities) {
    if (c.label) c.label.setText(...cityLabel(c.id, LANG.current));
  }
}
