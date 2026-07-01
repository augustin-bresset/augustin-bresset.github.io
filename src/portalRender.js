// portalRender.js — true "window" portal (seamless Portal-style cut).
//
// GOAL: the last frame before entering the portal == the first frame after.
//
// MECHANISM:
//   The portal disc is a WINDOW, not a coin with a picture. Its fragment shader
//   samples the render target by SCREEN position (gl_FragCoord / resolution), and
//   the virtual camera that fills that target uses the SAME projection as the player.
//   So wherever the disc covers the screen, it shows exactly the frame the player
//   would see from the virtual camera. When the disc fills the whole screen (end of
//   the perpendicular dive), swapping the player camera to the virtual pose changes
//   nothing on screen — the cut is invisible.
//
//   Virtual camera = player camera lifted by ΔY = H1 − discFaceY (world-space Y).
//   Because every portal disc is horizontal at the same height, this lift is a single
//   constant translation — no per-disc transform needed (until portals gain tilt).
//   Klein-bottle topology: dive straight down into the floor disc → emerge high in the
//   sky (H1) looking straight down at the world.
//
// COLOR: the RT is rendered in LINEAR radiance (tone mapping forced off during the RT
// pass). The disc shader then applies the SAME ACES tone map + sRGB encode the main
// renderer uses, so window pixels match the surrounding world pixels at the seam.
import * as THREE from 'three';

export const DISC_FACE_Y = 3.35;   // world height of a portal disc face (pedestal top)
export const EXIT_H1     = 900;    // sky height of the Klein-bottle exit portal

let _renderer = null, _scene = null, _rt = null, _camera = null;
const _discs = [];                        // portal disc meshes to hide during RT render
const _res   = new THREE.Vector2(1, 1);   // drawing-buffer size (shared with disc shader)
const _lift  = new THREE.Matrix4();        // world-space +ΔY translation

export const portalRender = {
  init(renderer, scene) {
    _renderer = renderer;
    _scene    = scene;

    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    _res.set(Math.max(2, s.x), Math.max(2, s.y));
    _rt = new THREE.WebGLRenderTarget(_res.x, _res.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      // linear colour space: the RT holds linear radiance, tone-mapped in the shader.
    });

    _camera = new THREE.PerspectiveCamera();
    _camera.matrixAutoUpdate = false;   // matrixWorld composed by hand each frame
    _lift.makeTranslation(0, EXIT_H1 - DISC_FACE_Y, 0);
  },

  get texture()    { return _rt ? _rt.texture : null; },
  get resolution() { return _res; },                    // live Vector2 (share as uniform)
  get liftY()      { return EXIT_H1 - DISC_FACE_Y; },   // ΔY the emerge camera rises by

  // Register a disc mesh so it can be hidden while the virtual camera renders (a disc
  // sampling the RT while we render INTO the RT would be a feedback loop).
  registerDisc(mesh) { if (mesh && !_discs.includes(mesh)) _discs.push(mesh); },

  // Compose the virtual camera from the player camera: same orientation & projection,
  // position lifted by ΔY in world space.
  update(playerCamera) {
    if (!_camera || !playerCamera) return;
    _camera.matrixWorld.multiplyMatrices(_lift, playerCamera.matrixWorld);
    _camera.matrixWorldInverse.copy(_camera.matrixWorld).invert();
    _camera.projectionMatrix.copy(playerCamera.projectionMatrix);
    _camera.projectionMatrixInverse.copy(playerCamera.projectionMatrixInverse);
  },

  render() {
    if (!_rt || !_renderer || !_scene || !_camera) return;

    // Keep the RT sized to the screen so screen-space sampling stays 1:1.
    _renderer.getDrawingBufferSize(_res);
    if (_rt.width !== _res.x || _rt.height !== _res.y) _rt.setSize(_res.x, _res.y);

    const savedTone = _renderer.toneMapping;
    _renderer.toneMapping = THREE.NoToneMapping;   // RT = linear radiance (shader maps it)

    for (const d of _discs) d.visible = false;     // avoid RT feedback
    _renderer.setRenderTarget(_rt);
    _renderer.render(_scene, _camera);
    _renderer.setRenderTarget(null);
    for (const d of _discs) d.visible = true;

    _renderer.toneMapping = savedTone;
  },
};
