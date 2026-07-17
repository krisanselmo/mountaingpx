/*
 * i18n.js — tiny translation layer.
 * Locale dictionaries live in ./locales/<lang>.json and are bundled at build
 * time. The active language is detected from localStorage, then the browser
 * preferences, and can be switched at runtime.
 */
import fr from './locales/fr.json';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import it from './locales/it.json';

const MESSAGES = { fr, en, es, de, it };

// Supported languages, and their endonym shown in the language selector.
export const SUPPORTED = ['fr', 'en', 'es', 'de', 'it'];
export const LANG_NAMES = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
};

const FALLBACK = 'en';
const LS_LANG_KEY = 'mountaingpx.lang.v1';

let current = FALLBACK;

function loadStored() {
  try {
    const v = localStorage.getItem(LS_LANG_KEY);
    if (SUPPORTED.includes(v)) return v;
  } catch (_) {}
  return null;
}

export function saveLang(lang) {
  try {
    localStorage.setItem(LS_LANG_KEY, lang);
  } catch (_) {}
}

/**
 * Pick the initial language: the one saved from a previous visit wins,
 * otherwise the first browser-preferred language we support, else English.
 */
export function detectLang() {
  const stored = loadStored();
  if (stored) return stored;
  const prefs = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || ''];
  for (const pref of prefs) {
    const base = String(pref).toLowerCase().split('-')[0];
    if (SUPPORTED.includes(base)) return base;
  }
  return FALLBACK;
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  current = SUPPORTED.includes(lang) ? lang : FALLBACK;
  return current;
}

function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

/**
 * Translate `key` (dot-path) in the current language, falling back to English
 * then to the key itself. `params` fills `{name}` style placeholders.
 */
export function t(key, params) {
  let s = lookup(MESSAGES[current], key);
  if (s == null) s = lookup(MESSAGES[FALLBACK], key);
  if (s == null) return key;
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (m, p) => (params[p] != null ? params[p] : m));
  }
  return s;
}

/**
 * Apply translations to a DOM subtree via data-i18n* attributes:
 *   data-i18n            -> textContent
 *   data-i18n-html       -> innerHTML (for strings containing markup)
 *   data-i18n-title      -> title attribute
 *   data-i18n-placeholder-> placeholder attribute
 *   data-i18n-aria-label -> aria-label attribute
 */
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((n) => {
    n.textContent = t(n.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((n) => {
    n.innerHTML = t(n.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((n) => {
    n.title = t(n.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((n) => {
    n.placeholder = t(n.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((n) => {
    n.setAttribute('aria-label', t(n.dataset.i18nAriaLabel));
  });
}
