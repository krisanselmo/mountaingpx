import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localize, buildSitemap, PAGE_LANGS } from '../scripts/build-lang-pages.mjs';
import { resolveSiteUrl, injectSiteUrl } from '../scripts/site-url.mjs';

// The build works for any fork: the head is verified against an arbitrary
// site URL injected the same way the vite plugin does.
const SITE = 'https://some-fork.github.io/mygpx/';
const INDEX = injectSiteUrl(
  readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  SITE
);

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

test('localize swaps every language-dependent head tag', () => {
  const meta = { title: 'EN Title & Co', description: 'EN description with keywords' };
  const out = localize(INDEX, 'en', meta, SITE);
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
  const out = localize(INDEX, 'de', { title: 'T', description: 'D' }, SITE);
  for (const lang of PAGE_LANGS) {
    assert.ok(out.includes(`hreflang="${lang}" href="${SITE}${lang}.html"`));
  }
  assert.ok(out.includes(`hreflang="fr" href="${SITE}"`));
});

test('every language page localizes with its real locale metadata', () => {
  for (const lang of PAGE_LANGS) {
    const { meta } = JSON.parse(
      readFileSync(new URL(`../js/locales/${lang}.json`, import.meta.url), 'utf8')
    );
    const out = localize(INDEX, lang, meta, SITE);
    assert.ok(out.includes(`<html lang="${lang}">`));
    assert.ok(out.includes(`<title>${meta.title}</title>`));
  }
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
