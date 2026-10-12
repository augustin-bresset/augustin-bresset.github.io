// lang.js — INTERFACE strings (FR/EN) + the field-note renderer. The portfolio
// CONTENT (who Augustin is, projects, path, links) lives in content.js so it can be
// edited without touching the engine. This file is only chrome: hints, buttons,
// and turning a content note into HTML.
import { POIS, CITY_LABELS, CITY_LINKS } from './content.js';

export const LANG = {
  current: 'en',
  strings: {
    en: {
      hint: 'Click a settlement to explore  ·  drag to look around',
      cityHint: 'Drag to orbit  ·  click the glowing markers to read each story  ·  the orb returns to the map',
      croquisHint: 'Move to steer  ·  hold to speed up  ·  ↓ to stop and float',
      back: 'Back to the map',
      waveBtn: 'Call airships',
      legendTitle: 'Settlements',
      linksTitle: 'Links',
      helpTitle: 'How this world works',
      helpGotIt: 'Got it',
      helpItems: [
        'Click a glowing settlement to dive in — "Back to the map" (top-left) returns you to the overview.',
        'Drag to move over the map; Shift-drag (or right-drag) to turn the view and tilt it up toward the summits; scroll or pinch to zoom.',
        'Inside a settlement, click a glowing marker to read a short note about it.',
        'A lit window or doorway is a portal — click it to jump elsewhere.',
        'Top-right: another island with the next climate, or the next shape of mountains (from the roundest to the sharpest); switch between worlds, or the language. The list on the left jumps straight to any settlement.',
      ],
    },
    fr: {
      hint: 'Cliquez un lieu pour explorer  ·  glissez pour regarder',
      cityHint: 'Glissez pour tourner autour  ·  cliquez les marqueurs lumineux pour lire chaque histoire  ·  l’orbe ramène à la carte',
      croquisHint: 'Bougez pour diriger  ·  maintenez pour accélérer  ·  ↓ pour s’arrêter et flotter',
      back: 'Retour à la carte',
      waveBtn: 'Appeler les vaisseaux',
      legendTitle: 'Les lieux',
      linksTitle: 'Liens',
      helpTitle: 'Comment ce monde fonctionne',
      helpGotIt: 'Compris',
      helpItems: [
        'Cliquez un lieu lumineux pour vous y plonger — « Retour à la carte » (en haut à gauche) vous ramène à la vue d’ensemble.',
        'Glissez pour vous déplacer sur la carte ; Maj+glisser (ou clic droit) pour tourner la vue et la relever vers les sommets ; molette ou pincement pour zoomer.',
        'Dans un lieu, cliquez un marqueur lumineux pour lire une petite note.',
        'Une fenêtre ou une porte lumineuse est un portail — cliquez pour voyager ailleurs.',
        'En haut à droite : une autre île au climat suivant, ou au relief suivant (des montagnes les plus rondes aux plus piquées) ; changez de monde ou de langue. La liste à gauche mène directement à un lieu.',
      ],
    },
  },
  t(k) { return (this.strings[this.current][k] ?? k); },
};

// the floating plaque text for a city, in the current language → [name, subtitle]
export function cityLabel(cityId, lang) {
  const f = CITY_LABELS[cityId];
  return f ? f(lang) : [cityId, ''];
}

export function getNote(cityId, poiId, lang) {
  const city = POIS[cityId];
  if (!city || !city[poiId]) return null;
  return city[poiId](lang);
}

// a settlement's "front door" links (main repo, live demo, site…) for the focus-mode
// side panel. Curated in content.js CITY_LINKS; [] means no public links → panel hidden.
export function cityLinks(cityId, lang) {
  const f = CITY_LINKS[cityId];
  return f ? f(lang) : [];
}

const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => HTML_ESC[c]);

// a code snippet, ink-on-paper: escape it, then dim trailing `#` or `//` comments.
// Our snippets are short and hand-written, so the naive comment split is safe enough.
function renderCode(src) {
  const body = src.replace(/\n+$/, '').split('\n').map((line) => {
    const esc = escapeHtml(line);
    const m = esc.match(/^(.*?)((?:#|\/\/).*)$/);
    return m ? `${m[1]}<span class="tok-c">${m[2]}</span>` : esc;
  }).join('\n');
  return `<pre class="note-code"><code>${body}</code></pre>`;
}

// Field notes are now narrative + (optionally) one evocative element: a `figure`
// (trusted inline SVG / <img>, authored in content.js) and/or a `code` snippet.
// External links live in the city-links side panel (see cityLinks + ui.js); any
// `links` on a note are intentionally not rendered here.
export function renderNote(cityId, poiId, lang) {
  const n = getNote(cityId, poiId, lang);
  if (!n) return '';
  const meta = (n.meta || []).map(([k, v]) =>
    `<div class="note-meta-row"><span class="note-meta-k">${k}</span><span class="note-meta-v">${v}</span></div>`).join('');
  const figure = n.figure
    ? `<figure class="note-figure${n.figureFramed ? ' note-figure--framed' : ''}">${n.figure}` +
      `${n.caption ? `<figcaption>${n.caption}</figcaption>` : ''}</figure>`
    : '';
  const code = n.code ? renderCode(n.code) : '';
  return `<span class="note-kicker">${n.kicker}</span>
    <h3 class="note-title">${n.title}</h3>
    <p class="note-text">${n.body}</p>
    ${figure}
    ${code}
    ${meta ? `<div class="note-meta">${meta}</div>` : ''}`;
}
