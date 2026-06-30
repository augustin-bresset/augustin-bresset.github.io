// ESM loader hook: resolve the bare `three` specifier to a local stub so the
// pure-data gen/ modules import cleanly under node (no bundler, no importmap).
// Usage: node --experimental-loader ./test/three-loader.mjs test/invariants.mjs
const STUB = new URL('./three-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') return { url: STUB, shortCircuit: true };
  return nextResolve(specifier, context);
}
