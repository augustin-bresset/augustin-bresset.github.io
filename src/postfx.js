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
      float lin(float z){
        float ndc = z * 2.0 - 1.0;
        return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
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
        vec3 outc = mix(col.rgb, uInk, edge * uStrength);
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
  }
  window.addEventListener('resize', setSize);

  return {
    setStrength(s) { mat.uniforms.uStrength.value = s; },
    setInk(c) { mat.uniforms.uInk.value.set(c); },
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
