// lang.js — INTERFACE strings (FR/EN) + the field-note renderer. The portfolio
// CONTENT (who Augustin is, projects, path, links) lives in content.js so it can be
// edited without touching the engine. This file is only chrome: hints, buttons,
// and turning a content note into HTML.
import { POIS, CITY_LABELS } from './content.js';

export const LANG = {
  current: 'en',
  strings: {
    en: {
      hint: 'Click a settlement to explore  ·  drag to look around',
      cityHint: 'Drag to orbit  ·  click the glowing markers to read each story  ·  the orb returns to the map',
      croquisHint: 'Move to steer  ·  hold to speed up  ·  ↓ to stop and float',
      back: 'Back to the map',
      legendTitle: 'Settlements',
      helpTitle: 'How this world works',
      helpGotIt: 'Got it',
      helpItems: [
        'Click a glowing settlement to dive in — "Back to the map" (top-left) returns you to the overview.',
        'Drag to orbit or pan the view; scroll or pinch to zoom.',
        'Inside a settlement, click a glowing marker to read a short note about it.',
        'A lit window or doorway is a portal — click it to jump elsewhere.',
        'Top-right: switch between worlds, or the language. The list on the left jumps straight to any settlement.',
      ],
    },
    fr: {
      hint: 'Cliquez un lieu pour explorer  ·  glissez pour regarder',
      cityHint: 'Glissez pour tourner autour  ·  cliquez les marqueurs lumineux pour lire chaque histoire  ·  l’orbe ramène à la carte',
      croquisHint: 'Bougez pour diriger  ·  maintenez pour accélérer  ·  ↓ pour s’arrêter et flotter',
      back: 'Retour à la carte',
      legendTitle: 'Les lieux',
      helpTitle: 'Comment ce monde fonctionne',
      helpGotIt: 'Compris',
      helpItems: [
        'Cliquez un lieu lumineux pour vous y plonger — « Retour à la carte » (en haut à gauche) vous ramène à la vue d’ensemble.',
        'Glissez pour tourner ou déplacer la vue ; molette ou pincement pour zoomer.',
        'Dans un lieu, cliquez un marqueur lumineux pour lire une petite note.',
        'Une fenêtre ou une porte lumineuse est un portail — cliquez pour voyager ailleurs.',
        'En haut à droite : changez de monde ou de langue. La liste à gauche mène directement à un lieu.',
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

export function renderNote(cityId, poiId, lang) {
  const n = getNote(cityId, poiId, lang);
  if (!n) return '';
  const meta = (n.meta || []).map(([k, v]) =>
    `<div class="note-meta-row"><span class="note-meta-k">${k}</span><span class="note-meta-v">${v}</span></div>`).join('');
  const links = (n.links || []).map(([t, h]) =>
    `<a href="${h}" target="_blank" rel="noopener" class="note-link">${t}</a>`).join('');
  return `<span class="note-kicker">${n.kicker}</span>
    <h3 class="note-title">${n.title}</h3>
    <p class="note-text">${n.body}</p>
    ${meta ? `<div class="note-meta">${meta}</div>` : ''}
    ${links ? `<div class="note-links">${links}</div>` : ''}`;
}
