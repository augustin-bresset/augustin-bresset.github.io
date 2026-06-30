// volcano.js (brick) — a lone dramatic cone rising from FLAT barren ground (world.js
// flattens a pad for it; it is never perched on a peak). Scorched cone + glowing
// crater (pulsing emissive) + rising smoke puffs + a flickering ember light.
// `scale` makes it variable-sized per world.
import * as THREE from 'three';

export function buildVolcano(pos, scale = 1) {
  const group = new THREE.Group();
  group.name = 'volcano';
  // base sits just into the (flattened) ground, scaled so big volcanoes don't float
  group.position.set(pos.x, pos.y - 2.5 * scale, pos.z);

  const H = 30 * scale, rBase = 26 * scale, rTop = 7 * scale;

  // --- dark scorched apron (cailloux sombres) around the base ---------------
  // A field of dark basalt gravel + scattered boulders so the cone always sits in a
  // ring of dark volcanic rock, whatever biome it landed in. groundY is the flattened
  // pad surface in local space (group is sunk 2.5*scale below it).
  const groundY = 2.5 * scale;
  const apronR = (pos.padR ? pos.padR : rBase * 1.8) * 0.94;
  const gGeo = new THREE.CircleGeometry(apronR, 30);
  gGeo.rotateX(-Math.PI / 2);
  // rough up the gravel disc a touch so it isn't a clean circle
  const gp = gGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    if (x || z) gp.setY(i, (Math.sin(x * 0.7) + Math.cos(z * 0.6)) * 0.6);
  }
  gGeo.computeVertexNormals();
  const gravel = new THREE.Mesh(
    gGeo, new THREE.MeshStandardMaterial({ color: 0x33302b, roughness: 1, flatShading: true })
  );
  gravel.position.y = groundY + 0.12;
  gravel.receiveShadow = true;
  group.add(gravel);

  const rockGeo = new THREE.DodecahedronGeometry(1, 0); rockGeo.scale(1, 0.75, 1.05);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x2b2723, roughness: 1, flatShading: true });
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    const t = Math.random();
    const rr = rBase * 1.04 + t * (apronR - rBase * 1.04);
    const sc = (0.7 + Math.random() * 2.6) * scale * (1 - t * 0.45);
    const m = new THREE.Mesh(rockGeo, rockMat);
    m.position.set(Math.cos(a) * rr, groundY + sc * 0.28, Math.sin(a) * rr);
    m.rotation.set(Math.random() * 0.6, Math.random() * 6.28, Math.random() * 0.6);
    m.scale.setScalar(sc);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }

  // cone body (scorched rock)
  const coneGeo = new THREE.CylinderGeometry(rTop, rBase, H, 9, 1, true);
  coneGeo.translate(0, H / 2, 0);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x39322c, flatShading: true, roughness: 1 });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.castShadow = true; cone.receiveShadow = true;
  group.add(cone);

  // lava streaks down the cone (a few thin emissive ribbons)
  const lavaMat = new THREE.MeshStandardMaterial({
    color: 0xff5a1e, emissive: 0xff5a1e, emissiveIntensity: 1.4, flatShading: true,
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const g = new THREE.PlaneGeometry(1.2, H * 0.7);
    g.translate(0, H * 0.35, 0);
    const streak = new THREE.Mesh(g, lavaMat);
    streak.position.set(Math.cos(a) * (rBase * 0.55), 0, Math.sin(a) * (rBase * 0.55));
    streak.lookAt(streak.position.x * 2, H * 0.35, streak.position.z * 2);
    group.add(streak);
  }

  // crater rim
  const rimGeo = new THREE.TorusGeometry(rTop + 0.5, 1.6, 6, 12);
  rimGeo.rotateX(Math.PI / 2);
  rimGeo.translate(0, H, 0);
  const rim = new THREE.Mesh(rimGeo, coneMat);
  rim.castShadow = true;
  group.add(rim);

  // glowing lava pool in the crater
  const poolGeo = new THREE.CircleGeometry(rTop, 14);
  poolGeo.rotateX(-Math.PI / 2);
  poolGeo.translate(0, H + 0.2, 0);
  const poolMat = new THREE.MeshStandardMaterial({
    color: 0xff7a2a, emissive: 0xff5a1e, emissiveIntensity: 1.6, flatShading: true,
  });
  const pool = new THREE.Mesh(poolGeo, poolMat);
  group.add(pool);

  // ember light above the crater
  const ember = new THREE.PointLight(0xff6a2a, 2.4, 120, 2);
  ember.position.set(0, H + 6, 0);
  group.add(ember);

  // smoke puffs
  const puffMat = new THREE.MeshStandardMaterial({
    color: 0x4a4540, flatShading: true, roughness: 1, transparent: true, opacity: 0.5,
  });
  const puffGeo = new THREE.IcosahedronGeometry(3, 0);
  const puffs = [];
  const NPUFF = 7;
  for (let i = 0; i < NPUFF; i++) {
    const m = new THREE.Mesh(puffGeo, puffMat.clone());
    m.position.set(0, H, 0);
    group.add(m);
    puffs.push({ mesh: m, t: i / NPUFF, speed: 0.05 + Math.random() * 0.03, sway: Math.random() * 6.28 });
  }

  return {
    group,
    update(time, dt) {
      // pulse lava
      const pulse = 1.3 + Math.sin(time * 2.0) * 0.4 + Math.sin(time * 7.3) * 0.12;
      poolMat.emissiveIntensity = pulse;
      lavaMat.emissiveIntensity = 0.9 + Math.sin(time * 3.1 + 1) * 0.3;
      ember.intensity = 2.0 + Math.sin(time * 5.0) * 0.5 + (Math.random() - 0.5) * 0.4;
      // rising smoke
      for (const p of puffs) {
        p.t += p.speed * dt * 6;
        if (p.t > 1) { p.t -= 1; }
        const h = p.t;
        p.mesh.position.set(
          Math.sin(p.sway + h * 4) * (3 + h * 10),
          H + h * 46,
          Math.cos(p.sway + h * 3) * (3 + h * 10)
        );
        const sc = 0.6 + h * 2.6;
        p.mesh.scale.setScalar(sc);
        p.mesh.material.opacity = 0.55 * (1 - h);
      }
    },
  };
}
