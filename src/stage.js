// stage.js — renderer, scene, lights, sky, fog, render loop.
// The "stage" is the reusable 3D environment everything is placed into.
import * as THREE from 'three';
import { ACTIVE } from './themes.js';

function makeSkyTexture(stops = ['#d7cab2', '#e6dcc7', '#efe6d4']) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, stops[0]); // zenith
  grad.addColorStop(0.55, stops[1]);
  grad.addColorStop(1.0, stops[2]); // horizon, pale
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  // phones: cap the pixel ratio lower — 3× DPR screens would render 9× the pixels
  // of the desktop budget for no visible gain at arm's length
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = ACTIVE.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // the sun never moves and almost nothing that casts does: the shadow map is redrawn
  // every other frame (see loop), not once per render pass
  renderer.shadowMap.autoUpdate = false;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // Soft vertical sky gradient + fog matching the horizon band, both from the active
  // theme so a theme switch restyles the whole atmosphere (see applyTheme below).
  scene.background = makeSkyTexture(ACTIVE.sky);
  scene.fog = new THREE.Fog(new THREE.Color(ACTIVE.fog).getHex(), ACTIVE.fogNear, ACTIVE.fogFar);

  // Lighting: a soft warm key (sun) + cool sky fill (hemisphere) for gentle
  // form-reading shadows without harsh contrast — reads like watercolor light.
  const hemi = new THREE.HemisphereLight(
    new THREE.Color(ACTIVE.hemiSky), new THREE.Color(ACTIVE.hemiGround), ACTIVE.hemiInt);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(new THREE.Color(ACTIVE.sunColor), ACTIVE.sunInt);
  sun.position.set(-520, 720, 420);
  sun.castShadow = ACTIVE.sunShadow;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 80;
  sun.shadow.camera.far = 2400;
  const S = 920;
  sun.shadow.camera.left = -S;
  sun.shadow.camera.right = S;
  sun.shadow.camera.top = S;
  sun.shadow.camera.bottom = -S;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);

  // A faint warm ambient so deep shadows never go fully black (ink, not void).
  const ambient = new THREE.AmbientLight(new THREE.Color(ACTIVE.ambient), ACTIVE.ambientInt);
  scene.add(ambient);

  // Re-apply the active theme's atmosphere in place (called on a live theme switch).
  function applyTheme() {
    renderer.toneMappingExposure = ACTIVE.exposure;
    scene.background = makeSkyTexture(ACTIVE.sky);
    scene.fog.color.set(ACTIVE.fog);
    scene.fog.near = ACTIVE.fogNear; scene.fog.far = ACTIVE.fogFar;
    hemi.color.set(ACTIVE.hemiSky); hemi.groundColor.set(ACTIVE.hemiGround);
    hemi.intensity = ACTIVE.hemiInt;
    sun.color.set(ACTIVE.sunColor); sun.intensity = ACTIVE.sunInt;
    sun.castShadow = ACTIVE.sunShadow;
    ambient.color.set(ACTIVE.ambient); ambient.intensity = ACTIVE.ambientInt;
  }

  const clock = new THREE.Clock();
  const updaters = new Set();
  let camera = null;

  function setCamera(cam) { camera = cam; }
  function onFrame(cb) { updaters.add(cb); return () => updaters.delete(cb); }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    if (camera && camera.isPerspectiveCamera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  window.addEventListener('resize', resize);

  let running = false;
  let renderHook = null; // optional override (e.g. postprocessing composer)
  function setRenderHook(fn) { renderHook = fn; }

  // What a frame costs, summed over EVERY pass it makes (shadows, the portal's
  // window, the picture itself): renderer.info is reset once per frame, not per pass.
  renderer.info.autoReset = false;
  const stats = { fps: 0, ms: 0, update: 0, calls: 0, triangles: 0, pixelRatio: renderer.getPixelRatio() };
  let frames = 0, since = performance.now(), spentUpdating = 0, frameNo = 0;

  // ADAPTIVE RESOLUTION. The one cost that scales with the screen is the number of
  // pixels, and it is the first thing a modest GPU chokes on (a 2× display draws four
  // times the pixels of a 1× one). When frames run long the picture is rendered at a
  // lower pixel ratio; when there has been headroom for a while it goes back up.
  const maxRatio = renderer.getPixelRatio(), minRatio = Math.min(maxRatio, 0.75);
  let ratio = maxRatio, calm = 0, warmup = 6, holdUntil = 0;
  const setRatio = (r) => { ratio = r; renderer.setPixelRatio(r); resize(); };
  function adapt(now) {
    if (warmup > 0) { warmup--; return; }            // shaders are still compiling
    if (document.hidden || stats.ms > 250) return;   // the tab was away: not a slow frame
    if (stats.ms > 27 && ratio > minRatio) {
      setRatio(Math.max(minRatio, ratio - 0.25)); calm = 0; holdUntil = now + 20000;
    } else if (stats.ms < 17.5 && ratio < maxRatio && now > holdUntil) {
      if (++calm >= 6) { setRatio(Math.min(maxRatio, ratio + 0.25)); calm = 0; }
    } else calm = 0;
  }

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const t0 = performance.now();
    updaters.forEach((cb) => cb(t, dt));
    spentUpdating += performance.now() - t0;
    if ((frameNo++ & 1) === 0) renderer.shadowMap.needsUpdate = true;
    if (renderHook) renderHook(t, dt);
    else if (camera) renderer.render(scene, camera);

    stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    renderer.info.reset();
    frames++;
    const now = performance.now();
    if (now - since >= 500) {
      stats.ms = (now - since) / frames; stats.fps = 1000 / stats.ms; stats.update = spentUpdating / frames;
      frames = 0; since = now; spentUpdating = 0;
      adapt(now);
      stats.pixelRatio = renderer.getPixelRatio();
    }
  }
  // WARM-UP. A mesh costs nothing until the first frame it is drawn in — and then, all
  // at once, its buffers are uploaded, its textures sent, its shader compiled. Left
  // alone that bill falls due in the middle of the first dive into each city, as a
  // stutter. So the whole world is drawn once up front, from straight above, where
  // nobody sees it: into a single pixel of the screen (the programs the picture uses)
  // and into a tiny target (the ones the portal window uses).
  function warm(reach = 2400) {
    const eye = new THREE.OrthographicCamera(-reach, reach, reach, -reach, 1, 6000);
    eye.position.set(0, 3000, 0); eye.lookAt(0, 0, 0);
    eye.layers.enableAll();
    eye.updateMatrixWorld();
    const target = new THREE.WebGLRenderTarget(4, 4);
    const tone = renderer.toneMapping;
    renderer.shadowMap.needsUpdate = true;
    renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true);
    renderer.render(scene, eye);
    renderer.setScissorTest(false);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(target); renderer.render(scene, eye); renderer.setRenderTarget(null);
    renderer.toneMapping = tone;
    target.dispose();
    renderer.info.reset();
  }

  function start() { if (!running) { running = true; clock.start(); loop(); } }
  function stop() { running = false; }

  return {
    renderer, scene, sun, hemi, clock, applyTheme, stats,
    setCamera, onFrame, resize, start, stop, setRenderHook, warm,
    get camera() { return camera; },
  };
}
