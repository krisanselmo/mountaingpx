import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  localize,
  translateBody,
  buildSitemap,
  buildRobots,
  PAGE_LANGS,
} from '../scripts/build-lang-pages.mjs';
import { resolveSiteUrl, injectSiteUrl } from '../scripts/site-url.mjs';

// The build works for any fork: the head is verified against an arbitrary
// site URL injected the same way the vite plugin does.
const SITE = 'https://some-fork.github.io/mygpx/';
const INDEX = injectSiteUrl(
  readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  SITE
);
const locale = (lang) =>
  JSON.parse(readFileSync(new URL(`../js/locales/${lang}.json`, import.meta.url), 'utf8'));
const jsonLd = (html) =>
  JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);

test('the source index.html only references the site through placeholders', () => {
  const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(src.includes('__SITE_URL__'));
  assert.ok(!src.includes('github.io'), 'no hardcoded deployment URL');
});

test('the built index.html carries the complete French head', () => {
  assert.match(INDEX, /<html lang="fr">/);
  assert.match(INDEX, /<meta name="description" content="[^"]{50,}">/);
  assert.ok(INDEX.includes(`<link rel="canonical" href="${SITE}">`));
  for (const lang of PAGE_LANGS) {
    assert.ok(INDEX.includes(`hreflang="${lang}" href="${SITE}${lang}.html"`));
  }
  assert.ok(INDEX.includes('hreflang="x-default"'));
  assert.match(INDEX, /"@type": "WebApplication"/);
  assert.ok(INDEX.includes(`<meta property="og:image" content="${SITE}og-image.png">`));
});

test('the built index.html carries a localizable French body and JSON-LD', () => {
  // The FR page is index.html itself: its JSON-LD feature list is the one the
  // other pages swap, so it must stay in sync with fr.json.
  assert.deepEqual(jsonLd(INDEX).featureList, locale('fr').meta.features);
  assert.match(INDEX, /data-i18n="about\.p1"/);
  assert.ok(INDEX.includes(`<meta property="og:image:alt" content="`));
});

test('localize swaps every language-dependent head tag', () => {
  const meta = { title: 'EN Title & Co', description: 'EN description with keywords' };
  const out = localize(INDEX, 'en', { meta }, SITE);
  assert.match(out, /<html lang="en">/);
  assert.ok(out.includes('<title>EN Title & Co</title>'));
  assert.ok(out.includes('<meta name="description" content="EN description with keywords">'));
  assert.ok(out.includes(`<link rel="canonical" href="${SITE}en.html">`));
  assert.ok(out.includes(`<meta property="og:url" content="${SITE}en.html">`));
  assert.ok(out.includes('<meta property="og:locale" content="en_US">'));
  assert.ok(out.includes('<meta name="twitter:title" content="EN Title & Co">'));
  // The French head values must be gone.
  assert.doesNotMatch(out, /<title>[^<]*trace GPX<\/title>/);
});

test('localize keeps the hreflang alternates identical on every page', () => {
  const out = localize(INDEX, 'de', { meta: { title: 'T', description: 'D' } }, SITE);
  for (const lang of PAGE_LANGS) {
    assert.ok(out.includes(`hreflang="${lang}" href="${SITE}${lang}.html"`));
  }
  assert.ok(out.includes(`hreflang="fr" href="${SITE}"`));
});

test('localize points the JSON-LD at the page and translates its text', () => {
  const dict = locale('de');
  const data = jsonLd(localize(INDEX, 'de', dict, SITE));
  assert.equal(data.url, `${SITE}de.html`);
  assert.equal(data.description, dict.meta.description);
  assert.deepEqual(data.featureList, dict.meta.features);
  // Untouched fields survive the round-trip through JSON.
  assert.equal(data['@type'], 'WebApplication');
  assert.equal(data.isAccessibleForFree, true);
  assert.deepEqual(data.inLanguage, ['fr', 'en', 'de', 'es', 'it']);
});

test('every language page localizes with its real locale metadata', () => {
  for (const lang of PAGE_LANGS) {
    const dict = locale(lang);
    const out = localize(INDEX, lang, dict, SITE);
    assert.ok(out.includes(`<html lang="${lang}">`));
    assert.ok(out.includes(`<title>${dict.meta.title}</title>`));
    // The body text ships translated, without waiting for the app to boot.
    assert.ok(out.includes(dict.about.p1));
    assert.ok(out.includes(`>${dict.brand.tagline}</p>`));
    assert.ok(!out.includes(locale('fr').about.p1), 'no leftover French body text');
  }
});

test('translateBody swaps the text of data-i18n elements, escaping markup', () => {
  const html =
    '<h2 data-i18n="a.b">Ancien</h2>' +
    '<button id="x" data-i18n="a.c" data-i18n-title="a.d">Ancien</button>' +
    '<span data-i18n="missing.key">Gardé</span>';
  const out = translateBody(html, { a: { b: 'New <b>heading</b> & co', c: 'Go' } });
  assert.ok(out.includes('<h2 data-i18n="a.b">New &lt;b&gt;heading&lt;/b&gt; &amp; co</h2>'));
  assert.ok(out.includes('<button id="x" data-i18n="a.c" data-i18n-title="a.d">Go</button>'));
  // An unknown key leaves the source text in place, like t() does at runtime.
  assert.ok(out.includes('<span data-i18n="missing.key">Gardé</span>'));
});

test('translateBody inserts data-i18n-html strings verbatim', () => {
  const out = translateBody(
    '<small data-i18n-html="h">Un seul élément, en <a href="#">Overpass QL</a>.</small>',
    { h: 'One element, in <a href="#">Overpass QL</a>.' }
  );
  assert.ok(out.includes('>One element, in <a href="#">Overpass QL</a>.</small>'));
});

test('translateBody leaves elements holding markup untouched', () => {
  const html = '<p data-i18n="a">Texte <em>riche</em></p>';
  assert.equal(translateBody(html, { a: 'Nouveau' }), html);
});

test('buildSitemap lists the root and every language page', () => {
  const xml = buildSitemap(SITE);
  assert.ok(xml.includes(`<loc>${SITE}</loc>`));
  for (const lang of PAGE_LANGS) {
    assert.ok(xml.includes(`<loc>${SITE}${lang}.html</loc>`));
    assert.ok(xml.includes(`hreflang="${lang}" href="${SITE}${lang}.html"`));
  }
  assert.ok(xml.includes('hreflang="x-default"'));
});

test('buildRobots points at the sitemap and keeps the PR previews out', () => {
  const txt = buildRobots(SITE);
  assert.ok(txt.includes(`Sitemap: ${SITE}sitemap.xml`));
  assert.ok(txt.includes('Disallow: /pr-preview/'));
  assert.match(txt, /^User-agent: \*$/m);
});

test('buildRobots disallows everything on a preview build', () => {
  const txt = buildRobots(SITE, { noindex: true });
  assert.match(txt, /^Disallow: \/$/m);
  assert.ok(!txt.includes('Sitemap:'), 'a preview must not advertise a sitemap');
});

test('resolveSiteUrl: SITE_URL env wins and gains a trailing slash', () => {
  assert.equal(resolveSiteUrl({ SITE_URL: 'https://example.com' }), 'https://example.com/');
  assert.equal(
    resolveSiteUrl({ SITE_URL: 'https://example.com/', GITHUB_REPOSITORY: 'x/y' }),
    'https://example.com/'
  );
});

test('resolveSiteUrl: derived from GITHUB_REPOSITORY on a fork', () => {
  assert.equal(
    resolveSiteUrl({ GITHUB_REPOSITORY: 'somefork/mountaingpx' }),
    'https://somefork.github.io/mountaingpx/'
  );
  // User-pages repository: served at the domain root.
  assert.equal(
    resolveSiteUrl({ GITHUB_REPOSITORY: 'Somefork/somefork.github.io' }),
    'https://Somefork.github.io/'
  );
});

test('resolveSiteUrl: falls back to the package.json homepage', () => {
  const { homepage } = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  );
  assert.equal(resolveSiteUrl({}), homepage);
  assert.ok(resolveSiteUrl({}).endsWith('/'));
});
