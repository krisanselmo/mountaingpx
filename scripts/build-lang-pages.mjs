/*
 * build-lang-pages.mjs — generate the per-language entry pages after the
 * build. The root index.html stays the French page; en.html, de.html,
 * es.html and it.html are copies with <html lang>, title, description,
 * Open Graph tags and canonical swapped from js/locales/<lang>.json. They
 * sit next to index.html so the relative asset paths keep working; at
 * runtime the app picks the page language from the URL (urlLang() in
 * js/i18n.js).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SITE = 'https://krisanselmo.github.io/mountaingpx/';
export const PAGE_LANGS = ['en', 'de', 'es', 'it']; // fr = root index.html
const OG_LOCALES = { fr: 'fr_FR', en: 'en_US', de: 'de_DE', es: 'es_ES', it: 'it_IT' };

const replaceAttr = (html, pattern, value) =>
  html.replace(pattern, (m, pre, post) => pre + value + post);

/** Swap the language-dependent head of `html` to `lang`. */
export function localize(html, lang, meta) {
  const url = SITE + lang + '.html';
  let out = html.replace(/<html lang="[a-z]{2}">/, `<html lang="${lang}">`);
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`);
  out = replaceAttr(out, /(<meta name="description" content=")[^"]*(")/, meta.description);
  out = replaceAttr(out, /(<link rel="canonical" href=")[^"]*(")/, url);
  out = replaceAttr(out, /(<meta property="og:url" content=")[^"]*(")/, url);
  out = replaceAttr(out, /(<meta property="og:title" content=")[^"]*(")/, meta.title);
  out = replaceAttr(out, /(<meta property="og:description" content=")[^"]*(")/, meta.description);
  out = replaceAttr(out, /(<meta property="og:locale" content=")[^"]*(")/, OG_LOCALES[lang]);
  out = replaceAttr(out, /(<meta name="twitter:title" content=")[^"]*(")/, meta.title);
  out = replaceAttr(out, /(<meta name="twitter:description" content=")[^"]*(")/, meta.description);
  return out;
}

// Script entry point: transform dist/index.html into one page per language.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(fileURLToPath(import.meta.url), '../..');
  const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  for (const lang of PAGE_LANGS) {
    const { meta } = JSON.parse(readFileSync(path.join(root, `js/locales/${lang}.json`), 'utf8'));
    writeFileSync(path.join(root, `dist/${lang}.html`), localize(html, lang, meta));
    console.log(`dist/${lang}.html`);
  }
}
