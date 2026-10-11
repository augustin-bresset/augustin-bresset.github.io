// content.js — the PORTFOLIO CONTENT, kept separate from the engine and from the
// UI strings (lang.js). This is the only file to edit to change *what* the world
// says about Augustin, his projects and his path. Pure data: no Three.js, no DOM.
//
// POIS[cityId][poiId] = (lang) => { kicker, title, body, meta?, links? }
//   kicker — small italic category line   ·   title — the landmark's name
//   body   — one or two short sentences   ·   meta  — [[label, value], …]
//   links  — [[label, href], …]
// CITY_LABELS[cityId] = (lang) => [name, subtitle]  — the floating plaque.

// ── Evocative extras for field notes ────────────────────────────────────────
// A note may carry ONE `figure` (trusted inline SVG / <img>) and/or a `code`
// snippet — kept here, language-neutral, so both FR/EN branches share one copy.
// SVGs are hand-drawn line-art in the site's ink palette so they sit on parchment;
// code is faithful to the real API (see apairo_visu README) or a clearly generic
// contract, never an invented framework call.

// Apairo — the lazy, composable pipeline (real apairo API).
const CODE_APAIRO = `import apairo

ds = apairo.Goose3DDataset("/data/goose")
ds = ds.synchronize(reference="lidar")
ds.transform("lidar", ground_height, output="ground")
train = ds.filter(valid_idx)   # a lazy view, not a copy`;

// Toaster — the pluggable-segmenter contract (generic, not a claimed API).
const CODE_TOASTER = `# points in, one label per point
def segment(points, seed_idx):
    return dbscan(points, eps=0.5)   # or a model, CSF…`;

// Apairo — four sensor streams (each at its own rate) synchronized onto one clock.
const FIG_APAIRO_SYNC = `<svg viewBox="0 0 280 104" role="img" aria-label="Four sensor streams synchronized onto one reference clock">
  <g font-family="EB Garamond, serif" font-size="7.5" fill="#8B6845">
    <text x="2" y="19">lidar</text><text x="2" y="39">cam</text><text x="2" y="59">imu</text><text x="2" y="79">pose</text>
  </g>
  <g stroke-width="2.2" stroke-linecap="round" fill="none">
    <line x1="32" y1="16" x2="150" y2="16" stroke="#44aa99" stroke-dasharray="2.2 11"/>
    <line x1="32" y1="36" x2="150" y2="36" stroke="#88ccee" stroke-dasharray="2.2 4"/>
    <line x1="32" y1="56" x2="150" y2="56" stroke="#cc6677" stroke-dasharray="2.2 2.2"/>
    <line x1="32" y1="76" x2="150" y2="76" stroke="#57a957" stroke-dasharray="2.2 8"/>
  </g>
  <g stroke="#2C1A0E" stroke-width="1" fill="none" opacity="0.45">
    <path d="M150 16 L179 43"/><path d="M150 36 L179 45"/><path d="M150 56 L179 49"/><path d="M150 76 L179 51"/>
  </g>
  <circle cx="192" cy="47" r="13" fill="#dda42a" stroke="#2C1A0E" stroke-width="1.5"/>
  <g stroke="#2C1A0E" stroke-width="1.3" stroke-linecap="round"><line x1="192" y1="47" x2="192" y2="39"/><line x1="192" y1="47" x2="198" y2="50"/></g>
  <line x1="205" y1="47" x2="227" y2="47" stroke="#2C1A0E" stroke-width="1.5"/>
  <path d="M223 43 l6 4 -6 4" fill="none" stroke="#2C1A0E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="231" y="38" width="19" height="18" rx="2" fill="none" stroke="#2C1A0E" stroke-width="1.5"/>
  <g font-family="EB Garamond, serif" font-size="7.5" fill="#5C3D20" text-anchor="middle"><text x="192" y="73">sync</text><text x="240" y="71">frame</text></g>
</svg>`;

// Splasher — a bird's-eye grid, a drivable corridor labelled cell by cell.
const FIG_SPLASHER_BEV = `<svg viewBox="0 0 200 128" role="img" aria-label="Bird's-eye grid with a drivable corridor labelled cell by cell">
  <g fill="#00d8ff" opacity="0.32">
    <rect x="80" y="88" width="20" height="20"/><rect x="80" y="68" width="20" height="20"/><rect x="100" y="68" width="20" height="20"/><rect x="100" y="48" width="20" height="20"/><rect x="120" y="48" width="20" height="20"/><rect x="120" y="28" width="20" height="20"/><rect x="140" y="28" width="20" height="20"/><rect x="140" y="8" width="20" height="20"/>
  </g>
  <g stroke="#2C1A0E" stroke-width="0.8" opacity="0.5">
    <line x1="20" y1="8" x2="180" y2="8"/><line x1="20" y1="28" x2="180" y2="28"/><line x1="20" y1="48" x2="180" y2="48"/><line x1="20" y1="68" x2="180" y2="68"/><line x1="20" y1="88" x2="180" y2="88"/><line x1="20" y1="108" x2="180" y2="108"/>
    <line x1="20" y1="8" x2="20" y2="108"/><line x1="40" y1="8" x2="40" y2="108"/><line x1="60" y1="8" x2="60" y2="108"/><line x1="80" y1="8" x2="80" y2="108"/><line x1="100" y1="8" x2="100" y2="108"/><line x1="120" y1="8" x2="120" y2="108"/><line x1="140" y1="8" x2="140" y2="108"/><line x1="160" y1="8" x2="160" y2="108"/><line x1="180" y1="8" x2="180" y2="108"/>
  </g>
  <path d="M90 109 l0 9 M84 118 l6 -6 6 6" fill="none" stroke="#2C1A0E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Projector — the triple bill: 3D cloud, 2D camera, top-down BEV, all in step.
const FIG_PROJECTOR_SCREENS = `<svg viewBox="0 0 280 92" role="img" aria-label="Three synchronized screens: 3D cloud, 2D camera, top-down BEV">
  <g fill="#d4af37"><rect x="6" y="8" width="78" height="5"/><rect x="101" y="8" width="78" height="5"/><rect x="196" y="8" width="78" height="5"/></g>
  <g stroke="#2C1A0E" stroke-width="1.5" fill="none"><rect x="6" y="8" width="78" height="60" rx="2"/><rect x="101" y="8" width="78" height="60" rx="2"/><rect x="196" y="8" width="78" height="60" rx="2"/></g>
  <g fill="#5C3D20"><circle cx="22" cy="54" r="1.4"/><circle cx="30" cy="46" r="1.4"/><circle cx="36" cy="59" r="1.4"/><circle cx="43" cy="41" r="1.4"/><circle cx="49" cy="52" r="1.4"/><circle cx="56" cy="61" r="1.4"/><circle cx="61" cy="47" r="1.4"/><circle cx="69" cy="55" r="1.4"/><circle cx="31" cy="32" r="1.4"/><circle cx="47" cy="30" r="1.4"/><circle cx="59" cy="35" r="1.4"/><circle cx="71" cy="42" r="1.4"/></g>
  <circle cx="166" cy="26" r="3" fill="#d4af37"/>
  <g stroke="#5C3D20" stroke-width="1.2" fill="none"><line x1="107" y1="50" x2="173" y2="50"/><rect x="126" y="38" width="16" height="12"/></g>
  <g stroke="#5C3D20" stroke-width="0.8" opacity="0.7" fill="none"><line x1="206" y1="20" x2="264" y2="20"/><line x1="206" y1="38" x2="264" y2="38"/><line x1="206" y1="56" x2="264" y2="56"/><line x1="206" y1="20" x2="206" y2="56"/><line x1="225" y1="20" x2="225" y2="56"/><line x1="244" y1="20" x2="244" y2="56"/><line x1="264" y1="20" x2="264" y2="56"/></g>
  <rect x="225" y="38" width="19" height="18" fill="#00d8ff" opacity="0.32"/>
  <g font-family="EB Garamond, serif" font-size="8" fill="#5C3D20" text-anchor="middle"><text x="45" y="83">3D</text><text x="140" y="83">2D</text><text x="235" y="83">BEV</text></g>
</svg>`;

// Hubs — the playback loop that keeps a device on the server's clock (public/app.js,
// clamps condensed; KP = 0.5, KI = 0.05).
const CODE_HUBS = `err = actual - wanted      // seconds
integ += KI * err * dt     // drift
// never more than ±1 %:
rate = 1 - clamp(KP * err + integ)
src.playbackRate.value = rate`;

// Hubs — calibration: the sweep a device plays, and the peak that says when it landed.
const FIG_HUBS_CHIRP = `<svg viewBox="0 0 280 84" role="img" aria-label="A frequency sweep, and the correlation peak that marks its arrival">
  <path d="M10 40.0 L11 39.9 L12 39.6 L13 39.3 L14 38.8 L15 38.3 L16 37.7 L17 37.0 L18 36.3 L19 35.6 L20 34.8 L21 34.0 L22 33.2 L23 32.5 L24 31.9 L25 31.4 L26 31.0 L27 30.8 L28 30.8 L29 31.0 L30 31.4 L31 32.1 L32 33.1 L33 34.3 L34 35.8 L35 37.5 L36 39.4 L37 41.5 L38 43.6 L39 45.7 L40 47.7 L41 49.6 L42 51.2 L43 52.4 L44 53.1 L45 53.3 L46 52.9 L47 51.9 L48 50.2 L49 48.0 L50 45.3 L51 42.2 L52 38.9 L53 35.6 L54 32.4 L55 29.5 L56 27.3 L57 25.8 L58 25.3 L59 25.7 L60 27.2 L61 29.6 L62 32.9 L63 36.8 L64 41.0 L65 45.2 L66 49.0 L67 52.1 L68 54.2 L69 55.0 L70 54.4 L71 52.4 L72 49.1 L73 45.0 L74 40.2 L75 35.5 L76 31.2 L77 27.8 L78 25.9 L79 25.6 L80 27.0 L81 30.0 L82 34.2 L83 39.2 L84 44.2 L85 48.7 L86 51.9 L87 53.5 L88 53.1 L89 50.9 L90 47.0 L91 42.2 L92 37.1 L93 32.6 L94 29.3 L95 27.8 L96 28.4 L97 30.9 L98 35.0 L99 39.8 L100 44.5 L101 48.2 L102 50.3 L103 50.3 L104 48.4 L105 44.9 L106 40.7 L107 36.5 L108 33.2 L109 31.6 L110 31.8 L111 33.8 L112 37.0 L113 40.6 L114 43.7 L115 45.6 L116 46.0 L117 44.9 L118 42.8 L119 40.4 L120 38.3 L121 37.3 L122 37.4 L123 38.4 L124 40.0" fill="none" stroke="#2C1A0E" stroke-width="1.3" stroke-linejoin="round"/>
  <line x1="134" y1="40" x2="148" y2="40" stroke="#2C1A0E" stroke-width="1.4"/>
  <path d="M145 36 l5 4 -5 4" fill="none" stroke="#2C1A0E" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="158" y1="58.5" x2="270" y2="58.5" stroke="#2C1A0E" stroke-width="0.8" opacity="0.45"/>
  <path d="M158 57.1 L159 56.9 L160 57.1 L161 56.2 L162 56.5 L163 56.4 L164 57.6 L165 56.9 L166 56.2 L167 56.1 L168 57.7 L169 57.7 L170 56.1 L171 56.2 L172 56.9 L173 57.6 L174 56.3 L175 56.6 L176 56.1 L177 57.1 L178 56.9 L179 57.2 L180 55.6 L181 57.0 L182 57.7 L183 57.7 L184 55.3 L185 56.8 L186 56.9 L187 57.1 L188 54.7 L189 56.2 L190 54.8 L191 55.6 L192 53.9 L193 55.5 L194 53.2 L195 55.1 L196 54.7 L197 55.7 L198 53.8 L199 56.6 L200 57.0 L201 56.7 L202 55.0 L203 57.5 L204 57.0 L205 57.2 L206 55.7 L207 57.2 L208 56.4 L209 57.4 L210 56.3 L211 56.0 L212 53.1 L213 50.0 L214 40.7 L215 30.6 L216 25.8 L217 31.5 L218 41.3 L219 48.6 L220 53.2 L221 55.9 L222 57.0 L223 56.7 L224 56.2 L225 55.5 L226 55.8 L227 56.0 L228 55.1 L229 52.9 L230 53.2 L231 53.8 L232 53.8 L233 51.8 L234 53.4 L235 54.0 L236 55.5 L237 54.5 L238 56.3 L239 55.5 L240 57.1 L241 56.5 L242 57.6 L243 55.5 L244 57.4 L245 57.6 L246 57.8 L247 55.3 L248 57.7 L249 57.4 L250 57.5 L251 55.5 L252 57.9 L253 56.6 L254 57.4 L255 56.1 L256 57.4 L257 55.9 L258 57.7 L259 56.9 L260 57.0 L261 55.6 L262 57.9 L263 57.8 L264 56.8 L265 55.6 L266 57.3 L267 57.4 L268 56.9 L269 56.0 L270 56.7" fill="none" stroke="#5C3D20" stroke-width="1.2" stroke-linejoin="round"/>
  <line x1="216" y1="20" x2="216" y2="64" stroke="#1f6f5c" stroke-width="1.2" stroke-dasharray="2.5 2.5"/>
  <circle cx="216" cy="25.8" r="2.4" fill="#1f6f5c"/>
  <g font-family="EB Garamond, serif" font-size="8" fill="#5C3D20" text-anchor="middle"><text x="67" y="76">1 → 6 kHz</text><text x="216" y="76">Δt</text></g>
</svg>`;

// Hubs — the music's spectrum, with the one narrow band each device keeps to itself.
const FIG_HUBS_BANDS = `<svg viewBox="0 0 280 92" role="img" aria-label="The music's spectrum, with one narrow band reserved for each of four devices">
  <g fill="#8B6845" opacity="0.45"><rect x="12.0" y="25.5" width="6.6" height="48.5"/><rect x="21.2" y="19.4" width="6.6" height="54.6"/><rect x="30.4" y="38.0" width="6.6" height="36.0"/><rect x="39.6" y="39.8" width="6.6" height="34.2"/><rect x="48.8" y="30.7" width="6.6" height="43.3"/><rect x="58.0" y="40.7" width="6.6" height="33.3"/><rect x="67.2" y="47.7" width="6.6" height="26.3"/><rect x="76.4" y="40.6" width="6.6" height="33.4"/><rect x="85.6" y="43.5" width="6.6" height="30.5"/><rect x="94.8" y="51.5" width="6.6" height="22.5"/><rect x="104.0" y="48.1" width="6.6" height="25.9"/><rect x="113.2" y="46.8" width="6.6" height="27.2"/><rect x="140.8" y="50.3" width="6.6" height="23.7"/><rect x="168.4" y="53.4" width="6.6" height="20.6"/><rect x="177.6" y="54.8" width="6.6" height="19.2"/><rect x="205.2" y="55.8" width="6.6" height="18.2"/><rect x="232.8" y="56.8" width="6.6" height="17.2"/><rect x="242.0" y="58.1" width="6.6" height="15.9"/><rect x="251.2" y="58.6" width="6.6" height="15.4"/><rect x="260.4" y="57.8" width="6.6" height="16.2"/></g>
  <g fill="#2fa487"><rect x="122.4" y="53.1" width="6.6" height="20.9"/><rect x="131.6" y="53.0" width="6.6" height="21.0"/></g>
  <g fill="#e0a23a"><rect x="150.0" y="54.0" width="6.6" height="20.0"/><rect x="159.2" y="55.8" width="6.6" height="18.2"/></g>
  <g fill="#d9634f"><rect x="186.8" y="57.2" width="6.6" height="16.8"/><rect x="196.0" y="55.9" width="6.6" height="18.1"/></g>
  <g fill="#5b8fd6"><rect x="214.4" y="57.8" width="6.6" height="16.2"/><rect x="223.6" y="57.6" width="6.6" height="16.4"/></g>
  <line x1="8" y1="74.5" x2="272" y2="74.5" stroke="#2C1A0E" stroke-width="1" opacity="0.55"/>
  <g font-family="EB Garamond, serif" font-size="8" fill="#5C3D20" text-anchor="middle"><text x="14" y="86">0</text><text x="140" y="86">4 kHz</text><text x="262" y="86">8 kHz</text></g>
</svg>`;

// Foliome — describing a site's content: one brick (fields, in a group or a list) that
// nests at will. Trimmed from the README's own example.
const CODE_FOLIOME = `foliome({ content: {
  projects: { type: 'list', fields: {
    title: { type: 'text' },
    cover: { type: 'file' },
  } },
} })`;

// Foliome — the lab: one picture in, the same picture out at three widths (1 : 2 : 3).
const FIG_FOLIOME_SIZES = `<svg viewBox="0 0 280 88" role="img" aria-label="One picture in, the same picture out at three widths">
  <g fill="none" stroke="#2C1A0E" stroke-width="1.5" stroke-linejoin="round">
    <rect x="8" y="12" width="72" height="54" rx="1.5"/><path d="M12 58 L32 30 L42 46 L54 34 L76 58"/><circle cx="64" cy="24" r="4"/>
  </g>
  <line x1="88" y1="39" x2="101" y2="39" stroke="#2C1A0E" stroke-width="1.4"/>
  <path d="M98 35 l5 4 -5 4" fill="none" stroke="#2C1A0E" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  <g fill="none" stroke="#5C3D20" stroke-width="1.2" stroke-linejoin="round">
    <rect x="112" y="49.5" width="22" height="16.5"/><path d="M114 63.5 L120 55 L123 60 L127 56 L132 63.5"/>
    <rect x="144" y="33" width="44" height="33"/><path d="M147 61 L159 44 L165 53.5 L172 46.5 L185 61"/><circle cx="178" cy="40" r="2.4"/>
    <rect x="198" y="16.5" width="66" height="49.5"/><path d="M202 58.5 L220 33 L229 47.5 L240 36.5 L260 58.5"/><circle cx="249" cy="27" r="3.6"/>
  </g>
  <g fill="#e5197d"><rect x="112" y="68.5" width="22" height="1.6"/><rect x="144" y="68.5" width="44" height="1.6"/><rect x="198" y="68.5" width="66" height="1.6"/></g>
  <g font-family="EB Garamond, serif" font-size="8" fill="#5C3D20" text-anchor="middle"><text x="44" y="79">≤ 3200 px</text><text x="123" y="80">640</text><text x="166" y="80">1280</text><text x="231" y="80">1920</text></g>
</svg>`;

export const CITY_LABELS = {
  apairo: (l) => l === 'fr' ? ['Apairo', 'Données Robotique'] : ['Apairo', 'Robotics Data'],
  toaster: (l) => l === 'fr' ? ['Toaster', 'Annotation 3D'] : ['Toaster', '3D Annotation'],
  splasher: (l) => l === 'fr' ? ['Splasher', 'Étiquetage BEV'] : ['Splasher', 'BEV Labeling'],
  projector: (l) => l === 'fr' ? ['Projector', "Moteur d'Affichage 3D/2D"] : ['Projector', '3D/2D Display Engine'],
  about: (l) => l === 'fr' ? ['Origin', "L'Inventeur"] : ['Origin', 'The Inventor'],
  rubicon: (l) => l === 'fr' ? ['Rubicon', 'Bijouterie & ERP'] : ['Rubicon', 'Jewelry & ERP'],
  hubs: (l) => l === 'fr' ? ['Hubs', 'Audio Synchronisé'] : ['Hubs', 'Synchronized Audio'],
  foliome: (l) => l === 'fr' ? ['Foliome', 'Portfolios Éditables'] : ['Foliome', 'Editable Portfolios'],
};

// each settlement's signature accent (portal/label/legend), so the legend dot, the
// city beacon and the field notes all speak the same colour language.
export const CITY_ACCENT = {
  apairo: '#dda42a', toaster: '#e10600', splasher: '#00d8ff', projector: '#d4af37', about: '#c4763a',
  rubicon: '#a56cc1', hubs: '#1f6f5c', foliome: '#e5197d',
};

// CITY_LINKS[cityId] = (lang) => [[label, href], …] — the "front doors" of a project,
// surfaced in a side panel while a settlement is in focus (see ui.js showCityLinks).
// Curated, 2–4 primary destinations per city — NOT every sub-repo. Return [] to hide
// the panel (Rubicon is client work, its code is never shared).
export const CITY_LINKS = {
  apairo: (l) => [
    ['Site', 'https://apairo-robotics.github.io/'],
    // the ORG, not the core repo — one row surfaces the whole ecosystem
    // (apairo, extractor, transform, preprocess, apairo_visu, …)
    ['GitHub', 'https://github.com/apairo-robotics'],
  ],
  toaster: (l) => [
    [l === 'fr' ? 'Démo' : 'Demo', 'https://huggingface.co/spaces/SmaugC137/toaster'],
    ['GitHub', 'https://github.com/augustin-bresset/toaster'],
  ],
  splasher: (l) => [
    [l === 'fr' ? 'Démo' : 'Demo', 'https://huggingface.co/spaces/SmaugC137/splasher'],
    ['GitHub', 'https://github.com/augustin-bresset/splasher'],
  ],
  projector: (l) => [
    [l === 'fr' ? 'Démo' : 'Demo', 'https://projector-demo.onrender.com'],
    ['GitHub', 'https://github.com/augustin-bresset/projector'],
  ],
  about: (l) => [
    ['Email', 'mailto:augustin.bresset@polytechnique.edu'],
    ['GitHub', 'https://github.com/augustin-bresset'],
    ['LinkedIn', 'https://www.linkedin.com/in/augustin-b-3a0546142/'],
  ],
  rubicon: (l) => [],   // client code, never shared publicly — panel stays hidden
  hubs: (l) => [
    ['GitHub', 'https://github.com/augustin-bresset/hubs'],
  ],
  foliome: (l) => [
    ['GitHub', 'https://github.com/augustin-bresset/foliome'],
  ],
};

export const POIS = {
  // the croquis sky: notes pinned to the themed hot-air balloons drifting by.
  // Clicking a balloon opens a short card pointing back to the real project.
  croquis: {
    toast: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Projet', title: 'Toaster',
      body: "L'atelier d'annotation LiDAR 3D : sélectionnez, un segmenter étiquette l'objet entier en un clic.",
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
    } : {
      kicker: 'Balloon · Project', title: 'Toaster',
      body: 'The 3D LiDAR annotation workshop: select, and a segmenter labels the whole object in one click.',
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
    },
    splash: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Projet', title: 'Splasher',
      body: "Étiquetage multi-capteurs synchronisé sur grille vue-du-ciel — nuage de points, caméras et BEV en phase.",
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    } : {
      kicker: 'Balloon · Project', title: 'Splasher',
      body: "Synchronized multi-sensor labeling on a bird's-eye grid — point cloud, cameras and BEV in step.",
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    },
    apairo: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Projet', title: 'Apairo',
      body: "La fabrique de données robotique : un cadre Python qui unifie les datasets hétérogènes (LiDAR, IMU, caméras).",
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
    } : {
      kicker: 'Balloon · Project', title: 'Apairo',
      body: 'The robotics data factory: a Python framework unifying heterogeneous datasets (LiDAR, IMU, cameras).',
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
    },
    gear: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · L\'atelier', title: 'Origin',
      body: "L'inventeur derrière tout ça — parcours, projets et le reste de l'archipel se visitent sur la carte.",
      links: [['GitHub ↗', 'https://github.com/augustin-bresset']],
    } : {
      kicker: 'Balloon · The workshop', title: 'Origin',
      body: 'The inventor behind it all — the path, the projects and the rest of the archipelago live on the map.',
      links: [['GitHub ↗', 'https://github.com/augustin-bresset']],
    },
    projector: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Projet', title: 'Projector',
      body: "Le moteur d'affichage 3D et 2D partagé — nuages de points et caméras rendus en direct. Il fait tourner l'affichage de Toaster, Splasher et apairo studio.",
      links: [['Démo ↗', 'https://projector-demo.onrender.com'], ['GitHub ↗', 'https://github.com/augustin-bresset/projector']],
    } : {
      kicker: 'Balloon · Project', title: 'Projector',
      body: 'The shared 3D & 2D display engine — point clouds and cameras rendered live. It powers the display in Toaster, Splasher and apairo studio.',
      links: [['Demo ↗', 'https://projector-demo.onrender.com'], ['GitHub ↗', 'https://github.com/augustin-bresset/projector']],
    },
    rubicon: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Expérience', title: 'Rubicon',
      body: "Stage solo à Bangkok : migration complète d'un ERP de bijouterie vers Odoo 18, 25 modules sur-mesure.",
    } : {
      kicker: 'Balloon · Experience', title: 'Rubicon',
      body: 'A solo internship in Bangkok: a full jewelry-manufacturer ERP migration to Odoo 18, 25 custom modules.',
    },
    hubs: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Projet', title: 'Hubs',
      body: "La même musique, au même instant, sur plusieurs appareils et leurs enceintes — Bluetooth compris : un micro mesure ce qu'on entend vraiment, et chaque appareil est compensé.",
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/hubs']],
    } : {
      kicker: 'Balloon · Project', title: 'Hubs',
      body: 'The same music, at the same instant, on several devices and their speakers — Bluetooth included: a microphone measures what is actually heard, and each device is compensated.',
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/hubs']],
    },
    foliome: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Projet', title: 'Foliome',
      body: "Des sites de portfolio codés sur mesure, que l'artiste met à jour lui-même : il clique sur une zone, un panneau s'ouvre à côté, il modifie, c'est enregistré.",
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/foliome']],
    } : {
      kicker: 'Balloon · Project', title: 'Foliome',
      body: "Hand-coded portfolio sites that the artist keeps up to date alone: click a zone, a panel opens beside it, change it, it's saved.",
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/foliome']],
    },
  },

  about: {
    polytechnique: (l) => l === 'fr' ? {
      kicker: 'Formation · 2025–26', title: 'École Polytechnique',
      body: "M.Sc. Data Science, spécialité Probabilités, Statistiques & Optimisation.",
      meta: [['Cours', 'Apprentissage par renforcement · Deep learning · Chaînes de Markov & Monte-Carlo · Optimisation convexe & entière · Hackathon (Hi!ckathon)']],
    } : {
      kicker: 'Education · 2025–26', title: 'École Polytechnique',
      body: 'M.Sc. Data Science, concentration in Probability, Statistics & Optimization.',
      meta: [['Courses', 'Reinforcement learning · Deep learning · Markov chains & Monte-Carlo · Convex & integer optimization · Hackathon (Hi!ckathon)']],
    },
    prepa: (l) => l === 'fr' ? {
      kicker: 'Classe préparatoire · 2020–22', title: 'Lycée Saint-Louis',
      body: "Classe préparatoire aux concours des grandes écoles, MP option Informatique.",
    } : {
      kicker: 'Prep school · 2020–22', title: 'Lycée Saint-Louis',
      body: "Classe préparatoire (competitive-exam track to France's top engineering schools), MP track with a Computer Science option.",
    },
    telecom: (l) => l === 'fr' ? {
      kicker: 'Formation · 2022–26', title: 'Télécom SudParis',
      body: "Cycle ingénieur, majeure Data Science & Intelligence Artificielle, spécialisation 3A Modélisation et Statistique Appliquée.",
      meta: [
        ['Cours', 'Processus stochastiques · Réseaux de neurones · Apprentissage par renforcement'],
        ['Vie associative', "Bureau des Internationaux (trésorier) · Intech, le club de robotique (chef de projet puis responsable de sa participation à la course de voiture autonome de l'ENS)"],
      ],
    } : {
      kicker: 'Education · 2022–26', title: 'Télécom SudParis',
      body: 'Engineering degree (M.Eng.), major in Data Science & Artificial Intelligence, 3rd-year specialization in Applied Statistical Modeling.',
      meta: [
        ['Coursework', 'Stochastic processes · Neural networks · Reinforcement learning'],
        ['Student life', "International Students' Office (treasurer) · Intech, the robotics club (project lead, then head of its entry in the ENS autonomous-car race)"],
      ],
    },
    upfund: (l) => l === 'fr' ? {
      kicker: 'Stage · 2023', title: 'Upfund',
      body: "Stage de première année : une carte intelligente pilotée par un LLM — « trouve-moi les restaurants à moins de 50 m de la Seine à Paris » devient directement des points sur la carte, via OpenStreetMap et Overpass Turbo.",
    } : {
      kicker: 'Internship · 2023', title: 'Upfund',
      body: 'First-year internship: a smart map driven by an LLM interpreter — "find me restaurants within 50m of the Seine in Paris" turns straight into pins on the map, via OpenStreetMap and Overpass Turbo.',
    },
    ensta: (l) => l === 'fr' ? {
      kicker: 'Recherche · 2024–25', title: 'ENSTA Paris',
      body: "Stage de recherche en SLAM LiDAR-IMU — mais l'essentiel du temps est parti dans la structure : concevoir l'architecture d'Apairo a pris plus de temps que la recherche. La graine de tout l'écosystème.",
    } : {
      kicker: 'Research · 2024–25', title: 'ENSTA Paris',
      body: "Research internship on LiDAR-IMU SLAM — but most of the time went into the structure: designing Apairo's architecture took longer than the research itself. The seed of the whole ecosystem.",
    },
    enstapfe: (l) => l === 'fr' ? {
      kicker: 'Recherche · PFE · avril–août 2026', title: 'ENSTA Paris — Barakuda',
      body: "De retour à ENSTA pour le PFE : des modèles de traversabilité par LiDAR, passés au crible de dizaines de configurations — apprentissage faiblement supervisé, pertes pondérées, approches par graphe, voxels contre pillars. Le terrain d'essai était le sien : des mois à piloter Barakuda, un rover, à travers forêts, hautes herbes et collines pour enregistrer ses propres données.",
      meta: [
        ['Étiquetage', 'Nuages de points annotés avec ses propres outils — Toaster, Splasher — et relus dans Projector'],
        ['Infrastructure & open-source', "L'environnement Apairo enfin achevé, pour que chaque expérience se rejoue à l'identique · contributions à TorchSparse et au jeu de données TartanDrive v2"],
      ],
    } : {
      kicker: 'Research · Final-year internship · Apr–Aug 2026', title: 'ENSTA Paris — Barakuda',
      body: 'Back at ENSTA for his final-year research internship: LiDAR traversability models, benchmarked across dozens of configurations — weakly-supervised learning, weighted losses, graph-based approaches, voxels versus pillars. The test ground was his own: months spent driving Barakuda, a rover, through forests, tall grass and hills to record his own data.',
      meta: [
        ['Labeling', 'Point clouds annotated with his own tools — Toaster, Splasher — reviewed in Projector'],
        ['Infrastructure & open-source', 'Finally finished the Apairo environment, so every experiment replays identically · contributed to TorchSparse and the TartanDrive v2 dataset'],
      ],
    },
    rubicon: (l) => l === 'fr' ? {
      kicker: 'Expérience · 2025–26', title: 'Rubicon · Bangkok',
      body: "Stage ingénieur logiciel, seul sur le projet : migration complète de l'ERP vers Odoo 18 pour un fabricant de bijoux (~40 employés) — 25 modules sur-mesure et un pipeline d'import automatisé depuis l'ancien système. Sa propre ville sur la carte →",
    } : {
      kicker: 'Experience · 2025–26', title: 'Rubicon · Bangkok',
      body: 'Software engineering intern, solo on the project: full ERP migration to Odoo 18 for a jewelry manufacturer (~40 staff) — 25 custom modules and an automated import pipeline from the old legacy system. Has its own city on the map →',
    },
    contact: (l) => l === 'fr' ? {
      kicker: 'Dire bonjour', title: 'Augustin Bresset',
      body: "Data Scientist & Ingénieur, Paris. Pas à la recherche de nouvelles opportunités pour l'instant — plutôt concentré sur la poursuite de son chemin en recherche, du côté du deep learning.",
      links: [['Email ↗', 'mailto:augustin.bresset@polytechnique.edu'], ['GitHub ↗', 'https://github.com/augustin-bresset'], ['LinkedIn ↗', 'https://www.linkedin.com/in/augustin-b-3a0546142/']],
    } : {
      kicker: 'Say hello', title: 'Augustin Bresset',
      body: 'Data Scientist & Engineer, Paris. Not currently looking for new opportunities — focused instead on continuing down the research path, in deep learning.',
      links: [['Email ↗', 'mailto:augustin.bresset@polytechnique.edu'], ['GitHub ↗', 'https://github.com/augustin-bresset'], ['LinkedIn ↗', 'https://www.linkedin.com/in/augustin-b-3a0546142/']],
    },
  },

  apairo: {
    hall: (l) => l === 'fr' ? {
      kicker: 'Open-source · Données robotique', title: 'Apairo',
      body: "Un écosystème open-source qui unifie les datasets robotiques hétérogènes — du brut aux tenseurs prêts à l'entraînement. Tout se compose paresseusement, sans rien réécrire sur le disque :",
      code: CODE_APAIRO,
      links: [['Site ↗', 'https://apairo-robotics.github.io/'], ['GitHub ↗', 'https://github.com/apairo-robotics/apairo']],
    } : {
      kicker: 'Open-source · Robotics data', title: 'Apairo',
      body: 'An open-source ecosystem that unifies heterogeneous robotics datasets — from raw to training-ready tensors. Everything composes lazily, nothing rewritten to disk:',
      code: CODE_APAIRO,
      links: [['Site ↗', 'https://apairo-robotics.github.io/'], ['GitHub ↗', 'https://github.com/apairo-robotics/apairo']],
    },
    extract: (l) => l === 'fr' ? {
      kicker: 'Brique · Ingestion', title: 'Extractor',
      body: "La porte d'entrée : décharge les enregistrements bruts — rosbags, KITTI, formats maison — et en tire des flux propres, un par capteur.",
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_extractor']],
    } : {
      kicker: 'Brick · Ingestion', title: 'Extractor',
      body: 'The front door: unloads raw recordings — rosbags, KITTI, custom formats — and draws out clean streams, one per sensor.',
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_extractor']],
    },
    transform: (l) => l === 'fr' ? {
      kicker: 'Brique · À la volée', title: 'Transform',
      body: "Adapte les données au moment où on les lit — repères, filtres, projections — pour les brancher sur n'importe quelle autre brique, sans jamais rien écrire sur le disque.",
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_transform']],
    } : {
      kicker: 'Brick · On the fly', title: 'Transform',
      body: 'Adapts the data at the moment it is read — frames, filters, projections — so it plugs into any other brick, without ever writing to disk.',
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_transform']],
    },
    preprocess: (l) => l === 'fr' ? {
      kicker: 'Brique · Une seule passe', title: 'Preprocess',
      body: "Les calculs lourds — odométrie, segmentation du sol, labels — tournent une seule fois ; leurs résultats sont persistés et rechargent ensuite gratuitement.",
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_preprocess']],
    } : {
      kicker: 'Brick · Run once', title: 'Preprocess',
      body: 'The heavy computations — odometry, ground segmentation, labels — run exactly once; their results persist and reload for free ever after.',
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_preprocess']],
    },
    visualize: (l) => l === 'fr' ? {
      kicker: 'Brique · Inspection', title: 'Visualize',
      body: "Regroupe deux visualiseurs sous un même toit : apairo rerun et apairo studio — nuages de points, images et trajectoires synchronisés côte à côte, pour explorer n'importe quel dataset et le voir de ses propres yeux.",
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_visu']],
    } : {
      kicker: 'Brick · Inspection', title: 'Visualize',
      body: 'Bundles two viewers under one roof: apairo rerun and apairo studio — point clouds, images and trajectories synced side by side, to explore any dataset and see it with your own eyes.',
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_visu']],
    },
    silos: (l) => l === 'fr' ? {
      kicker: 'En aval', title: 'Cache & Découpes',
      body: "La suite du voyage : les canaux dérivés (odométrie, sol, labels) se calculent une fois puis sont mis en cache à côté des données ; les découpes train/val/test ne sont que des vues légères — quelques Ko d'indices sur des gigaoctets.",
    } : {
      kicker: 'Downstream', title: 'Cache & Splits',
      body: 'The journey continues: derived channels (odometry, ground, labels) are computed once then cached beside the data; train/val/test splits are just lightweight views — a few KB of indices over gigabytes.',
    },
    conveyor: (l) => l === 'fr' ? {
      kicker: 'Le voyage des données', title: 'Les Voies',
      body: "Un rosbag arrive : l'extracteur le décharge, le préprocess le nettoie, puis la synchronisation aligne chaque capteur — à sa propre fréquence — sur une même horloge. Les trames hors tolérance sont écartées, jamais maquillées.",
      figure: FIG_APAIRO_SYNC, caption: 'Quatre flux, un même temps.',
    } : {
      kicker: "The data's journey", title: 'The Lanes',
      body: 'A rosbag arrives: the extractor unloads it, preprocessing cleans it, then synchronization aligns every sensor — each at its own rate — onto one clock. Frames beyond tolerance are set aside, never faked.',
      figure: FIG_APAIRO_SYNC, caption: 'Four streams, one clock.',
    },
    pier: (l) => l === 'fr' ? {
      kicker: "Né à l'ENSTA · 2024", title: 'Sorti du labo',
      body: "Né comme outil de stage de recherche à l'ENSTA Paris, désormais un écosystème complet — extraction, préprocess, synchronisation, transformation, visualisation — au service de l'apprentissage de la traversabilité.",
      meta: [['Stack', 'Python · NumPy · PyTorch · Docker']],
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
    } : {
      kicker: 'Born at ENSTA · 2024', title: 'Out of the Lab',
      body: 'Started as a research-internship tool at ENSTA Paris, now a complete ecosystem — extraction, preprocessing, synchronization, transformation, visualization — feeding traversability learning research.',
      meta: [['Stack', 'Python · NumPy · PyTorch · Docker']],
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
    },
  },

  toaster: {
    stage: (l) => l === 'fr' ? {
      kicker: 'LiDAR 3D · Annotation', title: 'Toaster',
      body: "Étiqueter des nuages de points 3D le plus vite possible : vous sélectionnez, le segmenter fait le reste — un objet entier labellisé en un clic.",
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
    } : {
      kicker: '3D LiDAR · Annotation', title: 'Toaster',
      body: 'Label 3D point clouds as fast as possible: you select, the segmenter does the rest — a whole object labelled in one click.',
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
    },
    landmark: (l) => l === 'fr' ? {
      kicker: 'Sélection', title: 'Point · Boîte · Voxel',
      body: "Trois façons de saisir les points : un par un, à la boîte englobante, ou par grille de voxels — selon la scène et la précision voulue.",
    } : {
      kicker: 'Selection', title: 'Point · Box · Voxel',
      body: 'Three ways to grab points: one by one, by bounding box, or on a voxel grid — whichever fits the scene and the precision you need.',
    },
    clustering: (l) => l === 'fr' ? {
      kicker: 'Sous le capot', title: 'Segmenters à la carte',
      body: "N'importe quel segmenter se branche : il reçoit les points, il rend un label par point. Le reste — sélection, rendu 3D — ne bouge pas.",
      code: CODE_TOASTER,
      meta: [['Stack', 'Python · Three.js · FastAPI · pywebview']],
    } : {
      kicker: 'Under the hood', title: 'Pluggable Segmenters',
      body: 'Any segmenter plugs in: it takes the points, it returns one label per point. Everything else — selection, 3D rendering — stays put.',
      code: CODE_TOASTER,
      meta: [['Stack', 'Python · Three.js · FastAPI · pywebview']],
    },
  },

  splasher: {
    table: (l) => l === 'fr' ? {
      kicker: 'BEV · Multi-capteurs', title: 'Splasher',
      body: "Étiquetage multi-capteurs synchronisé sur grille vue-du-ciel : nuage de points, panneaux caméra et vue BEV de dessus, en phase.",
    } : {
      kicker: 'BEV · Multi-sensor', title: 'Splasher',
      body: "Synchronized multi-sensor labeling on a bird's-eye grid: point cloud, camera panels and a top-down BEV view, in sync.",
    },
    mast: (l) => l === 'fr' ? {
      kicker: 'Modalités', title: 'Pile de Capteurs',
      body: "LiDAR, caméra et grille BEV recalés ensemble : étiquetez une fois, voyez-le dans chaque vue.",
    } : {
      kicker: 'Modalities', title: 'Sensor Stack',
      body: 'LiDAR, camera and BEV grid registered together: label once, see it across every view.',
    },
    towers: (l) => l === 'fr' ? {
      kicker: 'Conçu pour', title: 'Traversabilité',
      body: "La tâche phare : marquer cellule par cellule ce qui est franchissable — la précision dont un robot a besoin pour choisir sa route.",
      figure: FIG_SPLASHER_BEV, caption: 'Franchissable, cellule par cellule.',
      meta: [['Stack', 'Python · Three.js · FastAPI']],
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    } : {
      kicker: 'Built for', title: 'Traversability',
      body: "The flagship task: mark cell by cell what's drivable — the precision a robot needs to choose its way.",
      figure: FIG_SPLASHER_BEV, caption: 'Drivable, cell by cell.',
      meta: [['Stack', 'Python · Three.js · FastAPI']],
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    },
  },

  projector: {
    marquee: (l) => l === 'fr' ? {
      kicker: 'Moteur · Affichage 3D/2D', title: 'Projector',
      body: "Le moteur de rendu qui affiche les données robotiques — nuages de points 3D, caméras 2D, vues du ciel — de façon fluide et synchronisée, réglages en direct. C'est lui qui fait tourner l'affichage de Toaster, Splasher et apairo studio : un seul moteur de rendu, réutilisé partout.",
      links: [['Démo ↗', 'https://projector-demo.onrender.com'], ['GitHub ↗', 'https://github.com/augustin-bresset/projector']],
    } : {
      kicker: 'Engine · 3D/2D Display', title: 'Projector',
      body: "The rendering engine that draws robotics data — 3D point clouds, 2D cameras, bird's-eye views — smoothly and in sync, tuned live. It's what powers the display in Toaster, Splasher and apairo studio: one rendering engine, reused everywhere.",
      links: [['Demo ↗', 'https://projector-demo.onrender.com'], ['GitHub ↗', 'https://github.com/augustin-bresset/projector']],
    },
    screens: (l) => l === 'fr' ? {
      kicker: 'Vues parallèles', title: 'La Triple Séance',
      body: "Trois écrans en phase : nuage 3D, caméra 2D, vue du ciel BEV. Les réglages d'affichage se changent en direct — jamais d'aller-retour serveur pendant la lecture.",
      figure: FIG_PROJECTOR_SCREENS, caption: '3D · 2D · BEV, en phase.',
    } : {
      kicker: 'Parallel views', title: 'The Triple Bill',
      body: 'Three screens in step: 3D cloud, 2D camera, top-down BEV. Display settings change live — never a server round-trip during playback.',
      figure: FIG_PROJECTOR_SCREENS, caption: '3D · 2D · BEV, in step.',
    },
    booth: (l) => l === 'fr' ? {
      kicker: 'La séance critique', title: 'Le Guichet des Confusions',
      body: "Deux étiquetages, une bobine verte et une rouge : vrai/faux positifs et négatifs colorent chaque point, précision/rappel/IoU recalculés en direct. Mais la cabine ne fait pas que comparer — elle rejoue aussi n'importe quelle transformation (repère, filtre, projection) directement sur la scène, pour voir l'effet avant de le garder.",
      meta: [['Stack', 'Python · NumPy · FastAPI · Three.js']],
    } : {
      kicker: "The critics' screening", title: 'The Confusion Booth',
      body: "Two labelings, one green reel and one red: true/false positives and negatives colour every point, precision/recall/IoU recomputed live. But the booth doesn't just compare — it also replays any transformation (frame, filter, projection) directly on the scene, so you see the effect before you keep it.",
      meta: [['Stack', 'Python · NumPy · FastAPI · Three.js']],
    },
  },

  rubicon: {
    tower: (l) => l === 'fr' ? {
      kicker: 'Stage solo · Bangkok, 2025–26', title: 'Rubicon',
      body: "Une manufacture de bijoux franco-thaïlandaise (~40 salariés), qui vend à travers les grands salons professionnels internationaux. Envoyé seul pour toute la mission : un mois d'audit complet d'abord — le poste de chacun, tous les processus métier, l'usage de chaque logiciel vue par vue, action par action — puis la reconstruction de chaque outil sur Odoo 18, modernisé sans jamais perdre l'utilisateur : mêmes repères, sans jamais arrêter la production.",
      meta: [['Rôle', 'Ingénieur logiciel — audit puis développement, seul du début à la fin'], ['Durée', '13 mois, toujours actif']],
    } : {
      kicker: 'Solo internship · Bangkok, 2025–26', title: 'Rubicon',
      body: 'A Franco-Thai jewelry manufacturer (~40 staff) selling through major international trade fairs. Sent alone for the whole mission: a month-long full audit first — every role, every business process, every piece of software in use, view by view and action by action — then rebuilding each tool on Odoo 18, modernized without ever losing the user: same landmarks, without ever stopping production.',
      meta: [['Role', 'Software engineer — audit, then development, solo start to finish'], ['Duration', '13 months, still active']],
    },
    atelier: (l) => l === 'fr' ? {
      kicker: 'PDP & Suivi de production', title: "L'Atelier",
      body: "Le back-office de l'atelier : catalogue de pierres, cours du jour des métaux, coûts de façon, moteur de calcul de prix, gestion des modèles et variantes. Et sur le plancher de production : lecteur code-barres à chaque poste, temps et poids contrôlés en direct.",
      meta: [['Échelle', 'Des tables de +100 000 lignes — pierres, produits, modèles']],
    } : {
      kicker: 'PDP & Production Tracking', title: 'The Atelier',
      body: "The atelier's back office: a stone catalog, daily metal market prices, labor costing, a price-computation engine, model & variant management. And on the shop floor: a barcode reader at every station, time and weight checked live.",
      meta: [['Scale', 'Tables with 100,000+ rows — stones, products, models']],
    },
    ledger: (l) => l === 'fr' ? {
      kicker: 'SIS · Ventes', title: 'Le Comptoir',
      body: "Devis, commandes, factures, clients et fournisseurs — et une analyse croisée dynamique des ventes par salon, région et pays, exportable en un clic vers Excel.",
      meta: [['Échelle', '247 893 compositions pierre-produit importées']],
    } : {
      kicker: 'SIS · Sales', title: 'The Trading Post',
      body: 'Quotations, orders, invoices, clients and vendors — plus a pivot sales-analysis tool sliced by trade fair, region and country, one click from an Excel export.',
      meta: [['Scale', '247,893 stone-to-product compositions imported']],
    },
    roots: (l) => l === 'fr' ? {
      kicker: 'Migration · Sous le parvis', title: 'Les Racines',
      body: "Sous le parvis envahi de lianes dort encore JMS : plus de vingt ans d'activité en MS-SQL, chaque bijou lié à ses pierres, son historique de prix, ses commandes, ses clients. Un pipeline d'import a remonté toute cette toile vers Odoo — jusqu'aux 3,3 Go de photos produit — sans casser un seul lien, sans jamais interrompre la production.",
    } : {
      kicker: 'Migration · Beneath the forecourt', title: 'The Roots',
      body: 'Below the vine-choked forecourt, JMS still sleeps: twenty-plus years of activity in MS-SQL, every piece of jewelry linked to its stones, its price history, its orders, its clients. An import pipeline pulled that whole web up into Odoo — down to 3.3GB of product photos — without breaking a single link, without ever stopping production.',
    },
  },
  hubs: {
    mic: (l) => l === 'fr' ? {
      kicker: 'Audio · Synchronisation', title: 'Hubs',
      body: "La même musique, au même instant, sur plusieurs appareils — ordinateur, téléphones — chacun sur sa propre enceinte. Synchroniser les horloges ne suffit pas : une enceinte Bluetooth ajoute 100 à 400 ms que ni le téléphone ni le navigateur ne connaissent. Hubs mesure donc au micro ce qu'on entend vraiment, puis compense chaque appareil.",
      meta: [
        ['Mesuré', 'Un seul essai sur du vrai matériel (9 oct. 2026) : deux enceintes Bluetooth, environ 150 et 400 ms de latence — écart médian d’1 ms au plus après calibration'],
        ['Stack', 'JavaScript · Web Audio · Node sans dépendance · Java (Android)'],
      ],
    } : {
      kicker: 'Audio · Sync', title: 'Hubs',
      body: "The same music, at the same instant, on several devices — a computer, phones — each on its own speaker. Syncing clocks isn't enough: a Bluetooth speaker adds 100 to 400 ms that neither the phone nor the browser knows about. So Hubs measures what is actually heard, with a microphone, then compensates each device.",
      meta: [
        ['Measured', 'A single test on real hardware (Oct 9, 2026): two Bluetooth speakers, about 150 and 400 ms of latency — a median gap of 1 ms at most after calibration'],
        ['Stack', 'JavaScript · Web Audio · dependency-free Node · Java (Android)'],
      ],
    },
    calibration: (l) => l === 'fr' ? {
      kicker: 'Calibration', title: 'Un seul micro pour tous',
      body: "Chaque appareil joue à son tour un bref balayage ; le micro le retrouve par corrélation croisée et en tire le retard de cet appareil. Comme le même micro mesure tout le monde, sa propre latence s'annule dans les écarts. La synchro n'est exacte qu'à cet endroit : le son met environ 3 ms à parcourir un mètre.",
      figure: FIG_HUBS_CHIRP, caption: 'Le balayage émis, et le pic qui dit quand il est arrivé.',
    } : {
      kicker: 'Calibration', title: 'One Microphone for All',
      body: "Each device in turn plays a short sweep; the microphone finds it by cross-correlation and reads off that device's delay. Because the same microphone measures everyone, its own latency cancels out of the gaps. Sync is exact at that one spot only: sound takes about 3 ms to cover a metre.",
      figure: FIG_HUBS_CHIRP, caption: 'The sweep that is played, and the peak that says when it landed.',
    },
    spectrum: (l) => l === 'fr' ? {
      kicker: 'Suivi continu', title: 'La musique comme signal',
      body: "Une fois calibré, plus besoin de signal de test : la musique elle-même sert de mesure. Chaque appareil garde une bande étroite de 600 Hz où il est seul à jouer — les autres la retirent de leur son. Le micro y entend donc chacun séparément, même bien moins fort que les autres, et corrige les écarts au fil de l'eau. Rien n'est ajouté au son.",
      figure: FIG_HUBS_BANDS, caption: 'Quatre appareils, quatre bandes entre 3,4 et 6,9 kHz.',
    } : {
      kicker: 'Continuous tracking', title: 'Music as the Signal',
      body: "Once calibrated, no test signal is needed: the music itself is the measurement. Each device keeps a narrow 600 Hz band where it alone plays — the others notch it out of their sound. So the microphone hears each one separately, even when it is far quieter than the rest, and corrects the gaps as the music plays. Nothing is added to the sound.",
      figure: FIG_HUBS_BANDS, caption: 'Four devices, four bands between 3.4 and 6.9 kHz.',
    },
    clock: (l) => l === 'fr' ? {
      kicker: 'Serveur · Horloge', title: "L'Horloge commune",
      body: "Un petit serveur sur l'ordinateur, une page web sur chaque appareil. Chaque page estime son décalage avec l'horloge du serveur par allers-retours, en gardant les plus courts. Le serveur annonce « position P à l'heure T » ; chaque appareil programme le son dans sa propre horloge audio, puis rattrape sa dérive en jouant imperceptiblement plus vite ou plus lentement :",
      code: CODE_HUBS,
    } : {
      kicker: 'Server · Clock', title: 'The Common Clock',
      body: "A small server on the computer, a web page on each device. Each page estimates its offset from the server's clock through round trips, keeping the shortest ones. The server announces “position P at time T”; each device schedules the sound on its own audio clock, then catches its drift by playing imperceptibly faster or slower:",
      code: CODE_HUBS,
    },
    live: (l) => l === 'fr' ? {
      kicker: 'Direct', title: 'Ce qui joue ici, partout',
      body: "Une application, un onglet, une entrée audio : ce qui joue sur l'ordinateur ressort, synchronisé, sur tous les appareils. Le son part en tranches de 100 ms, chacune datée de l'heure de sa capture ; chaque appareil la fait entendre un retard fixe plus tard — une seconde par défaut, soit dix tranches en vol.",
      meta: [
        ['Salles', 'Une adresse /r/CODE par salle, rejointe par un lien, sans compte'],
        ['Android', 'Une application garde la salle en lecture, écran éteint'],
      ],
    } : {
      kicker: 'Live', title: 'What Plays Here, Everywhere',
      body: "An application, a browser tab, an audio input: whatever plays on the computer comes out, in sync, on every device. Sound leaves in 100 ms slices, each stamped with the time it was captured; every device plays it a fixed delay later — one second by default, so ten slices in flight.",
      meta: [
        ['Rooms', 'One /r/CODE address per room, joined by a link, no account'],
        ['Android', 'An app keeps the room playing with the screen off'],
      ],
    },
  },
  foliome: {
    atelier: (l) => l === 'fr' ? {
      kicker: 'Web · Portfolios', title: 'Foliome',
      body: "Des sites de portfolio codés sur mesure, que l'artiste met à jour lui-même : il clique sur une zone du site, un panneau s'ouvre à côté, il modifie, c'est enregistré. Pas de back-office à apprendre — le serveur de développement du site sert aussi d'outil d'édition. Pour rendre un site éditable, on décrit son contenu avec une seule brique, emboîtable à volonté :",
      code: CODE_FOLIOME,
      meta: [
        ['État', "Première étape : l'édition locale. La version hébergée reste à faire."],
        ['Stack', 'TypeScript · Astro · Preact · Hono · sharp'],
      ],
    } : {
      kicker: 'Web · Portfolios', title: 'Foliome',
      body: "Hand-coded portfolio sites that the artist keeps up to date alone: click a zone of the site, a panel opens beside it, change it, it's saved. No back office to learn — the site's own dev server doubles as the editing tool. To make a site editable, its content is described with a single brick that nests at will:",
      code: CODE_FOLIOME,
      meta: [
        ['Status', 'First step: local editing. The hosted version is still to come.'],
        ['Stack', 'TypeScript · Astro · Preact · Hono · sharp'],
      ],
    },
    // `edit` = the labels of the in-place editor this note carries (cities/foliome.js
    // mounts it under the text). The French ones are Foliome's own.
    projects: (l) => l === 'fr' ? {
      kicker: 'Essayez · Édition en place', title: 'Cliquez une maquette',
      body: "Ces quatre maquettes sont la liste « Projets » du site de démo. Cliquez-en une : le panneau s'ouvre à côté, comme dans Foliome. Chaque modification est enregistrée aussitôt — ici dans votre navigateur, là-bas dans un fichier du site.",
      edit: {
        title: 'Titre', program: 'Programme', programs: ['Logement', 'Équipement public', 'Réhabilitation', 'Paysage'],
        order: 'Ordre', moveLeft: 'Déplacer avant', moveRight: 'Déplacer après',
        undo: 'Annuler', publish: 'Mettre en ligne',
        saved: 'Enregistré.', pending: 'Enregistré — pas encore en ligne.',
        undone: 'Dernière modification annulée.', nothing: 'Rien à annuler.',
        published: 'Site mis en ligne : le tirage est à jour.',
      },
    } : {
      kicker: 'Try it · In-place editing', title: 'Click a Model',
      body: "These four models are the demo site's “Projects” list. Click one: the panel opens beside it, as it does in Foliome. Every change is saved at once — here in your browser, there in a file of the site.",
      edit: {
        title: 'Title', program: 'Program', programs: ['Housing', 'Public building', 'Renovation', 'Landscape'],
        order: 'Order', moveLeft: 'Move earlier', moveRight: 'Move later',
        undo: 'Undo', publish: 'Publish',
        saved: 'Saved.', pending: 'Saved — not online yet.',
        undone: 'Last change undone.', nothing: 'Nothing to undo.',
        published: 'Site published: the print is up to date.',
      },
    },
    print: (l) => l === 'fr' ? {
      kicker: 'En ligne · Statique', title: 'Le Tirage',
      body: "Le site en ligne reste entièrement statique : c'est ce tirage, épinglé à la table à dessin. On édite sur le serveur de développement, que l'artiste rejoint depuis son propre appareil, sur le même Wi-Fi, avec un code d'accès. Le tirage ne change que lorsqu'on met en ligne — et chaque enregistrement peut s'annuler, sur cent niveaux.",
    } : {
      kicker: 'Online · Static', title: 'The Print',
      body: "The online site stays entirely static: it is this print, pinned to the drafting table. Editing happens on the dev server, which the artist joins from their own device, on the same Wi-Fi, with an access code. The print only changes when the site is published — and every save can be undone, a hundred levels deep.",
    },
    labo: (l) => l === 'fr' ? {
      kicker: 'Fichiers', title: 'Le Labo',
      body: "L'artiste envoie ses fichiers tels quels ; le labo les prépare pour le web. Une image est redressée, débarrassée de ses métadonnées — position GPS comprise —, ramenée à 3200 px au plus et déclinée en trois largeurs. Une vidéo est réencodée en MP4, 1080p au plus, avec une image d'attente.",
      figure: FIG_FOLIOME_SIZES, caption: 'Une image, trois largeurs.',
    } : {
      kicker: 'Files', title: 'The Lab',
      body: "The artist uploads files as they are; the lab gets them ready for the web. A picture is straightened, stripped of its metadata — GPS position included — brought down to 3200 px at most and delivered in three widths. A video is re-encoded to MP4, 1080p at most, with a poster image.",
      figure: FIG_FOLIOME_SIZES, caption: 'One picture, three widths.',
    },
  },
};
