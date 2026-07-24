import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localize, PAGE_LANGS, SITE } from '../scripts/build-lang-pages.mjs';

const INDEX = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the source index.html carries the complete French head', () => {
  assert.match(INDEX, /<html lang="fr">/);
  assert.match(INDEX, /<meta name="description" content="[^"]{50,}">/);
  assert.ok(INDEX.includes(`<link rel="canonical" href="${SITE}">`));
  for (const lang of PAGE_LANGS) {
    assert.ok(INDEX.includes(`hreflang="${lang}" href="${SITE}${lang}.html"`));
  }
  assert.ok(INDEX.includes('hreflang="x-default"'));
  assert.match(INDEX, /"@type": "WebApplication"/);
  assert.match(INDEX, /<meta property="og:image" content="[^"]+og-image\.png">/);
});

test('localize swaps every language-dependent head tag', () => {
  const meta = { title: 'EN Title & Co', description: 'EN description with keywords' };
  const out = localize(INDEX, 'en', meta);
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
  const out = localize(INDEX, 'de', { title: 'T', description: 'D' });
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
    const out = localize(INDEX, lang, meta);
    assert.ok(out.includes(`<html lang="${lang}">`));
    assert.ok(out.includes(`<title>${meta.title}</title>`));
  }
});
