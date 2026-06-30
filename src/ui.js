// ui.js — DOM overlay: project panel, back button, language button, hint.
import { LANG, renderPanel } from './lang.js';

export class UI {
  constructor() {
    this.panel = document.getElementById('content-panel');
    this.panelBody = document.getElementById('panel-body');
    this.backBtn = document.getElementById('back-btn');
    this.langBtn = document.getElementById('lang-btn');
    this.hint = document.getElementById('hint');
    this.activePanel = null;
    this.refreshLang();
  }

  showPanel(key) {
    this.activePanel = key;
    this.panelBody.innerHTML = renderPanel(key, LANG.current);
    this.panel.classList.remove('hidden');
  }

  hidePanel() {
    this.activePanel = null;
    this.panel.classList.add('hidden');
  }

  setBack(visible) {
    this.backBtn.style.display = visible ? 'flex' : 'none';
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
    if (hintSpan) hintSpan.textContent = LANG.t('hint');
    if (this.activePanel) this.panelBody.innerHTML = renderPanel(this.activePanel, LANG.current);
  }
}
