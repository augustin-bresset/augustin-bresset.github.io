// camera.js — oblique top-down ("3/4 view") camera rig with controls.
// Not bird's-eye: the camera sits at a polar angle so we see the sides of
// hills and buildings, like Zelda / Stardew / a tabletop diorama.
import * as THREE from 'three';

export class CameraRig {
  constructor(container, worldRadius = 160) {
    this.container = container;
    this.camera = new THREE.PerspectiveCamera(
      42, container.clientWidth / container.clientHeight, 3, 3200
    );

    // Spherical-ish orbit around a movable target on the ground plane.
    // IMMERSIVE framing: we sit *inside* the continent so the land fills the frame
    // and runs off into the horizon mist — never far enough out to see the map's
    // finite edge (that's why there's a clickable legend to reach the settlements).
    this.target = new THREE.Vector3(0, 16, 0);
    this.azimuth = Math.PI * 0.25;     // rotation around Y
    // HORIZON VISTA: look OUT at the world (not straight down) so the big generated
    // terrain runs off to a hazy horizon with natural mountains on the skyline,
    // instead of ending at a chunked edge. A pure top-down diorama can't frame a
    // horizon at all (the skyline sits above the top of frame).
    this.polar = THREE.MathUtils.degToRad(70); // oblique, tilted toward the horizon
    this.radius = worldRadius * 0.95;          // immersed, not a far overview

    this.minRadius = 70;
    // The terrain grid is far larger than this reference radius and its square edge
    // sits well past the fog wall, so the camera stays IMMERSED and central: cap the
    // zoom-out and clamp the pan target to a tight disc (see _clampTarget) — you can
    // roam to every settlement but never out toward where the edge would be.
    this.maxRadius = worldRadius * 1.02;
    this.minPolar = THREE.MathUtils.degToRad(45);
    this.maxPolar = THREE.MathUtils.degToRad(74);

    this.idleDrift = true;       // slow auto-rotation when not interacting
    this.idleSpeed = 0.012;      // rad/sec
    this._lastInteract = -999;

    // smoothed (damped) state
    this._azim = this.azimuth;
    this._pol = this.polar;
    this._rad = this.radius;
    this._tgt = this.target.clone();

    this.enabled = true;
    // in a settlement we orbit AROUND the buildings: a plain drag rotates (instead of
    // panning the map away), so you can walk the camera around and see every façade.
    this.orbitOnly = false;
    this.tween = null;
    this.home = {
      azimuth: this.azimuth, polar: this.polar, radius: this.radius,
      target: this.target.clone(),
    };
    this._bind();
    this.apply();
  }

  // Cinematic move to a goal over `dur` seconds (eased). Disables input meanwhile.
  focusOn(goal, dur = 1.3) {
    this.tween = {
      t: 0, dur,
      from: { azim: this._azim, pol: this._pol, rad: this._rad, tgt: this._tgt.clone() },
      to: {
        azim: goal.azimuth ?? this._azim,
        pol: goal.polar ?? this._pol,
        rad: goal.radius ?? this._rad,
        tgt: goal.target ? goal.target.clone() : this._tgt.clone(),
      },
      onDone: goal.onDone || null,
    };
    this.enabled = false;
    this.idleDrift = false;
  }

  resetView(dur = 1.2) {
    this.focusOn({
      azimuth: this.home.azimuth, polar: this.home.polar,
      radius: this.home.radius, target: this.home.target.clone(),
      onDone: () => { this.enabled = true; this.idleDrift = true; },
    }, dur);
  }

  _bind() {
    const el = this.container;
    let dragging = false, lastX = 0, lastY = 0, button = 0;

    const down = (e) => {
      if (!this.enabled) return;
      dragging = true; button = e.button;
      lastX = e.clientX; lastY = e.clientY;
      this._lastInteract = performance.now() / 1000;
    };
    const move = (e) => {
      if (!dragging || !this.enabled) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      this._lastInteract = performance.now() / 1000;
      if (this.orbitOnly || e.shiftKey || button === 2) {
        // rotate/orbit (the default drag inside a settlement — see orbitOnly)
        this.azimuth -= dx * 0.005;
        this.polar = THREE.MathUtils.clamp(this.polar - dy * 0.004, this.minPolar, this.maxPolar);
      } else {
        // Pan the target across the ground, screen-relative, so the ground point
        // under the cursor stays under the cursor ("grab and drag the map").
        // Camera screen-right (world) = (cos, 0, -sin); screen-up-into-scene =
        // (-sin, 0, -cos). Moving the target OPPOSITE the cursor in that basis is
        // what makes a left-drag feel natural at ANY azimuth (the old matrix had
        // the wrong handedness, so it only felt right at azimuth 0 and looked
        // inverted once the view rotated / idle-drifted).
        const panScale = this.radius * 0.0016;
        const cos = Math.cos(this.azimuth), sin = Math.sin(this.azimuth);
        this.target.x -= (dx * cos + dy * sin) * panScale;
        this.target.z -= (dy * cos - dx * sin) * panScale;
        this._clampTarget();
      }
    };
    const up = () => { dragging = false; };

    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this._lastInteract = performance.now() / 1000;
      const factor = Math.exp(e.deltaY * 0.0012);
      this.radius = THREE.MathUtils.clamp(this.radius * factor, this.minRadius, this.maxRadius);
    }, { passive: false });

    // touch: one finger pan, two finger pinch-zoom
    let pinchDist = 0;
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        if (pinchDist) {
          this.radius = THREE.MathUtils.clamp(this.radius * (pinchDist / d), this.minRadius, this.maxRadius);
        }
        pinchDist = d;
        this._lastInteract = performance.now() / 1000;
      }
    }, { passive: true });
  }

  _clampTarget() {
    // Keep the panned target inside a tight CENTRAL disc so you can never slide the
    // view out toward the big terrain's far edge (which fog already hides). All cities
    // are placed inside this same disc (see cities/placement.js) so every settlement
    // is reachable by panning.
    const R = 300;
    const d = Math.hypot(this.target.x, this.target.z);
    if (d > R) {
      const s = R / d;
      this.target.x *= s;
      this.target.z *= s;
    }
  }

  // Programmatic move (used by navigation dive). Returns nothing; smoothing eases to it.
  flyTo({ target, azimuth, polar, radius }) {
    if (target) this.target.copy(target);
    if (azimuth !== undefined) this.azimuth = azimuth;
    if (polar !== undefined) this.polar = THREE.MathUtils.clamp(polar, this.minPolar * 0.6, this.maxPolar * 1.2);
    if (radius !== undefined) this.radius = radius;
  }

  update(t, dt) {
    // cinematic tween takes over when active
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - Math.pow(-2 * tw.t + 2, 2) / 2; // easeInOutQuad
      this._azim = tw.from.azim + (tw.to.azim - tw.from.azim) * e;
      this._pol = tw.from.pol + (tw.to.pol - tw.from.pol) * e;
      this._rad = tw.from.rad + (tw.to.rad - tw.from.rad) * e;
      this._tgt.lerpVectors(tw.from.tgt, tw.to.tgt, e);
      // keep desired state synced so post-tween input continues smoothly
      this.azimuth = this._azim; this.polar = this._pol;
      this.radius = this._rad; this.target.copy(this._tgt);
      this.apply();
      if (tw.t >= 1) { const cb = tw.onDone; this.tween = null; if (cb) cb(); }
      return;
    }

    // idle auto-drift after a few seconds of no interaction
    const now = performance.now() / 1000;
    if (this.idleDrift && now - this._lastInteract > 4) {
      this.azimuth += this.idleSpeed * dt;
    }
    // critically-damped smoothing toward desired state
    const k = 1 - Math.pow(0.0001, dt); // ~time-constant smoothing
    this._azim += (this.azimuth - this._azim) * k;
    this._pol += (this.polar - this._pol) * k;
    this._rad += (this.radius - this._rad) * k;
    this._tgt.lerp(this.target, k);
    this.apply();
  }

  apply() {
    const sinPol = Math.sin(this._pol);
    const x = this._tgt.x + this._rad * sinPol * Math.sin(this._azim);
    const y = this._tgt.y + this._rad * Math.cos(this._pol);
    const z = this._tgt.z + this._rad * sinPol * Math.cos(this._azim);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this._tgt);
  }
}
