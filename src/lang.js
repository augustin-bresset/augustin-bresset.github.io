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
      cityHint: 'Click the glowing markers to read each story  ·  the orb returns to the map',
      back: 'Back to the island',
      legendTitle: 'Settlements',
    },
    fr: {
      hint: 'Cliquez un lieu pour explorer  ·  glissez pour regarder',
      cityHint: 'Cliquez les marqueurs lumineux pour lire chaque histoire  ·  l’orbe ramène à la carte',
      back: "Retour à l'île",
      legendTitle: 'Les lieux',
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
