/*
 * build-lang-pages.mjs — generate the per-language entry pages and the
 * sitemap after the build. The root index.html stays the French page;
 * en.html, de.html, es.html and it.html are copies with <html lang>, title,
 * description, Open Graph tags and canonical swapped from
 * js/locales/<lang>.json. They sit next to index.html so the relative asset
 * paths keep working; at runtime the app picks the page language from the
 * URL (urlLang() in js/i18n.js). The public URL is resolved once by
 * scripts/site-url.mjs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { resolveSiteUrl } from './site-url.mjs';

export const PAGE_LANGS = ['en', 'de', 'es', 'it']; // fr = root index.html
const OG_LOCALES = { fr: 'fr_FR', en: 'en_US', de: 'de_DE', es: 'es_ES', it: 'it_IT' };

const replaceAttr = (html, pattern, value) =>
  html.replace(pattern, (m, pre, post) => pre + value + post);

/** Swap the language-dependent head of `html` (a built page) to `lang`. */
export function localize(html, lang, meta, site) {
  const url = site + lang + '.html';
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

/** Sitemap listing the root page and the per-language entry pages. */
export function buildSitemap(site) {
  const alt = (lang, href) =>
    `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>\n`;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  xml += '  <url>\n';
  xml += `    <loc>${site}</loc>\n`;
  xml += alt('fr', site);
  for (const lang of PAGE_LANGS) xml += alt(lang, `${site}${lang}.html`);
  xml += alt('x-default', site);
  xml += '  </url>\n';
  for (const lang of PAGE_LANGS) {
    xml += `  <url><loc>${site}${lang}.html</loc></url>\n`;
  }
  xml += '</urlset>\n';
  return xml;
}

// Script entry point: transform dist/index.html (already built, placeholders
// resolved) into one page per language, plus dist/sitemap.xml.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(fileURLToPath(import.meta.url), '../..');
  const site = resolveSiteUrl();
  const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  for (const lang of PAGE_LANGS) {
    const { meta } = JSON.parse(readFileSync(path.join(root, `js/locales/${lang}.json`), 'utf8'));
    writeFileSync(path.join(root, `dist/${lang}.html`), localize(html, lang, meta, site));
    console.log(`dist/${lang}.html`);
  }
  writeFileSync(path.join(root, 'dist/sitemap.xml'), buildSitemap(site));
  console.log('dist/sitemap.xml');
}
