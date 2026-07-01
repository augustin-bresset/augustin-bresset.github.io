// postfx.js — depth-based silhouette outline (ink edges) for an illustrated look.
// Renders the scene into a colour+depth target, then a fullscreen pass inks the
// pixels where linearised depth jumps (object/landform silhouettes), leaving
// flat interiors clean (no busy per-facet lines).
import * as THREE from 'three';

export function createOutline(renderer, scene, getCamera, container) {
  const dpr = renderer.getPixelRatio();
  const w = () => Math.max(1, Math.floor(container.clientWidth * dpr));
  const h = () => Math.max(1, Math.floor(container.clientHeight * dpr));

  const rt = new THREE.WebGLRenderTarget(w(), h(), {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
  rt.depthTexture = new THREE.DepthTexture(w(), h());
  rt.depthTexture.type = THREE.UnsignedIntType;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture },
      tDepth: { value: rt.depthTexture },
      uTexel: { value: new THREE.Vector2(1 / w(), 1 / h()) },
      uNear: { value: 2 }, uFar: { value: 1100 },
      uStrength: { value: 0.55 },
      uThresh: { value: 0.4 },
      uInk: { value: new THREE.Color('#2a1808') },
      uDesat: { value: 0 },           // sketch: pull whole frame toward greyscale
      uWash: { value: 0 },            // sketch: tint whole frame toward paper
      uPaper: { value: new THREE.Color('#efe9db') },
      uHatch: { value: 0 },           // sketch: pencil cross-hatching in the shadows
      uResolution: { value: new THREE.Vector2(w(), h()) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tDiffuse; uniform sampler2D tDepth;
      uniform vec2 uTexel; uniform float uNear, uFar, uStrength, uThresh;
      uniform vec3 uInk;
      uniform float uDesat, uWash, uHatch; uniform vec3 uPaper; uniform vec2 uResolution;
      float lin(float z){
        float ndc = z * 2.0 - 1.0;
        return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
      }
      // one layer of parallel pencil strokes at angle 'ang', spacing 'sp' (px), that
      // only appears where luminance drops below 'thr' — and thickens as it darkens.
      float hatchLayer(vec2 p, float ang, float sp, float lum, float thr){
        if (lum > thr) return 1.0;
        float c = cos(ang), s = sin(ang);
        float coord = p.x * c + p.y * s;
        float t = abs(fract(coord / sp) - 0.5) * 2.0;      // 0 at stroke centre
        float depth = clamp((thr - lum) / max(thr, 0.001), 0.0, 1.0);
        float wdt = 0.10 + 0.20 * depth;                    // darker → thicker stroke
        return smoothstep(wdt, wdt + 0.30, t);              // 0 on stroke, 1 between
      }
      void main(){
        vec4 col = texture2D(tDiffuse, vUv);
        float d  = lin(texture2D(tDepth, vUv).x);
        float dl = lin(texture2D(tDepth, vUv + vec2(-uTexel.x, 0.0)).x);
        float dr = lin(texture2D(tDepth, vUv + vec2( uTexel.x, 0.0)).x);
        float du = lin(texture2D(tDepth, vUv + vec2(0.0,  uTexel.y)).x);
        float dd = lin(texture2D(tDepth, vUv + vec2(0.0, -uTexel.y)).x);
        float diff = max(max(abs(d-dl), abs(d-dr)), max(abs(d-du), abs(d-dd)));
        // scale by depth so distant silhouettes aren't over-inked
        float edge = smoothstep(uThresh, uThresh * 3.0, diff / max(d, 1.0) * 8.0);
        // sketch wash: desaturate + tint the WHOLE frame toward paper (so trees and
        // even the neon cities read as one croquis), then ink the silhouette edges.
        float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
        vec3 base = mix(col.rgb, vec3(lum), uDesat);
        base = mix(base, uPaper, uWash);
        // pencil cross-hatching: layered strokes bite into the mid-to-dark tones,
        // building up to a cross-hatch in the darkest pockets. Bright paper (sky,
        // highlights) stays clean. Screen-space, like strokes laid over the page.
        if (uHatch > 0.0) {
          vec2 sc = vUv * uResolution;
          float hs = 1.0;
          hs *= hatchLayer(sc,  0.60,  9.0, lum, 0.46);     // shade tone
          hs *= hatchLayer(sc, -0.72, 10.0, lum, 0.26);     // cross-hatch in shadow
          hs *= hatchLayer(sc,  1.45,  8.0, lum, 0.13);     // dense in the darkest
          base = mix(base, uInk, (1.0 - hs) * uHatch);
        }
        vec3 outc = mix(base, uInk, edge * uStrength);
        gl_FragColor = vec4(outc, 1.0);
      }
    `,
    depthTest: false, depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const fsScene = new THREE.Scene(); fsScene.add(quad);
  const fsCam = new THREE.Camera();

  function setSize() {
    rt.setSize(w(), h());
    rt.depthTexture.image.width = w();
    rt.depthTexture.image.height = h();
    mat.uniforms.uTexel.value.set(1 / w(), 1 / h());
    mat.uniforms.uResolution.value.set(w(), h());
  }
  window.addEventListener('resize', setSize);

  return {
    setStrength(s) { mat.uniforms.uStrength.value = s; },
    setInk(c) { mat.uniforms.uInk.value.set(c); },
    setWash(desat, wash, paper, hatch) {
      mat.uniforms.uDesat.value = desat;
      mat.uniforms.uWash.value = wash;
      mat.uniforms.uHatch.value = hatch || 0;
      if (paper) mat.uniforms.uPaper.value.set(paper);
    },
    render() {
      const cam = getCamera();
      mat.uniforms.uNear.value = cam.near;
      mat.uniforms.uFar.value = cam.far;
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      renderer.render(fsScene, fsCam);
    },
  };
}
