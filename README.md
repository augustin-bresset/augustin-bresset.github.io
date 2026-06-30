# augustin-bresset.github.io

A portfolio rendered as a **procedural 3D island** — a low-poly, hand-illustrated
diorama you look at from an oblique 3/4 angle. Each page load generates a brand-new
landscape (terrain, rivers, ravines, forests, sometimes a volcano), while the four
**project settlements** stay anchored in place. Click a settlement to dive in and
read about the project. FR/EN toggle.

No build step — plain ES modules + [Three.js] (vendored). Works on GitHub Pages.

## Run locally

```bash
python3 -m http.server 8137
# open http://127.0.0.1:8137/
```

URL params: `?seed=123` (reproducible world) · `?lang=fr|en` · `?focus=toaster`
(deep-link straight into a project) · `?outline=1` (experimental ink outline).

## Architecture

The user's mental model — **bricks** (reusable terrain primitives), a **generator**
that assembles them into a coherent world, and **stable cities** for the projects.

```
script.js            entry: boot stage, build world, wire camera/UI/navigation
src/
  stage.js           renderer, lights, sky gradient, fog, render loop
  camera.js          oblique 3/4 camera rig (drag-pan, zoom, idle drift, dive tween)
  world.js           buildWorld(seed): runs the whole generation pipeline
  navigation.js      raycast picking + cinematic "dive" into a settlement
  ui.js / lang.js    panels, FR/EN strings, project content
  postfx.js          optional depth-outline pass (opt-in)
  gen/
    noise.js         seeded PRNG + simplex + fBm + domain warp
    heightmap.js     continental mask + warped fBm + ridged mountains → height field
    hydrology.js     flow-accumulation rivers + a carved ravine (real terrain technique)
    biomes.js        sea/beach/grass/forest/rock/snow/cliff classification + colours
    placement.js     jittered-grid scatter of trees / rocks / reeds by biome
  bricks/            terrain.js, water.js, rivers.js, trees.js, rocks.js, volcano.js
  cities/
    registry.js      the list of projects (anchors + builders)  ← extend here
    kit.js           shared building blocks (boxes, glow, labels…)
    apairo.js toaster.js splasher.js about.js
```

Each settlement uses the **real visual identity** of its project: Apairo's amber
(`#dda42a`), Toaster's neon-red brutalism (`#e10600`), Splasher's cold cyan
(`#00b8d9`), and a warm cottage for the About study.

## Adding a project (it's meant to be extensible)

1. Write `src/cities/<id>.js` exporting `build()` → `{ group, label, update }`
   (use helpers from `kit.js`).
2. Append one entry to `CITIES` in `src/cities/registry.js`
   (`id`, `anchor`, `radius`, `build`, `panelKey`, `labelKey`, `subKey`).
3. Add its strings to `src/lang.js` (`PANELS` + label keys, FR & EN).

The plateau, scatter exclusion, label, picking and dive navigation are all wired
automatically from the registry.

[Three.js]: https://threejs.org
