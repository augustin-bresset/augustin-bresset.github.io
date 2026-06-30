// navigation.js — raycast city picking + the cinematic "dive" into a settlement.
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
    this.hovered = null;
    this.state = 'overview';   // 'overview' | 'diving' | 'city'
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
      if (e.key === 'Escape') {
        if (this.ui.activePanel) this.back();
        else if (this.state === 'city') this.back();
      }
    });
  }

  // raycast the city groups once; returns the first hit's {cityId, portal} flags
  // (portal meshes carry BOTH — portal wins when we're inside a city).
  _pick(e) {
    const r = this.stage.renderer.domElement.getBoundingClientRect();
    this.ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    this.ray.setFromCamera(this.ndc, this.rig.camera);
    const hits = this.ray.intersectObjects(this.cityGroups, true);
    for (const h of hits) {
      let o = h.object, cityId = null, portal = false;
      while (o) {
        if (o.userData.portal) portal = true;
        if (o.userData.cityId && !cityId) cityId = o.userData.cityId;
        o = o.parent;
      }
      if (cityId || portal) return { cityId, portal };
    }
    return { cityId: null, portal: false };
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
      // only the portal is interactive inside a settlement
      const { portal } = this._pick(e);
      cursor.cursor = portal ? 'pointer' : 'grab';
    }
  }

  _onUp(e) {
    if (!this._down) return;
    const moved = Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y);
    this._down = null;
    if (moved > 6) return;                 // it was a drag, not a click
    if (this.state === 'overview') {
      const { cityId } = this._pick(e);
      if (cityId) this.diveTo(cityId);
    } else if (this.state === 'city') {
      const { portal } = this._pick(e);
      if (portal) this.back();             // the mini-map portal → fly home
    }
  }

  // dive goal: close 3/4 view, settlement nudged left so the panel (centre-right)
  // doesn't cover it.
  _goal(city) {
    const az = Math.atan2(city.worldPos.x, city.worldPos.z) + Math.PI;
    const R = city.radius || 36;
    const target = city.worldPos.clone();
    target.y += R * 0.3;
    // shift target along camera-right so the city renders on the left third
    const rx = Math.cos(az), rz = -Math.sin(az);
    target.x += rx * R * 0.6; target.z += rz * R * 0.6;
    return { target, azimuth: az, polar: THREE.MathUtils.degToRad(54), radius: R * 2.3 };
  }

  diveTo(id) {
    const city = this.byId[id];
    if (!city) return;
    this.state = 'diving';
    this.hovered = null;
    this.stage.renderer.domElement.style.cursor = 'default';
    this.ui.setHint(false);
    const goal = this._goal(city);
    goal.onDone = () => { this.state = 'city'; this.ui.showPanel(city.panelKey); this.ui.setBack(true); };
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
    this.state = 'city';
    this.ui.showPanel(city.panelKey); this.ui.setBack(true); this.ui.setHint(false);
  }

  back() {
    if (this.state === 'overview') return;
    this.ui.hidePanel();
    this.ui.setBack(false);
    this.state = 'diving';
    this.rig.resetView(1.2);
    // resetView re-enables controls on done; mark overview shortly after
    setTimeout(() => { this.state = 'overview'; this.ui.setHint(true); }, 1250);
  }
}
