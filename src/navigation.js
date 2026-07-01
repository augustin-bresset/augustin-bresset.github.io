// navigation.js — raycast picking + the cinematic "dive" into a settlement.
// Overview: click a city to dive in. Inside a city: click a glowing marker (or its
// building) to open that landmark's field note; click the orb to fly home. The note
// is pinned in screen space beside the marker and re-projected each frame.
import * as THREE from 'three';

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

  // raycast the city groups; returns {cityId, portal, poi} for the first hit by
  // walking ancestors (a mesh inherits its landmark's poi tag / its portal flag).
  _pick(e) {
    const r = this.stage.renderer.domElement.getBoundingClientRect();
    this.ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    this.ray.setFromCamera(this.ndc, this.rig.camera);
    const hits = this.ray.intersectObjects(this.cityGroups, true);
    for (const h of hits) {
      let o = h.object, cityId = null, portal = false, poi = null;
      while (o) {
        if (o.userData.portal) portal = true;
        if (o.userData.poi && !poi) poi = o.userData.poi;
        if (o.userData.cityId && !cityId) cityId = o.userData.cityId;
        o = o.parent;
      }
      if (cityId || portal || poi) return { cityId, portal, poi };
    }
    return { cityId: null, portal: false, poi: null };
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
      const { poi, portal } = this._pick(e);
      if (poi) {
        if (poi === this.openPoiId) this.closeNote();
        else this.openNote(this._poiById[poi]);
      } else if (portal) {
        this.back();                             // the mini-map orb → fly home
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
}
