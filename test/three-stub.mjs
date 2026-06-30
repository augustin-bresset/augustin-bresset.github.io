// Minimal `three` stand-in for node-side gen/ tests. The generation pipeline only
// touches THREE.Color at module-eval time (biomes.js builds a colour lookup); the
// invariants never call the colour helpers, so a no-op Color is enough. The browser
// never sees this file — a loader hook swaps it in only under `node`.
export class Color {
  constructor() { this.r = 0; this.g = 0; this.b = 0; }
  set() { return this; }
  setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  setHex() { return this; }
  copy() { return this; }
  clone() { return new Color(); }
  lerp() { return this; }
  getHex() { return 0; }
}
export const MathUtils = { clamp: (x, a, b) => (x < a ? a : x > b ? b : x) };
export default { Color, MathUtils };
