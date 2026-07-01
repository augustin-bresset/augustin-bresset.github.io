// script.js — entry point. Boots the stage, resolves the active WORLD from the URL,
// builds it (a grounded terrain world, or the croquis fly-through), wires the camera,
// UI and navigation, then runs the render loop. The top-right button cycles worlds.
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
    p.set('world', key); p.set('seed', String(seed)); p.set('lang', LANG.current);
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
    stage.onFrame((t, dt) => croquis.update(t, dt));
    stage.start();
    return;
  }

  // ===================== grounded worlds: island / floating / land =====================
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
