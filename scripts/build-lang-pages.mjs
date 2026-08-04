/*
 * build-lang-pages.mjs — generate the per-language entry pages, the sitemap
 * and robots.txt after the build. The root index.html stays the French page;
 * en.html, de.html, es.html and it.html are copies with <html lang>, title,
 * description, Open Graph tags, canonical, JSON-LD *and the body text*
 * swapped from js/locales/<lang>.json — a crawler (or a visitor with
 * JavaScript disabled) gets each page fully in its own language, without
 * waiting for translateDom() to run. They sit next to index.html so the
 * relative asset paths keep working; at runtime the app picks the page
 * language from the URL (urlLang() in js/i18n.js). The public URL is
 * resolved once by scripts/site-url.mjs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { resolveSiteUrl } from './site-url.mjs';

export const PAGE_LANGS = ['en', 'de', 'es', 'it']; // fr = root index.html
const OG_LOCALES = { fr: 'fr_FR', en: 'en_US', de: 'de_DE', es: 'es_ES', it: 'it_IT' };

const replaceAttr = (html, pattern, value) =>
  html.replace(pattern, (m, pre, post) => pre + value + post);

const lookup = (dict, key) =>
  key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Translate the static text of `html` from `dict`, mirroring what
 * translateDom() does at runtime for the two attributes that carry visible
 * text: data-i18n (textContent) and data-i18n-html (innerHTML). The other
 * data-i18n-* attributes only feed title/placeholder/aria-label, which the
 * source markup does not carry, so there is nothing to swap for them.
 */
export function translateBody(html, dict) {
  // data-i18n elements hold plain text (textContent semantics), so their
  // content never contains markup: `[^<]*` matches it and skips anything
  // else, leaving the element untouched rather than mangling it.
  let out = html.replace(
    /(<([a-z][\w-]*)\b[^>]*\sdata-i18n="([\w.]+)"[^>]*>)([^<]*)(<\/\2>)/gi,
    (m, open, tag, key, text, close) => {
      const value = lookup(dict, key);
      return value == null ? m : open + escapeText(value) + close;
    }
  );
  // data-i18n-html strings contain markup (a link, some emphasis) and are
  // inserted verbatim, exactly like innerHTML does at runtime.
  out = out.replace(
    /(<([a-z][\w-]*)\b[^>]*\sdata-i18n-html="([\w.]+)"[^>]*>)([\s\S]*?)(<\/\2>)/gi,
    (m, open, tag, key, body, close) => {
      const value = lookup(dict, key);
      return value == null ? m : open + value + close;
    }
  );
  return out;
}

/**
 * Swap the language-dependent fields of the JSON-LD WebApplication block:
 * the page URL, the description and the feature list. The block is parsed
 * and re-serialized so the output stays valid JSON whatever the strings
 * contain.
 */
export function localizeJsonLd(html, meta, url) {
  return html.replace(
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
    (m, open, body, close) => {
      const data = JSON.parse(body);
      data.url = url;
      data.description = meta.description;
      if (meta.features) data.featureList = meta.features;
      return `${open}\n${JSON.stringify(data, null, 2)}\n  ${close}`;
    }
  );
}

/** Turn `html` (a built page) into the `lang` page of the site. */
export function localize(html, lang, dict, site) {
  const { meta } = dict;
  const url = site + lang + '.html';
  let out = html.replace(/<html lang="[a-z]{2}">/, `<html lang="${lang}">`);
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`);
  out = replaceAttr(out, /(<meta name="description" content=")[^"]*(")/, meta.description);
  out = replaceAttr(out, /(<link rel="canonical" href=")[^"]*(")/, url);
  out = replaceAttr(out, /(<meta property="og:url" content=")[^"]*(")/, url);
  out = replaceAttr(out, /(<meta property="og:title" content=")[^"]*(")/, meta.title);
  out = replaceAttr(out, /(<meta property="og:description" content=")[^"]*(")/, meta.description);
  out = replaceAttr(out, /(<meta property="og:locale" content=")[^"]*(")/, OG_LOCALES[lang]);
  out = replaceAttr(out, /(<meta property="og:image:alt" content=")[^"]*(")/, meta.title);
  out = replaceAttr(out, /(<meta name="twitter:title" content=")[^"]*(")/, meta.title);
  out = replaceAttr(out, /(<meta name="twitter:description" content=")[^"]*(")/, meta.description);
  out = replaceAttr(out, /(<meta name="twitter:image:alt" content=")[^"]*(")/, meta.title);
  out = localizeJsonLd(out, meta, url);
  return translateBody(out, dict);
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

/**
 * robots.txt pointing crawlers at the sitemap and keeping the PR previews
 * out of the index. A preview build (`noindex`) disallows everything
 * instead. Crawlers only read /robots.txt at the *host* root, so this file
 * bites when the site is served from a domain root (custom domain, or an
 * <owner>.github.io repository); under a project subpath
 * (…github.io/mountaingpx/) it is inert but harmless, and the preview pages
 * carry a <meta name="robots" content="noindex"> of their own anyway
 * (see vite.config.js).
 */
export function buildRobots(site, { noindex = false } = {}) {
  if (noindex) return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /pr-preview/',
    '',
    `Sitemap: ${site}sitemap.xml`,
    '',
  ].join('\n');
}

// Script entry point: transform dist/index.html (already built, placeholders
// resolved) into one page per language, plus dist/sitemap.xml and
// dist/robots.txt.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(fileURLToPath(import.meta.url), '../..');
  const site = resolveSiteUrl();
  const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  for (const lang of PAGE_LANGS) {
    const dict = JSON.parse(readFileSync(path.join(root, `js/locales/${lang}.json`), 'utf8'));
    writeFileSync(path.join(root, `dist/${lang}.html`), localize(html, lang, dict, site));
    console.log(`dist/${lang}.html`);
  }
  writeFileSync(path.join(root, 'dist/sitemap.xml'), buildSitemap(site));
  console.log('dist/sitemap.xml');
  writeFileSync(
    path.join(root, 'dist/robots.txt'),
    buildRobots(site, { noindex: Boolean(process.env.NOINDEX_BUILD) })
  );
  console.log('dist/robots.txt');
}
