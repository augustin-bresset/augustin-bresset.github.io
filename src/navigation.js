// navigation.js — raycast picking + the cinematic "dive" into a settlement.
// Overview: click a city to dive in. Inside a city: click a glowing marker (or its
// building) to open that landmark's field note; click the orb to fly home. The note
// is pinned in screen space beside the marker and re-projected each frame.
import * as THREE from 'three';
import { portalRender } from './portalRender.js';

export class Navigation {
  constructor(stage, rig, world, ui) {
    this.stage = stage;
    this.rig = rig;
    this.world = world;
    this.ui = ui;
    this.cities = world.cities;
    this.cityGroups = world.cities.map((c) => c.group);
    this.byId = Object.fromEntries(world.cities.map((c) => [c.id, c]));

    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this._v = new THREE.Vector3();
    this.hovered = null;             // overview: hovered city
    this.state = 'overview';         // 'overview' | 'diving' | 'city'

    this.activeCity = null;
    this._poiById = {};
    this._hoverPoi = null;           // city: hovered POI id
    this.openPoiId = null;           // city: open note's POI id
    this.openSide = 'right';
    this.pendingPoi = null;          // deep-link ?poi= to open after diving
    this._down = null;

    this._bind();
  }

  _bind() {
    const el = this.stage.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { this._down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointermove', (e) => this._onMove(e));
    el.addEventListener('pointerup', (e) => this._onUp(e));

    this.ui.backBtn.addEventListener('click', () => this.back());
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.openPoiId) this.closeNote();
      else if (this.state === 'city') this.back();
    });
  }

  // raycast the city groups; returns {cityId, portal, poi, portalPoint, portalNormal}.
  // portalPoint  — world-space hit position on the portal disc surface.
  // portalNormal — world-space face normal of the portal (from userData.portalNormal,
  //                so future portals with custom tilt just set that field).
  _pick(e) {
    const r = this.stage.renderer.domElement.getBoundingClientRect();
    this.ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    this.ray.setFromCamera(this.ndc, this.rig.camera);
    const hits = this.ray.intersectObjects(this.cityGroups, true);
    for (const h of hits) {
      let o = h.object, cityId = null, portal = false, poi = null, portalNormal = null;
      while (o) {
        if (o.userData.portal) portal = true;
        if (o.userData.portalNormal && !portalNormal) {
          // Transform the stored local normal to world space via the group's rotation.
          // For the current horizontal disc (Y-only rotation) this stays (0,1,0).
          // Future tilted portals just update userData.portalNormal accordingly.
          portalNormal = o.userData.portalNormal.clone()
            .transformDirection(o.matrixWorld).normalize();
        }
        if (o.userData.poi && !poi) poi = o.userData.poi;
        if (o.userData.cityId && !cityId) cityId = o.userData.cityId;
        o = o.parent;
      }
      if (cityId || portal || poi) {
        return {
          cityId, portal, poi,
          portalPoint:  portal ? h.point.clone() : null,
          portalNormal: portal ? (portalNormal ?? new THREE.Vector3(0, 1, 0)) : null,
        };
      }
    }
    return { cityId: null, portal: false, poi: null, portalPoint: null, portalNormal: null };
  }

  _onMove(e) {
    const cursor = this.stage.renderer.domElement.style;
    if (this.state === 'overview') {
      const { cityId } = this._pick(e);
      if (cityId !== this.hovered) {
        this.hovered = cityId;
        cursor.cursor = cityId ? 'pointer' : 'grab';
      }
    } else if (this.state === 'city') {
      const { poi, portal } = this._pick(e);
      if (poi !== this._hoverPoi) { this._hoverPoi = poi; this._applyPoiStates(); }
      cursor.cursor = (poi || portal) ? 'pointer' : 'grab';
    }
  }

  _onUp(e) {
    if (!this._down) return;
    const moved = Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y);
    this._down = null;
    if (moved > 6) return;                       // it was a drag, not a click
    if (this.state === 'overview') {
      const { cityId } = this._pick(e);
      if (cityId) this.diveTo(cityId);
    } else if (this.state === 'city') {
      const { poi, portal, portalPoint, portalNormal } = this._pick(e);
      // the portal WINS over a POI: a wall portal lives on a POI-tagged building
      // (the atelier), and diving through it is the more specific intent.
      if (portal) {
        this.portalBack(portalPoint, portalNormal); // Klein-bottle dive through portal
      } else if (poi) {
        if (poi === this.openPoiId) this.closeNote();
        else this.openNote(this._poiById[poi]);
      } else if (this.openPoiId) {
        this.closeNote();                        // click empty space dismisses
      }
    }
  }

  // ---- field notes -------------------------------------------------------
  openNote(poi) {
    if (!poi) return;
    this.openPoiId = poi.id;
    const p = this._project(poi);
    this.openSide = p.side;
    this.ui.showNote(this.activeCity.id, poi.id, poi.accent, p.side);
    this.ui.positionNote(p.x, p.y, p.side);
    this._applyPoiStates();
  }

  closeNote() {
    this.openPoiId = null;
    this.ui.hideNote();
    this._applyPoiStates();
  }

  _project(poi) {
    this.rig.camera.updateMatrixWorld();     // current view, even pre-first-frame
    poi.anchor.getWorldPosition(this._v);
    this._v.project(this.rig.camera);
    const r = this.stage.renderer.domElement.getBoundingClientRect();
    const x = r.left + (this._v.x * 0.5 + 0.5) * r.width;
    const y = r.top + (-this._v.y * 0.5 + 0.5) * r.height;
    const side = x > r.left + r.width * 0.52 ? 'left' : 'right';
    return { x, y, side };
  }

  _applyPoiStates() {
    if (!this.activeCity) return;
    for (const p of (this.activeCity.pois || [])) {
      const st = p.id === this.openPoiId ? 'open'
        : p.id === this._hoverPoi ? 'hover' : 'idle';
      p.setState(st);
    }
  }

  // re-pin the open note each frame (camera can orbit in-city). Called from the render loop.
  tick() {
    if (this.state !== 'city' || !this.openPoiId) return;
    const poi = this._poiById[this.openPoiId];
    if (!poi) return;
    const p = this._project(poi);
    this.ui.positionNote(p.x, p.y, this.openSide);
  }

  // ---- diving ------------------------------------------------------------
  // close 3/4 view onto the settlement. A city may declare a `frame` hint so the
  // dive centres on its hero cluster from a flattering, hand-picked angle (cities
  // are placed but never rotated, so a local target offset + a world azimuth are
  // stable). Without one, fall back to a centred view from the island-inward side.
  _goal(city) {
    const f = city.frame;
    if (f) {
      const target = city.worldPos.clone().add(
        new THREE.Vector3(f.target[0], f.target[1], f.target[2]));
      return {
        target, azimuth: f.azimuth,
        polar: THREE.MathUtils.degToRad(f.polar),
        radius: f.radius,
      };
    }
    const az = Math.atan2(city.worldPos.x, city.worldPos.z) + Math.PI;
    const R = city.radius || 36;
    const target = city.worldPos.clone();
    target.y += R * 0.22;
    return { target, azimuth: az, polar: THREE.MathUtils.degToRad(52), radius: R * 2.25 };
  }

  _enterCity(city) {
    this.state = 'city';
    this.activeCity = city;
    // If this city's portal is a WALL (vertical, on a façade), switch the shared
    // portal camera to the full A→B transform so the window shows the world from
    // above instead of the horizon. Horizontal discs keep the plain lift.
    city.group.updateMatrixWorld(true);
    let wall = null;
    city.group.traverse((o) => {
      if (wall || !o.userData.portalNormal) return;
      const n = o.userData.portalNormal.clone().transformDirection(o.matrixWorld);
      if (n.y < 0.7) {
        const c = (o.userData.portalCenter || new THREE.Vector3()).clone().applyMatrix4(o.matrixWorld);
        wall = { c, n };
      }
    });
    if (wall) portalRender.setWallPortal(wall.c, wall.n);
    else portalRender.clearWallPortal();
    this._poiById = Object.fromEntries((city.pois || []).map((p) => [p.id, p]));
    this._hoverPoi = null;
    this.openPoiId = null;
    this.rig.enabled = true;          // re-enable input after dive animation
    this.rig.orbitOnly = true;        // drag = orbit the settlement (see every façade)
    this._applyPoiStates();
    this.ui.setBack(true);
    this.ui.setLegend(false);
    this.ui.showHint('cityHint');
    if (this.pendingPoi && this._poiById[this.pendingPoi]) {
      const id = this.pendingPoi; this.pendingPoi = null;
      this.openNote(this._poiById[id]);
    }
  }

  diveTo(id) {
    const city = this.byId[id];
    if (!city) return;
    this.state = 'diving';
    this.hovered = null;
    this.stage.renderer.domElement.style.cursor = 'default';
    this.ui.setHint(false);
    this.ui.setLegend(false);
    const goal = this._goal(city);
    goal.onDone = () => this._enterCity(city);
    this.rig.focusOn(goal, 1.4);
  }

  snapTo(id) {
    const city = this.byId[id];
    if (!city) return;
    const g = this._goal(city);
    this.rig._tgt.copy(g.target); this.rig.target.copy(g.target);
    this.rig._azim = this.rig.azimuth = g.azimuth;
    this.rig._pol = this.rig.polar = g.polar;
    this.rig._rad = this.rig.radius = g.radius;
    this.rig.enabled = false; this.rig.idleDrift = false;
    this.rig.apply();
    this._enterCity(city);
  }

  back() {
    if (this.state === 'overview') return;
    this.closeNote();
    this.rig.orbitOnly = false;       // back to map-panning
    this.ui.setBack(false);
    portalRender.clearWallPortal();   // overview discs go back to the plain lift view
    this.activeCity = null;
    this._poiById = {};
    this._hoverPoi = null;
    this.state = 'diving';
    this.rig.resetView(1.2);
    // resetView re-enables controls on done; mark overview shortly after
    setTimeout(() => {
      this.state = 'overview';
      this.ui.showHint('hint');
      this.ui.setLegend(true);
    }, 1250);
  }

  // Portal disc clicked: seamless "window" transition (Portal-style cut).
  //
  // The disc is a true window (portalRender): it shows the world as seen by a virtual
  // camera = the player camera lifted ΔY into the sky. So:
  //
  // Phase 1 — Arc (1.0 s): swing to face the portal along its normal (near-overhead for
  //   a horizontal disc), radius unchanged — a smooth elliptic sweep.
  // Phase 2 — Dive (0.85 s): plunge straight down the normal until the disc FILLS the
  //   whole screen. At that instant every pixel on screen is the window = the virtual
  //   camera's frame.
  // Phase 3 — Swap (1 frame): move the real camera to the virtual pose exactly (same
  //   position + orientation). Nothing on screen changes → invisible cut. See _portalSwap.
  // Phase 4 — Settle: a gentle, CONTINUOUS ease from that matched frame to the overview.
  //
  // portalPoint  — world-space hit on the disc surface (from raycast).
  // portalNormal — world-space face normal of the portal (tagged in kit.js userData).
  portalBack(portalPoint = null, portalNormal = null) {
    if (this.state === 'overview') return;
    this.closeNote();

    let fallbackTarget = this.rig.target.clone();
    if (this.activeCity) {
      fallbackTarget = this.activeCity.worldPos.clone();
      fallbackTarget.y += 3.35;
    }

    this.rig.orbitOnly = false;
    this.ui.setBack(false);
    this.activeCity = null;
    this._poiById = {};
    this._hoverPoi = null;
    this.state = 'diving';

    const discCenter = portalPoint ?? fallbackTarget;
    const N = (portalNormal ?? new THREE.Vector3(0, 1, 0)).clone().normalize();

    // Approach perpendicular to the portal face, from its normal:
    //   polar   = acos(N.y) → ~0 (straight overhead) for a horizontal disc
    //   azimuth = atan2(N.x, N.z) → from the direction the portal faces
    const approachPolar = Math.max(0.04, Math.min(Math.PI - 0.04, Math.acos(N.y)));
    const approachAzim = (Math.abs(N.x) + Math.abs(N.z) > 0.01)
      ? Math.atan2(N.x, N.z)
      : this.rig.azimuth;

    // Phase 1 — Arc: swing to face the portal, radius held (great-circle sweep).
    this.rig.focusOn({
      target:  discCenter,
      polar:   approachPolar,
      azimuth: approachAzim,
      radius:  this.rig.radius,
      onDone:  () => {
        // Phase 2 — Dive: close in until the 4-unit disc covers the whole frame.
        // At radius 3.6 (fov 42°, 16:9) the disc rim projects past the screen corners.
        this.rig.focusOn({
          target:  discCenter,
          polar:   approachPolar,
          azimuth: approachAzim,
          radius:  3.6,
          onDone:  () => this._portalSwap(),
        }, 0.85);
      },
    }, 1.0);
  }

  // Phase 3 — the seamless swap. Reproduce the virtual camera pose EXACTLY in rig
  // parameters, so apply() places the real camera where the window was already
  // showing. The pose is pushed through the active portal transform (a plain lift
  // for horizontal discs, the full 90° A→B turn for wall portals), then we ease
  // gently to the overview (continuous, no cut).
  _portalSwap() {
    // Player's exact pose at the end of the dive.
    const camPos = this.rig.camera.position.clone();
    const dir = new THREE.Vector3();
    this.rig.camera.getWorldDirection(dir);   // unit view direction (points into screen)

    const C = camPos.clone();
    portalRender.mapPose(C, dir);             // through the portal → the exit pose
    portalRender.clearWallPortal();           // back on the overview side: discs lift

    // Solve rig params (target, azimuth, polar, radius) that reproduce (position C,
    // view direction dir) exactly — see CameraRig.apply():
    //   position = target − radius·dir ,  looking along dir.
    // radius is chosen so the target lands on the ground plane (y = 0) ahead of us.
    // (floor keeps lookAt non-degenerate if the mapped gaze is exactly vertical)
    const pol = Math.max(0.04, Math.acos(THREE.MathUtils.clamp(-dir.y, -1, 1)));
    const az  = Math.atan2(-dir.x, -dir.z);
    const radius = (dir.y < -1e-3) ? (-C.y / dir.y) : 1200;   // ground hit, or far ahead
    const target = C.clone().add(dir.clone().multiplyScalar(radius));

    this.rig._tgt.copy(target);  this.rig.target.copy(target);
    this.rig._azim = this.rig.azimuth = az;
    this.rig._pol  = this.rig.polar   = pol;
    this.rig._rad  = this.rig.radius  = radius;
    this.rig.apply();   // camera now sits exactly where the window showed → invisible cut

    // Phase 4 — settle to the overview. Continuous motion from the matched frame.
    const h = this.rig.home;
    this.rig.focusOn({
      azimuth: h.azimuth, polar: h.polar,
      radius:  h.radius,  target: h.target.clone(),
      fov: 42,
      onDone: () => {
        this.rig.enabled   = true;
        this.rig.idleDrift = true;
        this.state = 'overview';
        this.ui.showHint('hint');
        this.ui.setLegend(true);
      },
    }, 1.8);
  }
}
