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
  const S = 820;
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

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    updaters.forEach((cb) => cb(t, dt));
    if (renderHook) renderHook(t, dt);
    else if (camera) renderer.render(scene, camera);
  }
  function start() { if (!running) { running = true; clock.start(); loop(); } }
  function stop() { running = false; }

  return {
    renderer, scene, sun, hemi, clock, applyTheme,
    setCamera, onFrame, resize, start, stop, setRenderHook,
    get camera() { return camera; },
  };
}
