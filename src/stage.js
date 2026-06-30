// stage.js — renderer, scene, lights, sky, fog, render loop.
// The "stage" is the reusable 3D environment everything is placed into.
import * as THREE from 'three';

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#d7cab2'); // zenith
  grad.addColorStop(0.55, '#e6dcc7');
  grad.addColorStop(1.0, '#efe6d4'); // horizon, pale
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // Soft vertical sky gradient (deeper warm above, pale near the horizon) so the
  // sea fades seamlessly into the sky. Fog colour matches the horizon band.
  const HORIZON = new THREE.Color('#ece3d0');
  scene.background = makeSkyTexture();
  // fog closes the distance so the big terrain fades to the horizon haze well before
  // its far square edge — the edge sits past `far` and is never visible.
  scene.fog = new THREE.Fog(HORIZON.getHex(), 560, 1400);

  // Lighting: a soft warm key (sun) + cool sky fill (hemisphere) for gentle
  // form-reading shadows without harsh contrast — reads like watercolor light.
  const hemi = new THREE.HemisphereLight(0xfdf6e6, 0x7a6a50, 0.78);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1d6, 1.12);
  sun.position.set(-520, 720, 420);
  sun.castShadow = true;
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
  scene.add(new THREE.AmbientLight(0x5a4a36, 0.42));

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
    renderer, scene, sun, hemi, clock,
    setCamera, onFrame, resize, start, stop, setRenderHook,
    get camera() { return camera; },
  };
}
