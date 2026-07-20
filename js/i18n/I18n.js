/**
 * Translation lookup plus DOM application.
 *
 * Markup opts in declaratively:
 *   <span data-i18n="key">          -> textContent
 *   <input data-i18n-placeholder="key">
 *   <button data-i18n-title="key">
 *
 * Code that renders dynamic strings calls t(key, vars) directly. Views that
 * need to redraw on a language change subscribe via onChange().
 */
export class I18n {
  #translations;
  #fallbackLang;
  #storageKey;
  #lang;
  #listeners = new Set();

  constructor(translations, { fallbackLang = 'en', storageKey = 'preferredLang' } = {}) {
    this.#translations = translations;
    this.#fallbackLang = fallbackLang;
    this.#storageKey = storageKey;
    this.#lang = this.#readStoredLang();
  }

  get lang() {
    return this.#lang;
  }

  get availableLangs() {
    return Object.keys(this.#translations);
  }

  #readStoredLang() {
    let stored = null;
    try {
      stored = localStorage.getItem(this.#storageKey);
    } catch {
      // Private browsing can throw on localStorage access.
    }
    return this.#translations[stored] ? stored : this.#fallbackLang;
  }

  /** Look up `key`, substituting every {{name}} found in `vars`. */
  t(key, vars = {}) {
    const table = this.#translations[this.#lang] ?? {};
    const fallback = this.#translations[this.#fallbackLang] ?? {};
    const template = table[key] ?? fallback[key] ?? key;
    return Object.entries(vars).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, value),
      template
    );
  }

  setLanguage(lang) {
    if (!this.#translations[lang]) return;
    this.#lang = lang;
    try {
      localStorage.setItem(this.#storageKey, lang);
    } catch {
      // Ignore — language simply won't persist.
    }
    this.applyToDom();
    this.#listeners.forEach((fn) => fn(lang));
  }

  /** Switch between the two configured languages. */
  toggle() {
    const langs = this.availableLangs;
    const next = langs[(langs.indexOf(this.#lang) + 1) % langs.length];
    this.setLanguage(next);
  }

  /** Rewrite every data-i18n* attributed node in the document. */
  applyToDom(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = this.t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = this.t(el.dataset.i18nTitle);
    });
  }

  /** Register a callback fired after each language change. Returns an unsubscribe fn. */
  onChange(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }
}
