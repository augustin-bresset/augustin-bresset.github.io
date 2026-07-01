// ui.js — DOM overlay: the field-note slip (pinned beside a landmark), back
// button, language button, hint. The old centred project modal is gone — notes are
// small, screen-anchored to the marker the visitor clicked.
import { LANG, renderNote, cityLabel } from './lang.js';
import { CITY_ACCENT } from './content.js';

export class UI {
  constructor() {
    this.card = document.getElementById('note-card');
    this.cardBody = document.getElementById('note-body');
    this.backBtn = document.getElementById('back-btn');
    this.langBtn = document.getElementById('lang-btn');
    this.themeBtn = document.getElementById('theme-btn');
    this.hint = document.getElementById('hint');
    this.legend = document.getElementById('legend');
    this.activeNote = null;     // { cityId, poiId, accent }
    this._hintKey = 'hint';
    this._legendCities = null;
    this.refreshLang();
  }

  // build the clickable settlement legend (called once at boot)
  buildLegend(cities, onPick) {
    this._legendCities = cities;
    this.renderLegend();
    this.legend.addEventListener('click', (e) => {
      const btn = e.target.closest('.legend-item');
      if (btn) onPick(btn.dataset.id);
    });
  }

  renderLegend() {
    if (!this.legend || !this._legendCities) return;
    const items = this._legendCities.map((c) => {
      const [name, sub] = cityLabel(c.id, LANG.current);
      const ac = CITY_ACCENT[c.id] || '#c4763a';
      return `<button class="legend-item" data-id="${c.id}">
        <span class="legend-dot" style="background:${ac}"></span>
        <span class="legend-text"><span class="legend-name">${name}</span><span class="legend-sub">${sub}</span></span>
      </button>`;
    }).join('');
    this.legend.innerHTML = `<div class="legend-title">${LANG.t('legendTitle')}</div>${items}`;
  }

  setLegend(visible) {
    if (this.legend) this.legend.classList.toggle('hidden', !visible);
  }

  // open a note for a landmark; `side` is which side of the marker it sits on
  showNote(cityId, poiId, accent, side = 'right') {
    this.activeNote = { cityId, poiId, accent };
    this.cardBody.innerHTML = renderNote(cityId, poiId, LANG.current);
    this.card.style.setProperty('--accent', accent || '#c4763a');
    this.card.classList.toggle('note-card--left', side === 'left');
    this.card.classList.toggle('note-card--right', side !== 'left');
    this.card.classList.remove('hidden');
    // restart the entrance animation each time it opens
    this.card.classList.remove('note-in');
    void this.card.offsetWidth;            // force reflow
    this.card.classList.add('note-in');
  }

  // pin the card beside the marker's screen point (x,y), clamped to the viewport
  positionNote(x, y, side) {
    if (!this.card || this.card.classList.contains('hidden')) return;
    const w = this.card.offsetWidth, h = this.card.offsetHeight;
    const gap = 28, m = 16;
    let left = side === 'left' ? x - gap - w : x + gap;
    let top = y - h * 0.42;
    left = Math.max(m, Math.min(left, window.innerWidth - w - m));
    top = Math.max(m + 56, Math.min(top, window.innerHeight - h - m));
    this.card.style.left = `${left}px`;
    this.card.style.top = `${top}px`;
    // aim the little pointer notch at the marker
    const notchY = Math.max(20, Math.min(y - top, h - 20));
    this.card.style.setProperty('--notch-y', `${notchY}px`);
  }

  hideNote() {
    this.activeNote = null;
    if (this.card) this.card.classList.add('hidden');
  }

  setBack(visible) {
    this.backBtn.style.display = visible ? 'flex' : 'none';
  }

  // show the hint line with a specific string key (overview vs in-city guidance)
  showHint(key) {
    this._hintKey = key;
    const span = this.hint && this.hint.querySelector('[data-key]');
    if (span) span.textContent = LANG.t(key);
    if (this.hint) this.hint.style.opacity = '1';
  }

  setHint(visible) {
    if (this.hint) this.hint.style.opacity = visible ? '1' : '0';
  }

  refreshLang() {
    this.langBtn.textContent = LANG.current === 'en' ? 'FR' : 'EN';
    document.documentElement.lang = LANG.current;
    const backSpan = this.backBtn.querySelector('[data-key]');
    if (backSpan) backSpan.textContent = LANG.t('back');
    const hintSpan = this.hint && this.hint.querySelector('[data-key]');
    if (hintSpan) hintSpan.textContent = LANG.t(this._hintKey);
    if (this.activeNote) {
      this.cardBody.innerHTML = renderNote(this.activeNote.cityId, this.activeNote.poiId, LANG.current);
    }
    this.renderLegend();
  }
}
