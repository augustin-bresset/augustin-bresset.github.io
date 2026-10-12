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
// The window costs a whole second render of the world (and of its shadows). It is only
// LIVE while the visitor is in a city or diving through its portal — and even then
// only on frames where that city's pane is actually in view. The rest of the time
// (the whole overview) every pane just shows a soft idle glow: see uLive in kit.js.
let _active = [];                         // the panes of the city being visited
const _live = { value: 0 };               // shared uniform: 1 = panes show the render target
const _frustum = new THREE.Frustum(), _vp = new THREE.Matrix4();
// …and only the part of the screen the pane covers is drawn: the virtual camera's
// projection is CROPPED to that rectangle (so everything outside it is culled before
// it costs a draw call) and rendered into the matching rectangle of the target.
const _rect = { x: 0, y: 0, w: 1, h: 1 }; // the panes' bounding rectangle, in target pixels
const _crop = new THREE.Matrix4(), _corner = new THREE.Vector4(), _box = new THREE.Box3();
const _eye = new THREE.Vector3();
const _res   = new THREE.Vector2(1, 1);   // drawing-buffer size (shared with disc shader)
const _lift  = new THREE.Matrix4();        // world-space +ΔY translation (horizontal discs)
// WALL portals (vertical, on a façade) need the FULL portal transform M = T_B·inv(T_A):
// looking INTO the wall becomes looking DOWN from the sky exit — a 90° turn, not a
// lift. Set by navigation when the active city's portal is a wall; cleared otherwise.
const _wallM = new THREE.Matrix4();
let _hasWall = false;

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
  get live()       { return _live; },                   // share as the panes' uLive uniform
  // the panes someone may look through right now ([] = none: the window sleeps)
  setActive(panes) { _active = panes || []; _live.value = _active.length ? 1 : 0; },
  get resolution() { return _res; },                    // live Vector2 (share as uniform)
  get liftY()      { return EXIT_H1 - DISC_FACE_Y; },   // ΔY the emerge camera rises by

  // Register a disc mesh so it can be hidden while the virtual camera renders (a disc
  // sampling the RT while we render INTO the RT would be a feedback loop).
  registerDisc(mesh) { if (mesh && !_discs.includes(mesh)) _discs.push(mesh); },

  // Declare the active portal as a WALL at `center` with outward `normal` (world
  // space). Builds M = T_B · inv(T_A): frame A sits on the wall (z = normal), frame
  // B is the horizontal sky exit above it (z = up) — so a gaze INTO the wall maps to
  // a gaze DOWN at the world from EXIT_H1. Cleared → back to the plain disc lift.
  setWallPortal(center, normal) {
    const zA = normal.clone().normalize();
    const xA = new THREE.Vector3(0, 1, 0).cross(zA).normalize();
    const yA = zA.clone().cross(xA).normalize();
    const zB = new THREE.Vector3(0, 1, 0);
    const xB = xA.clone();
    const yB = zB.clone().cross(xB).normalize();
    const A = new THREE.Matrix4().makeBasis(xA, yA, zA).setPosition(center.x, center.y, center.z);
    const B = new THREE.Matrix4().makeBasis(xB, yB, zB).setPosition(center.x, EXIT_H1, center.z);
    _wallM.copy(B).multiply(A.invert());
    _hasWall = true;
  },
  clearWallPortal() { _hasWall = false; },

  // Map a world pose (position + unit direction) through the active portal transform
  // — used by navigation for the seamless camera swap at the end of the dive.
  mapPose(pos, dir) {
    const M = _hasWall ? _wallM : _lift;
    pos.applyMatrix4(M);
    dir.transformDirection(M);
  },

  // Compose the virtual camera from the player camera: same projection, pose pushed
  // through the active portal transform (plain lift for discs, T_B·inv(T_A) for walls).
  update(playerCamera) {
    if (!_camera || !playerCamera) return;
    _camera.matrixWorld.multiplyMatrices(_hasWall ? _wallM : _lift, playerCamera.matrixWorld);
    _camera.matrixWorldInverse.copy(_camera.matrixWorld).invert();
    // the detail worth drawing from up THERE (world.js detailMask), not from where the player stands
    _camera.layers.mask = this.detailMask
      ? this.detailMask(_eye.setFromMatrixPosition(_camera.matrixWorld)) : playerCamera.layers.mask;

    // which part of the screen do the live panes cover this frame?
    _vp.multiplyMatrices(playerCamera.projectionMatrix, playerCamera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_vp);
    let x0 = 1, y0 = 1, x1 = -1, y1 = -1;
    this.inView = false;
    for (const pane of _active) {
      if (!_frustum.intersectsObject(pane)) continue;
      this.inView = true;
      if (!pane.geometry.boundingBox) pane.geometry.computeBoundingBox();
      _box.copy(pane.geometry.boundingBox);
      for (let k = 0; k < 8; k++) {
        _corner.set(k & 1 ? _box.max.x : _box.min.x, k & 2 ? _box.max.y : _box.min.y, k & 4 ? _box.max.z : _box.min.z, 1)
          .applyMatrix4(pane.matrixWorld).applyMatrix4(_vp);
        if (_corner.w < 1e-3) { x0 = y0 = -1; x1 = y1 = 1; break; }   // a corner behind the eye: the whole screen
        x0 = Math.min(x0, _corner.x / _corner.w); x1 = Math.max(x1, _corner.x / _corner.w);
        y0 = Math.min(y0, _corner.y / _corner.w); y1 = Math.max(y1, _corner.y / _corner.w);
      }
    }
    if (!this.inView) return;
    // snapped OUT to whole pixels (plus one of margin), so the window still samples 1:1
    _renderer.getDrawingBufferSize(_res);
    const W = _res.x, H = _res.y;
    const px0 = Math.max(0, Math.floor((x0 * 0.5 + 0.5) * W) - 1), px1 = Math.min(W, Math.ceil((x1 * 0.5 + 0.5) * W) + 1);
    const py0 = Math.max(0, Math.floor((y0 * 0.5 + 0.5) * H) - 1), py1 = Math.min(H, Math.ceil((y1 * 0.5 + 0.5) * H) + 1);
    if (px1 <= px0 || py1 <= py0) { this.inView = false; return; }
    _rect.x = px0; _rect.y = py0; _rect.w = px1 - px0; _rect.h = py1 - py0;
    const nx0 = px0 / W * 2 - 1, nx1 = px1 / W * 2 - 1, ny0 = py0 / H * 2 - 1, ny1 = py1 / H * 2 - 1;
    // clip space → the rectangle stretched over the whole of it
    _crop.set(
      2 / (nx1 - nx0), 0, 0, -(nx0 + nx1) / (nx1 - nx0),
      0, 2 / (ny1 - ny0), 0, -(ny0 + ny1) / (ny1 - ny0),
      0, 0, 1, 0,
      0, 0, 0, 1);
    _camera.projectionMatrix.multiplyMatrices(_crop, playerCamera.projectionMatrix);
    _camera.projectionMatrixInverse.copy(_camera.projectionMatrix).invert();
  },
  inView: false,
  detailMask: null,          // (eye: Vector3) → camera layer mask; set by script.js

  render() {
    if (!_rt || !_renderer || !_scene || !_camera || !this.inView) return;

    // Keep the RT sized to the screen so screen-space sampling stays 1:1.
    _renderer.getDrawingBufferSize(_res);
    if (_rt.width !== _res.x || _rt.height !== _res.y) _rt.setSize(_res.x, _res.y);

    const savedTone = _renderer.toneMapping;
    _renderer.toneMapping = THREE.NoToneMapping;   // RT = linear radiance (shader maps it)

    _rt.viewport.set(_rect.x, _rect.y, _rect.w, _rect.h);
    _rt.scissor.set(_rect.x, _rect.y, _rect.w, _rect.h);
    _rt.scissorTest = true;

    for (const d of _discs) d.visible = false;     // avoid RT feedback
    _renderer.setRenderTarget(_rt);
    _renderer.render(_scene, _camera);
    _renderer.setRenderTarget(null);
    for (const d of _discs) d.visible = true;

    _renderer.toneMapping = savedTone;
  },
};
