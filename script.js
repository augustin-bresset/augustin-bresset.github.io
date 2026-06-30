// script.js — entry point. Boots the stage, builds the procedural world,
// wires the camera rig, UI and navigation, then runs the render loop.
import { createStage } from './src/stage.js';
import { CameraRig } from './src/camera.js';
import { buildWorld, WORLD } from './src/world.js';
import { UI } from './src/ui.js';
import { Navigation } from './src/navigation.js';
import { LANG, cityLabel } from './src/lang.js';
import { createOutline } from './src/postfx.js';

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
  const stage = createStage(container);

  const urlSeed = qp.get('seed');
  const seed = urlSeed != null
    ? (parseInt(urlSeed, 10) >>> 0)
    : (crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0;

  // initial language: ?lang= override, else browser preference (FR for francophones)
  const navLang = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  LANG.current = qp.get('lang') === 'fr' ? 'fr' : qp.get('lang') === 'en' ? 'en' : navLang;

  const world = buildWorld(stage, seed);
  stage.scene.add(world.group);

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rig = new CameraRig(container, WORLD.half);
  if (reduceMotion) rig.idleDrift = false;
  // open the home view toward the generated mountain mass (computed in world.js) so
  // there are always real mountains on the horizon ahead.
  if (world.scenicAzimuth != null) {
    rig.azimuth = rig._azim = rig.home.azimuth = world.scenicAzimuth;
    rig.apply();
  }
  stage.setCamera(rig.camera);

  const ui = new UI();
  const nav = new Navigation(stage, rig, world, ui);
  document.getElementById('note-close').addEventListener('click', () => nav.closeNote());
  ui.buildLegend(world.cities, (id) => nav.diveTo(id));

  // experimental ink outline — opt-in (?outline=1). The painterly grain+vignette
  // overlay is the default look; depth-outline gets busy in dense foliage.
  if (qp.get('outline') === '1') {
    const outline = createOutline(stage.renderer, stage.scene, () => rig.camera, container);
    if (qp.has('ostr')) outline.setStrength(+qp.get('ostr'));
    stage.setRenderHook(() => outline.render());
  }

  // language toggle: button + city labels + panel + hint
  applyCityLabels(world);
  ui.langBtn.addEventListener('click', () => {
    LANG.current = LANG.current === 'en' ? 'fr' : 'en';
    ui.refreshLang();
    applyCityLabels(world);
  });

  stage.onFrame((t, dt) => {
    rig.update(t, dt);
    for (const u of world.updaters) u(t, dt);
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
